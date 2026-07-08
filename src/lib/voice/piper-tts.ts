import * as ort from 'onnxruntime-web';
import { TextSplitterStream } from './text-splitter';

export type VoiceId = string;

export interface VoiceInfo {
	name: string;
	size: number;
	lang: string;
}

export interface TTSConfig {
	voiceId: VoiceId;
	onChunk?: (pcm: Float32Array, chunkIndex: number, text: string) => void;
	onDone?: () => void;
	onError?: (err: Error) => void;
	onProgress?: (downloaded: number, total: number) => void;
}

export const VOICES: Record<VoiceId, VoiceInfo> = {
	'en_US-hfc_female-medium': { name: 'HFC Female', size: 20, lang: 'en' },
	'en_US-lessac-medium': { name: 'Lessac Male', size: 20, lang: 'en' },
	'en_US-ryan-medium': { name: 'Ryan Male', size: 40, lang: 'en' },
	'en_US-libritts_r-medium': { name: 'LibriTTS R', size: 75, lang: 'en' },
};

const HF_BASE = 'https://huggingface.co/rhasspy/piper-voices/resolve/v1.0.0';
const MODEL_URLS: Record<VoiceId, { model: string; config: string }> = {
	'en_US-hfc_female-medium': {
		model: `${HF_BASE}/en/en_US/hfc_female/medium/en_US-hfc_female-medium.onnx`,
		config: `${HF_BASE}/en/en_US/hfc_female/medium/en_US-hfc_female-medium.onnx.json`,
	},
	'en_US-lessac-medium': {
		model: `${HF_BASE}/en/en_US/lessac/medium/en_US-lessac-medium.onnx`,
		config: `${HF_BASE}/en/en_US/lessac/medium/en_US-lessac-medium.onnx.json`,
	},
	'en_US-ryan-medium': {
		model: `${HF_BASE}/en/en_US/ryan/medium/en_US-ryan-medium.onnx`,
		config: `${HF_BASE}/en/en_US/ryan/medium/en_US-ryan-medium.onnx.json`,
	},
	'en_US-libritts_r-medium': {
		model: `${HF_BASE}/en/en_US/libritts_r/medium/en_US-libritts_r-medium.onnx`,
		config: `${HF_BASE}/en/en_US/libritts_r/medium/en_US-libritts_r-medium.onnx.json`,
	},
};

const DB_NAME = 'piper-models';
const DB_VERSION = 1;

function openDB(): Promise<IDBDatabase> {
	return new Promise((resolve, reject) => {
		const req = indexedDB.open(DB_NAME, DB_VERSION);
		req.onupgradeneeded = () => {
			const db = req.result;
			if (!db.objectStoreNames.contains('models')) {
				db.createObjectStore('models');
			}
		};
		req.onsuccess = () => resolve(req.result);
		req.onerror = () => reject(req.error);
	});
}

async function loadCached(voiceId: VoiceId): Promise<{ model: ArrayBuffer; config: any } | null> {
	try {
		const db = await openDB();
		const tx = db.transaction('models', 'readonly');
		const store = tx.objectStore('models');
		const req = store.get(voiceId);
		return new Promise((resolve, reject) => {
			req.onsuccess = () => {
				const data = req.result;
				if (data?.model && data?.config) {
					resolve({ model: data.model, config: data.config });
				} else {
					resolve(null);
				}
				db.close();
			};
			req.onerror = () => { db.close(); reject(req.error); };
		});
	} catch {
		return null;
	}
}

async function saveCache(voiceId: VoiceId, model: ArrayBuffer, config: any): Promise<void> {
	try {
		const db = await openDB();
		const tx = db.transaction('models', 'readwrite');
		const store = tx.objectStore('models');
		store.put({ model, config }, voiceId);
		return new Promise((resolve, reject) => {
			tx.oncomplete = () => { db.close(); resolve(); };
			tx.onerror = () => { db.close(); reject(tx.error); };
		});
	} catch {}
}

const PHONEME_MAP: Record<string, number> = {
	'a': 1, 'e': 2, 'i': 3, 'o': 4, 'u': 5,
	'aa': 6, 'ae': 7, 'ah': 8, 'ao': 9, 'aw': 10,
	'ay': 11, 'b': 12, 'ch': 13, 'd': 14, 'dh': 15,
	'dj': 16, 'dz': 17, 'eh': 18, 'er': 19, 'ey': 20,
	'f': 21, 'g': 22, 'h': 23, 'hh': 24, 'ih': 25,
	'iy': 27, 'j': 28, 'k': 29, 'l': 30,
	'm': 31, 'n': 32, 'ng': 33, 'ow': 34, 'oy': 35,
	'p': 36, 'r': 37, 's': 38, 'sh': 39, 't': 40,
	'th': 41, 'uh': 42, 'ur': 45,
	'v': 46, 'w': 47, 'y': 48, 'z': 49, 'zh': 50,
	'sil': 0,
};

function textToPhonemes(text: string): number[] {
	const clean = text.toLowerCase().replace(/[^a-z\s]/g, '');
	const words = clean.split(/\s+/);
	const phonemes: number[] = [];
	for (const word of words) {
		for (let i = 0; i < word.length; i++) {
			const twoChar = word.substring(i, i + 2);
			if (PHONEME_MAP[twoChar]) {
				phonemes.push(PHONEME_MAP[twoChar]);
				i++;
			} else {
				const oneChar = word[i];
				phonemes.push(PHONEME_MAP[oneChar] || 0);
			}
		}
		phonemes.push(0);
	}
	return phonemes;
}

export class PiperTTS {
	private session: ort.InferenceSession | null = null;
	private config: TTSConfig;
	private abortController: AbortController | null = null;
	private inputName = '';
	private outputName = '';

	isLoaded = false;
	isLoading = false;
	loadError: string | null = null;

	constructor(config: TTSConfig) {
		this.config = config;
	}

	async load(): Promise<void> {
		if (this.isLoaded || this.isLoading) return;
		this.isLoading = true;
		this.loadError = null;

		try {
			const urls = MODEL_URLS[this.config.voiceId];
			if (!urls) throw new Error(`Unknown voice: ${this.config.voiceId}`);

			let modelBuf: ArrayBuffer;

			const cached = await loadCached(this.config.voiceId);
			if (cached) {
				modelBuf = cached.model;
			} else {
				modelBuf = await this.download(urls.model);
				let configData: any = null;
				try {
					const configRes = await fetch(urls.config);
					if (configRes.ok) configData = await configRes.json();
				} catch {}
				await saveCache(this.config.voiceId, modelBuf, configData);
			}

			const session = await ort.InferenceSession.create(
				new Uint8Array(modelBuf),
				{
					executionProviders: ['wasm'],
				}
			);
			this.session = session;
			this.inputName = session.inputNames[0];
			this.outputName = session.outputNames[0];
			this.isLoaded = true;
		} catch (e) {
			this.loadError = e instanceof Error ? e.message : String(e);
			throw e;
		} finally {
			this.isLoading = false;
		}
	}

	private async download(url: string): Promise<ArrayBuffer> {
		const res = await fetch(url);
		if (!res.ok) throw new Error(`Failed to download model: ${res.status} ${res.statusText}`);
		const total = Number(res.headers.get('content-length')) || 0;
		if (!res.body) return res.arrayBuffer();

		const reader = res.body.getReader();
		const chunks: Uint8Array[] = [];
		let received = 0;

		while (true) {
			const { done, value } = await reader.read();
			if (done) break;
			chunks.push(value);
			received += value.length;
			this.config.onProgress?.(received, total);
		}

		const merged = new Uint8Array(received);
		let offset = 0;
		for (const c of chunks) {
			merged.set(c, offset);
			offset += c.length;
		}
		return merged.buffer;
	}

	async synthesize(text: string): Promise<void> {
		if (!this.session) {
			throw new Error('TTS not loaded');
		}

		this.abortController = new AbortController();
		const { signal } = this.abortController;

		const chunks = TextSplitterStream.split(text);

		try {
			for (let i = 0; i < chunks.length; i++) {
				if (signal.aborted) break;
				const chunk = chunks[i];
				const pcm = await this.synthesizeChunk(chunk.text);
				this.config.onChunk?.(pcm, i, chunk.text);
			}
			this.config.onDone?.();
		} catch (e) {
			if (!signal.aborted) {
				this.config.onError?.(e instanceof Error ? e : new Error(String(e)));
			}
		}
	}

	private async synthesizeChunk(text: string): Promise<Float32Array> {
		if (!this.session) {
			throw new Error('TTS not loaded');
		}

		const phonemes = textToPhonemes(text);
		const ids = BigInt64Array.from(phonemes.map(BigInt));

		const feeds: Record<string, ort.Tensor> = {
			[this.inputName]: new ort.Tensor('int64', ids, [1, ids.length]),
		};

		if (this.session.inputNames.includes('input_lengths')) {
			feeds['input_lengths'] = new ort.Tensor('int64', BigInt64Array.from([BigInt(ids.length)]), [1]);
		}

		const results = await this.session.run(feeds);
		const audioTensor = results[this.outputName] as ort.Tensor;
		return audioTensor.data as Float32Array;
	}

	abort(): void {
		this.abortController?.abort();
		this.abortController = null;
	}

	dispose(): void {
		if (this.session) {
			try {
				this.session.release();
			} catch {}
		}
		this.session = null;
		this.isLoaded = false;
		this.isLoading = false;
	}
}

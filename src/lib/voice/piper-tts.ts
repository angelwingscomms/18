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
	modelBase: string;
	onChunk?: (pcm: Float32Array, chunkIndex: number, text: string) => void;
	onDone?: () => void;
	onError?: (err: Error) => void;
	onProgress?: (progress: number, total: number) => void;
}

export const VOICES: Record<VoiceId, VoiceInfo> = {
	'en_US-hfc_female-medium': { name: 'HFC Female', size: 20, lang: 'en' },
	'en_US-lessac-medium': { name: 'Lessac Male', size: 20, lang: 'en' },
	'en_US-ryan-medium': { name: 'Ryan Male', size: 40, lang: 'en' },
	'en_US-libritts_r-medium': { name: 'LibriTTS R', size: 75, lang: 'en' },
};

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
			const session = await ort.InferenceSession.create(
				`${this.config.modelBase}/${this.config.voiceId}.onnx`,
				{
					executionProviders: ['wasm'],
				}
			);
			this.session = session;
			this.isLoaded = true;
		} catch (e) {
			this.loadError = e instanceof Error ? e.message : String(e);
			throw e;
		} finally {
			this.isLoading = false;
		}
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
		const phonemeTensor = new ort.Tensor('int64', BigInt64Array.from(phonemes.map(BigInt)), [1, phonemes.length]);

		const feeds: Record<string, ort.Tensor> = {
			phoneme: phonemeTensor,
		};

		const results = await this.session.run(feeds);
		const audioTensor = results['audio'] as ort.Tensor;
		const audioData = audioTensor.data as Float32Array;

		return audioData;
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
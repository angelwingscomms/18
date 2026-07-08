import { PiperWebEngine, OnnxWebRuntime } from 'piper-tts-web';

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

export class PiperTTS {
	private engine: PiperWebEngine | null = null;
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
			this.engine = new PiperWebEngine({
				onnxRuntime: new OnnxWebRuntime({ numThreads: 1 }),
			});
			this.isLoaded = true;
		} catch (e) {
			this.loadError = e instanceof Error ? e.message : String(e);
			throw e;
		} finally {
			this.isLoading = false;
		}
	}

	async synthesize(text: string): Promise<void> {
		if (!this.engine) {
			throw new Error('TTS not loaded');
		}

		this.abortController = new AbortController();
		const { signal } = this.abortController;

		try {
			const result = await this.engine.generate(text, this.config.voiceId, 0);
			if (signal.aborted) return;

			const wavBlob = result.file;
			const arrayBuf = await wavBlob.arrayBuffer();
			if (signal.aborted) return;

			const pcm = decodeWav(arrayBuf);
			this.config.onChunk?.(pcm, 0, text);
			this.config.onDone?.();
		} catch (e) {
			if (!signal.aborted) {
				this.config.onError?.(e instanceof Error ? e : new Error(String(e)));
			}
		}
	}

	abort(): void {
		this.abortController?.abort();
		this.abortController = null;
	}

	dispose(): void {
		if (this.engine) {
			try { this.engine.destroy(); } catch {}
		}
		this.engine = null;
		this.isLoaded = false;
		this.isLoading = false;
	}
}

function decodeWav(buf: ArrayBuffer): Float32Array {
	const dv = new DataView(buf);
	const numChannels = dv.getUint16(22, true);
	const sampleRate = dv.getUint32(24, true);
	const bitsPerSample = dv.getUint16(34, true);
	const dataOffset = dv.getUint32(16, true) + 20 - 8;
	const dataSize = dv.getUint32(40, true);
	const numSamples = dataSize / (bitsPerSample / 8);

	const pcm = new Float32Array(numSamples / numChannels);
	if (bitsPerSample === 16) {
		for (let i = 0; i < pcm.length; i++) {
			const sample = dv.getInt16(dataOffset + i * numChannels * 2, true);
			pcm[i] = sample / 32768;
		}
	} else if (bitsPerSample === 8) {
		for (let i = 0; i < pcm.length; i++) {
			pcm[i] = (dv.getUint8(dataOffset + i * numChannels) - 128) / 128;
		}
	} else if (bitsPerSample === 32) {
		for (let i = 0; i < pcm.length; i++) {
			pcm[i] = dv.getFloat32(dataOffset + i * numChannels * 4, true);
		}
	}
	return pcm;
}

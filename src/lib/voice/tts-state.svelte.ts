import { browser } from '$app/environment';
import { getContext, setContext } from 'svelte';
import { PiperTTS, type VoiceId, VOICES } from './piper-tts';
import { AudioQueue } from './audio-queue';

const TTS_KEY = Symbol('tts');

export function set_tts_state(state: TTSState) {
	setContext(TTS_KEY, state);
}

export function get_tts_state(): TTSState {
	return getContext(TTS_KEY)!;
}

export class TTSState {
	tts: PiperTTS | null = null;
	queue: AudioQueue | null = null;
	isPlaying = $state(false);
	isPaused = $state(false);
	currentNoteId: string | null = null;
	currentText = $state('');
	progress = $state(0);
	voiceId = $state<VoiceId>('en_US-hfc_female-medium');
	isModelLoaded = $state(false);
	isModelLoading = $state(false);
	downloadProgress = $state(0);
	error = $state<string | null>(null);

	get isEnabled() {
		return browser && this.isModelLoaded && !this.error;
	}

	async init(): Promise<void> {
		if (!browser) return;
		this.queue = new AudioQueue();
		await this.loadModel();
	}

	async loadModel(): Promise<void> {
		if (this.isModelLoaded || this.isModelLoading) return;
		this.isModelLoading = true;
		this.error = null;
		try {
			if (!this.tts) {
				this.tts = new PiperTTS({
					voiceId: this.voiceId,
					onChunk: (pcm, chunkIndex, text) => {
						this.currentText = text;
						this.progress = Math.min(100, (chunkIndex + 1) * 5);
						this.queue?.enqueue(pcm, () => {
							if (!this.isPaused && this.isPlaying) {
								this.playNextChunk(chunkIndex);
							}
						});
					},
					onDone: () => {
						this.isPlaying = false;
						this.isPaused = false;
						this.progress = 100;
					},
					onError: (err) => {
						this.error = err.message;
						this.isPlaying = false;
						this.isPaused = false;
					},
					onProgress: (progress, total) => {
						this.downloadProgress = Math.round((progress / total) * 100);
					},
				});
			}
			await this.tts.load();
			this.isModelLoaded = true;
		} catch (e) {
			this.error = e instanceof Error ? e.message : String(e);
		} finally {
			this.isModelLoading = false;
		}
	}

	async playNote(noteId: string, content: string): Promise<void> {
		if (!this.queue) await this.init();
		if (!this.isModelLoaded) await this.loadModel();
		if (this.error) return;

		this.stop();
		this.currentNoteId = noteId;
		this.isPlaying = true;
		this.isPaused = false;
		this.progress = 0;
		this.currentText = '';

		if (this.tts) {
			this.tts.abort();
			await this.tts.synthesize(content);
		}
	}

	private chunkIndex = 0;
	private chunks: string[] = [];

	private async playNextChunk(currentChunk: number): Promise<void> {
		if (!this.isPlaying || this.isPaused) return;
	}

	togglePause(): void {
		if (this.isPaused) {
			this.queue?.play();
			this.isPaused = false;
		} else {
			this.queue?.pause();
			this.isPaused = true;
		}
	}

	stop(): void {
		this.tts?.abort();
		this.queue?.stop();
		this.isPlaying = false;
		this.isPaused = false;
		this.progress = 0;
		this.currentText = '';
		this.currentNoteId = null;
	}

	async changeVoice(voiceId: VoiceId): Promise<void> {
		if (this.voiceId === voiceId) return;
		this.voiceId = voiceId;
		this.stop();
		this.isModelLoaded = false;
		await this.loadModel();
	}

	get availableVoices() {
		return Object.entries(VOICES).map(([id, info]) => ({ id, ...info }));
	}

	dispose(): void {
		this.stop();
		this.tts?.dispose();
		this.queue?.dispose();
	}
}
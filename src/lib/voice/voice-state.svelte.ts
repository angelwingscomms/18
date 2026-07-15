import { browser } from '$app/environment';
import { getContext, setContext, untrack } from 'svelte';
import { get_tool_declarations } from './gemini-live-dispatcher';
import type { ChatMsg, Note } from './types';
import { play } from 'cuelume';
import { model_options } from './types';

function new_note_id() {
	return crypto.randomUUID();
}

function load_notes(): Record<string, Note> {
	if (!browser) return {};
	try {
		const raw = localStorage.getItem('notes');
		if (!raw) return {};
		const data = JSON.parse(raw);
		if (Array.isArray(data)) {
			const dict: Record<string, Note> = {};
			for (const n of data) {
				if (!n || typeof n !== 'object') continue;
				let id = n.i;
				if (!id) {
					if ('id' in n) id = (n as any).id;
					else id = new_note_id();
				}
				dict[id] = { i: id, t: n.t || n.title || 'Note', b: n.b || (n as any).content || '' };
			}
			localStorage.setItem('notes', JSON.stringify(dict));
			return dict;
		}
		return data as Record<string, Note>;
	} catch {
		return {};
	}
}

const SYS = `You are a helpful voice assistant. Keep responses extremely short — 1-3 sentences. Plain language, like talking to a friend. When the conversation starts, greet the user.

You have a tool called exa_search that searches the web. Only use exa_search when the user specifically asks you to search the web. Do not search on your own initiative.
You also have a tool called web_fetch that fetches and reads the content of a specific URL. Use it when the user gives you a URL and asks you to read, summarize, or analyze its content. You can paginate through long pages using offset/limit.

You also have a tool called clear_chat that clears all chat messages. Before calling clear_chat, you must ask the user for confirmation. Only proceed if the user explicitly confirms.

You also have note tools for working with the user's notes. read_note to read a note, edit_note to edit, list_notes to list all notes, add_note to create, delete_note to remove, rename_note to rename. Each note has a title and content. Always refer to the note title when talking to the user, not the id. Before calling edit_note, always call read_note first on the same note so you know the current content.

The user can send you images. When you receive an image, acknowledge and describe what you see if asked.

There is a "silent mode". When it is active the microphone is effectively muted and you were not meant to hear the user — any message that begins with "silent mode on" means silent mode is currently active. While silent mode is on: ignore the user's message entirely and do NOT respond at all (no speech, no text, no tool calls). The ONLY exception is if the user asks you to start listening, unmute, or stop being silent — in that case you MUST call the start_listening tool. start_listening is the only tool you may ever call while silent mode is on.`;
const KEY = Symbol('voice');

export function set_voice_state(state: VoiceState) {
	setContext(KEY, state);
}

export function get_voice_state(): VoiceState {
	return getContext(KEY)!;
}

export class VoiceState {
	recording = $state(false);
	voice_muted = $state(false);
	silent_mode = $state(false);
	pending_silent = false;
	audio_muted = $state(false);
	note_dictating = $state(false);
	note_dictation_media_recorder: MediaRecorder | null = null;
	note_dictation_chunks: Blob[] = [];
	note_dictation_mic_stream: MediaStream | null = null;
	note_dictation_cursor = 0;
	gemini_live_session: any = null;
	gemini_live_audio_ctx: AudioContext | null = null;
	gemini_live_audio_gain: GainNode | null = null;
	gemini_live_voice_gain: GainNode | null = null;
	gemini_live_mic_stream: MediaStream | null = null;
	gemini_live_processor: ScriptProcessorNode | null = null;
	gemini_live_audio_queue: AudioBuffer[] = [];
	gemini_live_audio_playing = false;
	gemini_live_current_source: AudioBufferSourceNode | null = null;

	pending_clear = $state(false);
	pending_images = $state<string[]>([]);

	gemini_live_healthy = false;
	gemini_live_closing = false;
	connecting = $state(false);
	tool_call_pending = false;
	goaway_received = false;
	reconnecting = $state(false);
	prompt_reconnect_timer: ReturnType<typeof setTimeout> | null = null;
	_user_id = '';

	rnnoise_node: AudioWorkletNode | null = null;

	chat_messages = $state<ChatMsg[]>([]);
	chat_queue = $state<{ text: string }[]>([]);
	chat_loading = $state(false);
	chat_abort: AbortController | null = null;
	chat_input = $state('');
	chat_body: HTMLDivElement | null = null;
	chat_input_ref: HTMLTextAreaElement | null = null;

	output_turn_active = false;

	model = $state((browser && localStorage.getItem('model')) || model_options[0].v);
	voice_name = $state((browser && localStorage.getItem('voice_name')) || 'Kore');
	noise_suppression = $state(browser && localStorage.getItem('noise_suppression') !== 'false');
	voice_gain = $state(browser ? parseFloat(localStorage.getItem('voice_gain') ?? '1') : 1);
	quiet = $state(browser && localStorage.getItem('quiet') === 'true');
	use_tab = $state(browser && localStorage.getItem('use_tab') === 'true');
	fold_lines = $state(browser && localStorage.getItem('fold_lines') !== 'false');
	tab_size = $state(browser ? parseInt(localStorage.getItem('tab_size') ?? '1', 10) || 1 : 1);
	gemini_key = $state((browser && localStorage.getItem('gemini_key')) || '');
	exa_key = $state((browser && localStorage.getItem('exa_key')) || '');
	openrouter_key = $state((browser && localStorage.getItem('openrouter_key')) || '');
	groq_key = $state((browser && localStorage.getItem('groq_key')) || '');

	system_prompt = $state((browser && localStorage.getItem('system_prompt')) || '');
	notes = $state<Record<string, Note>>(load_notes());
	active_note_id = $state(browser ? localStorage.getItem('active_note_id') || '' : '');
	show_note = $state(browser && localStorage.getItem('show_note') !== 'false');
	open_note_ids = $state<string[]>([]);

	get active_note(): Note | undefined {
		return this.notes[this.active_note_id];
	}

	get note_content(): string {
		return this.active_note?.b ?? '';
	}

	set note_content(val: string) {
		const n = this.active_note;
		if (n) {
			n.b = val;
			this.notes = { ...this.notes };
			this.qdrant_call('payload', n.i, undefined, n.b);
		}
	}

	show_voice_menu = $state(false);
	show_model_menu = $state(false);

	// ENTRANMENT - BINAURAL FREQUENCY
	binaural_playing = $state(false);
	binaural_volume = $state(
		browser ? parseFloat(localStorage.getItem('binaural_volume') ?? '0.3') : 0.3
	);
	show_binaural_settings = $state(false);

	toasts = $state<{ id: number; msg: string; t: string }[]>([]);
	toast_id = $state(0);

	constructor() {
		if (browser) {
			document.addEventListener('keydown', (e: KeyboardEvent) => {
				if (e.code === 'MediaPlayPause') {
					e.preventDefault();
					this.toggleMicMute();
				}
			});
		}
		if (Object.keys(this.notes).length === 0) {
			const i = new_note_id();
			this.notes = { [i]: { i, t: 'Note', b: '' } };
		}
		if (!this.active_note_id || !this.notes[this.active_note_id]) {
			this.active_note_id = Object.values(this.notes)[0].i;
		}
		const stored_open = browser ? localStorage.getItem('open_note_ids') : null;
		this.open_note_ids = stored_open
			? stored_open.split(',').filter(Boolean)
			: Object.keys(this.notes);
		$effect(() => {
			return () => {
				this.cleanup();
			};
		});
		$effect(() => {
			if (browser) localStorage.setItem('model', this.model);
		});
		$effect(() => {
			if (browser) localStorage.setItem('voice_name', this.voice_name);
		});
		$effect(() => {
			if (browser) localStorage.setItem('noise_suppression', String(this.noise_suppression));
		});
		$effect(() => {
			if (browser) localStorage.setItem('voice_gain', String(this.voice_gain));
		});
		$effect(() => {
			if (browser) localStorage.setItem('quiet', String(this.quiet));
		});
		$effect(() => {
			if (browser) localStorage.setItem('use_tab', String(this.use_tab));
		});
		$effect(() => {
			if (browser) localStorage.setItem('fold_lines', String(this.fold_lines));
		});
		$effect(() => {
			if (browser) localStorage.setItem('tab_size', String(this.tab_size));
		});
		$effect(() => {
			if (browser) localStorage.setItem('gemini_key', this.gemini_key);
		});
		$effect(() => {
			if (browser) localStorage.setItem('exa_key', this.exa_key);
		});
		$effect(() => {
			if (browser) localStorage.setItem('openrouter_key', this.openrouter_key);
		});

		$effect(() => {
			if (browser) localStorage.setItem('system_prompt', this.system_prompt);
		});
		$effect(() => {
			if (browser) localStorage.setItem('groq_key', this.groq_key);
		});
		$effect(() => {
			this.system_prompt;
			if (this.prompt_reconnect_timer) {
				clearTimeout(this.prompt_reconnect_timer);
				this.prompt_reconnect_timer = null;
			}
			if (this.gemini_live_session) {
				this.prompt_reconnect_timer = setTimeout(() => {
					this.prompt_reconnect_timer = null;
					this.trigger_reconnect();
				}, 5400);
			}
		});
		$effect(() => {
			if (this.show_binaural_settings) return;
			if (this.prompt_reconnect_timer) {
				clearTimeout(this.prompt_reconnect_timer);
				this.prompt_reconnect_timer = null;
			}
			untrack(() => this.trigger_reconnect());
		});
		$effect(() => {
			if (browser) localStorage.setItem('notes', JSON.stringify(this.notes));
		});
		$effect(() => {
			if (browser) localStorage.setItem('active_note_id', this.active_note_id);
		});
		$effect(() => {
			if (browser) localStorage.setItem('show_note', String(this.show_note));
		});
		$effect(() => {
			if (browser) localStorage.setItem('open_note_ids', this.open_note_ids.join(','));
		});
		$effect(() => {
			if (browser) localStorage.setItem('binaural_volume', String(this.binaural_volume));
		});
		$effect(() => {
			const g = this.voice_gain;
			if (this.gemini_live_voice_gain) {
				this.gemini_live_voice_gain.gain.value = g;
			}
		});
		$effect(() => {
			const el = this.chat_body;
			if (!el) return;
			this.chat_messages.length;
			this.chat_queue.length;
			requestAnimationFrame(() => {
				el.scrollTop = el.scrollHeight;
			});
		});
	}

	log(msg: string) {
		console.log('[voice] ' + msg);
	}

	add_toast(msg: string, t: 'e' | 'i' = 'i') {
		const id = ++this.toast_id;
		this.toasts = [...this.toasts, { id, msg, t }];
		setTimeout(() => (this.toasts = this.toasts.filter((t) => t.id !== id)), 4000);
	}

	cleanup() {
		if (this.gemini_live_closing) return;
		this.log('cleanup: starting');
		this.gemini_live_closing = true;
		this.gemini_live_healthy = false;
		this.recording = false;

		this.interrupt_audio();

		if (this.gemini_live_processor) {
			this.gemini_live_processor.onaudioprocess = null;
			this.gemini_live_processor.disconnect();
			this.gemini_live_processor = null;
		}

		if (this.gemini_live_voice_gain) {
			this.gemini_live_voice_gain.disconnect();
			this.gemini_live_voice_gain = null;
		}

		if (this.rnnoise_node) {
			(this.rnnoise_node as any).destroy?.();
			this.rnnoise_node.disconnect();
			this.rnnoise_node = null;
		}

		if (this.gemini_live_mic_stream) {
			this.gemini_live_mic_stream.getTracks().forEach((t) => t.stop());
			this.gemini_live_mic_stream = null;
		}

		const session = this.gemini_live_session;
		this.gemini_live_session = null;
		if (session) {
			try {
				session.close();
			} catch {}
		}

		if (this.gemini_live_audio_gain) {
			this.gemini_live_audio_gain.disconnect();
			this.gemini_live_audio_gain = null;
		}

		if (this.gemini_live_audio_ctx) {
			this.gemini_live_audio_ctx.close();
			this.gemini_live_audio_ctx = null;
		}

		this.gemini_live_audio_queue = [];
		this.gemini_live_audio_playing = false;
		this.gemini_live_current_source = null;
		this.chat_loading = false;
		play('droplet');
		this.log('cleanup: done');
	}

	toggleMicMute() {
		this.voice_muted = !this.voice_muted;
	}

	toggle_silent_mode() {
		if (this.silent_mode) {
			this.start_listening();
		} else {
			this.silent_mode = true;
			this.interrupt_audio();
			try {
				this.gemini_live_session?.sendRealtimeInput({ text: 'silent mode on' });
			} catch {}
		}
	}

	toggleSpeakerMute() {
		this.audio_muted = !this.audio_muted;
		if (this.gemini_live_audio_gain) {
			this.gemini_live_audio_gain.gain.value = this.audio_muted ? 0 : 1;
		}
	}

	start_listening(): string {
		this.voice_muted = false;
		this.silent_mode = false;
		this.pending_silent = false;
		this.interrupt_audio();
		if (this.gemini_live_audio_gain) {
			this.gemini_live_audio_gain.gain.value = this.audio_muted ? 0 : 1;
		}
		return this.gemini_live_session
			? 'Microphone is on.'
			: 'Microphone on — connect voice chat to talk.';
	}

	change_voice(voice_name?: string): string {
		if (!voice_name) return 'Error: voice_name is required.';
		this.voice_name = voice_name;
		if (this.gemini_live_session) {
			this.trigger_reconnect();
			return `Changed voice to "${voice_name}" and restarting the live session to apply it.`;
		}
		return `Changed voice to "${voice_name}".`;
	}

	async startNoteDictation() {
		if (this.note_dictating) return;
		const stream =
			this.gemini_live_mic_stream ||
			(await navigator.mediaDevices.getUserMedia({ audio: true }).catch(() => null));
		if (!stream) return;
		this.note_dictation_mic_stream = stream;
		this.note_dictation_chunks = [];
		const mr = new MediaRecorder(stream, { mimeType: 'audio/webm' });
		mr.ondataavailable = (e) => {
			if (e.data.size > 0) this.note_dictation_chunks.push(e.data);
		};
		mr.onstop = () => {
			this.note_dictating = false;
			this.note_dictation_media_recorder = null;
			if (
				this.note_dictation_mic_stream &&
				this.note_dictation_mic_stream !== this.gemini_live_mic_stream
			) {
				this.note_dictation_mic_stream.getTracks().forEach((t) => t.stop());
			}
			this.note_dictation_mic_stream = null;
			const blob = new Blob(this.note_dictation_chunks, { type: 'audio/webm' });
			this.transcribe_and_append(blob);
		};
		this.note_dictation_media_recorder = mr;
		mr.start();
		this.note_dictating = true;
	}

	stopNoteDictation() {
		if (!this.note_dictation_media_recorder) return;
		this.note_dictation_media_recorder.stop();
	}

	async transcribe_and_append(blob: Blob) {
		const n = this.active_note;
		if (!n) return;
		const form = new FormData();
		form.set('audio', blob, 'dictation.webm');
		if (this.groq_key) form.set('apiKey', this.groq_key);
		try {
			const res = await fetch('/api/voice/groq-transcribe', { method: 'POST', body: form });
			const d: any = await res.json();
			if (d.text) {
				const pos = this.note_dictation_cursor;
				const text = d.text + '\n';
				n.b = n.b.slice(0, pos) + text + n.b.slice(pos);
				this.note_dictation_cursor = pos + text.length;
				this.notes = { ...this.notes };
				this.qdrant_call('payload', n.i, undefined, n.b);
			}
		} catch {}
	}

	async load_thinking_sound() {}

	start_thinking_sound() {
		play('whisper');
	}

	stop_thinking_sound() {}

	async toggleVoiceChat() {
		if (this.gemini_live_session) {
			this.cleanup();
			return;
		}
		this.gemini_live_closing = false;
		this.goaway_received = false;
		await this.connectLive();
	}

	async connectLive() {
		if (this.connecting) return;
		this.connecting = true;
		try {
			this.add_toast('Connecting voice...');
			let key = this.gemini_key;
			if (!key) {
				const res = await fetch('/api/voice/gemini-live/key');
				const d = await res.json();
				key = d.k;
			}
			if (!key) throw new Error('No API key available');

			const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
			this.gemini_live_mic_stream = stream;

			const audioCtx = new AudioContext();
			this.gemini_live_audio_ctx = audioCtx;
			const outputGain = audioCtx.createGain();
			outputGain.gain.value = this.audio_muted ? 0 : 1;
			outputGain.connect(audioCtx.destination);
			this.gemini_live_audio_gain = outputGain;
			this.load_thinking_sound();

			const micSource = audioCtx.createMediaStreamSource(stream);

			let processorSource: MediaStreamAudioSourceNode | null = null;
			if (this.noise_suppression) {
				try {
					const { RnnoiseWorkletNode, loadRnnoise } =
						await import('@sapphi-red/web-noise-suppressor');
					const wasmBinary = await loadRnnoise({
						url: '/rnnoise.wasm',
						simdUrl: '/rnnoise_simd.wasm'
					});
					await audioCtx.audioWorklet.addModule('/rnnoise-worklet.js');
					const rnnoiseNode = new RnnoiseWorkletNode(audioCtx, {
						maxChannels: 1,
						wasmBinary
					});
					this.rnnoise_node = rnnoiseNode;
					const intermediateDest = audioCtx.createMediaStreamDestination();
					micSource.connect(rnnoiseNode).connect(intermediateDest);
					processorSource = audioCtx.createMediaStreamSource(intermediateDest.stream);
				} catch {}
			}

			const voiceGain = audioCtx.createGain();
			voiceGain.gain.value = this.voice_gain;
			this.gemini_live_voice_gain = voiceGain;
			(processorSource ?? micSource).connect(voiceGain);

			const processor = audioCtx.createScriptProcessor(2048, 1, 1);
			processor.onaudioprocess = this.gemini_process_audio;
			voiceGain.connect(processor);
			const micGain = audioCtx.createGain();
			micGain.gain.value = 0;
			processor.connect(micGain);
			micGain.connect(audioCtx.destination);
			this.gemini_live_processor = processor;

			const { GoogleGenAI } = await import('@google/genai');
			const ai = new GoogleGenAI({ apiKey: key, httpOptions: { apiVersion: 'v1alpha' } });
			let session: any;
			session = await ai.live.connect({
				model: this.model,
				callbacks: {
					onopen: () => {
						this.gemini_live_healthy = true;
						this.recording = true;
						if ('mediaSession' in navigator) {
							try {
								navigator.mediaSession.setActionHandler('play', () => this.toggleMicMute());
								navigator.mediaSession.setActionHandler('pause', () => this.toggleMicMute());
							} catch {}
						}
						if (!this.reconnecting) {
							this.add_toast('Voice connected');
							play('sparkle');
						}
					},
					onmessage: (msg: any) => {
						this.gemini_live_handle(msg);
					},
					onerror: (e: any) => {
						this.log(
							'onerror code=' +
								e?.code +
								' reason=' +
								e?.reason +
								' message=' +
								e?.message +
								' error=' +
								(e?.error?.message ?? e?.error ?? '')
						);
						this.handle_disconnect('error');
					},
					onclose: (e?: any) => {
						this.log(
							'onclose code=' + e?.code + ' reason="' + e?.reason + '" wasClean=' + e?.wasClean
						);
						this.handle_disconnect('close');
					}
				},
				config: {
					responseModalities: ['AUDIO'] as any,
					speechConfig: {
						voiceConfig: {
							prebuiltVoiceConfig: { voiceName: this.voice_name }
						}
					} as any,
					systemInstruction: {
						parts: [{ text: this.system_prompt ? `${SYS}\n\n${this.system_prompt}` : SYS }]
					} as any,
					tools: get_tool_declarations(),
					contextWindowCompression: { slidingWindow: {} },
					sessionResumption: {}
				} as any
			});
			this.gemini_live_session = session;
			const msgs = this.chat_messages.filter((m) => m.content);
			const initial =
				msgs.length > 0
					? `[CONTEXT]\n${msgs
							.slice(-20)
							.map((m) => `${m.role}: ${m.content}`)
							.join('\n')}\n[/CONTEXT]\n\nHello`
					: 'Hello';
			try {
				session.sendRealtimeInput({ text: initial });
			} catch {}
		} catch (e) {
			if (e instanceof DOMException && e.name === 'NotFoundError') {
				try {
					const devices = await navigator.mediaDevices.enumerateDevices();
					const audio_inputs = devices.filter((d) => d.kind === 'audioinput');
					this.add_toast(
						audio_inputs.length === 0
							? 'No microphone detected'
							: 'Mic found but could not access it',
						'e'
					);
				} catch {
					this.add_toast('No microphone found', 'e');
				}
			} else {
				this.add_toast('Voice setup error: ' + (e instanceof Error ? e.message : String(e)), 'e');
			}
			this.cleanup();
			throw e;
		} finally {
			this.connecting = false;
		}
	}

	handle_disconnect(reason: string) {
		this.trigger_reconnect();
	}

	trigger_reconnect() {
		if (this.gemini_live_closing || this.reconnecting || this.connecting) return;
		if (!this.gemini_live_session) return;
		this.reconnecting = true;
		this.gemini_live_healthy = false;
		this.recording = false;
		play('bloom');
		this.auto_reconnect();
	}

	async auto_reconnect() {
		this.interrupt_audio();

		if (this.gemini_live_processor) {
			this.gemini_live_processor.onaudioprocess = null;
			this.gemini_live_processor.disconnect();
			this.gemini_live_processor = null;
		}
		if (this.gemini_live_voice_gain) {
			this.gemini_live_voice_gain.disconnect();
			this.gemini_live_voice_gain = null;
		}
		if (this.rnnoise_node) {
			(this.rnnoise_node as any).destroy?.();
			this.rnnoise_node.disconnect();
			this.rnnoise_node = null;
		}
		if (this.gemini_live_mic_stream) {
			this.gemini_live_mic_stream.getTracks().forEach((t) => t.stop());
			this.gemini_live_mic_stream = null;
		}
		if (this.gemini_live_audio_gain) {
			this.gemini_live_audio_gain.disconnect();
			this.gemini_live_audio_gain = null;
		}
		if (this.gemini_live_audio_ctx) {
			await this.gemini_live_audio_ctx.close();
			this.gemini_live_audio_ctx = null;
		}
		this.gemini_live_audio_queue = [];
		this.gemini_live_audio_playing = false;
		this.gemini_live_current_source = null;

		const session = this.gemini_live_session;
		this.gemini_live_session = null;
		if (session) {
			try {
				session.close();
			} catch {}
		}

		this.gemini_live_closing = false;
		this.goaway_received = false;

		try {
			await this.connectLive();
		} catch {
			this.add_toast('Reconnect failed', 'e');
			this.cleanup();
		} finally {
			this.reconnecting = false;
		}
	}

	set user_id(v: string) {
		if (this._user_id === v) return;
		this._user_id = v;
		if (v && localStorage.getItem('synced_user') !== v) this.sync_from_qdrant();
	}

	async sync_from_qdrant() {
		if (!this._user_id) return;
		try {
			const res = await fetch('/api/voice/qdrant', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ a: 'scroll' })
			});
			const data = await res.json();
			if (!data.notes) return;
			let changed = false;
			for (const qn of data.notes) {
				if (!this.notes[qn.i]) {
					this.notes = { ...this.notes, [qn.i]: { i: qn.i, t: qn.t, b: qn.b } };
					if (!this.open_note_ids.includes(qn.i))
						this.open_note_ids = [...this.open_note_ids, qn.i];
					changed = true;
				}
			}
			for (const [id, note] of Object.entries(this.notes)) {
				fetch('/api/voice/qdrant', {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({ a: 'upsert', i: id, t: note.t, b: note.b })
				}).catch(() => {});
			}
			localStorage.setItem('synced_user', this._user_id);
		} catch {}
	}

	gemini_process_audio = (e: AudioProcessingEvent) => {
		if (this.voice_muted || this.gemini_live_closing || this.tool_call_pending) return;
		if (!this.gemini_live_can_send()) return;
		const input = e.inputBuffer.getChannelData(0);
		const nativeRate = this.gemini_live_audio_ctx?.sampleRate || 48000;
		const targetRate = 16000;
		const ratio = nativeRate / targetRate;
		const outputLen = Math.floor(input.length / ratio);
		const pcm16 = new Int16Array(outputLen);
		for (let i = 0; i < outputLen; i++) {
			pcm16[i] = Math.max(-32768, Math.min(32767, input[Math.floor(i * ratio)] * 32768));
		}
		const bytes = new Uint8Array(pcm16.buffer);
		let binary = '';
		for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
		try {
			if (!this.gemini_live_closing && this.gemini_live_session) {
				this.gemini_live_session.sendRealtimeInput({
					audio: { data: btoa(binary), mimeType: 'audio/pcm;rate=16000' }
				});
			}
		} catch {}
	};

	gemini_live_can_send() {
		return Boolean(
			this.gemini_live_session &&
			this.recording &&
			this.gemini_live_healthy &&
			!this.gemini_live_closing
		);
	}

	send_gemini_tool_response(input: Record<string, unknown>) {
		if (!this.gemini_live_can_send() || this.gemini_live_closing) return;
		this.tool_call_pending = false;
		try {
			this.gemini_live_session.sendToolResponse(input);
		} catch {}
	}

	async qdrant_call(a: string, i: string, t?: string, b?: string) {
		if (!browser) return;
		try {
			await fetch('/api/voice/qdrant', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ a, i, t, b })
			});
		} catch {}
	}

	note_for_id(note_id?: string): Note | undefined {
		if (note_id) return this.notes[note_id];
		return this.active_note;
	}

	read_note(note_id?: string, offset = 1, limit = 2000): string {
		const note = this.note_for_id(note_id);
		if (!note) return 'Error: Note not found.';
		const lines = note.b.split('\n');
		const start = Math.max(0, offset - 1);
		const sliced = lines.slice(start, start + limit);
		const total = lines.length;
		const last = start + sliced.length;
		let out = `Note: "${note.t}"\n`;
		out += sliced.map((line, i) => `${start + i + 1}: ${line}`).join('\n');
		if (last < total)
			out += `\n(Showing lines ${offset}-${last} of ${total}. Use offset=${last + 1} to continue.)`;
		else out += `\n(End - total ${total} lines)`;
		return out;
	}

	async edit_note(
		oldString: string,
		newString: string,
		replaceAll = false,
		note_id?: string
	): Promise<string> {
		const note = this.note_for_id(note_id);
		if (!note) return 'Error: Note not found.';
		if (oldString === '') {
			note.b = note.b + newString;
			this.notes = { ...this.notes };
			this.qdrant_call('payload', note.i, undefined, note.b);
			play('tick');
			return 'Appended to note.';
		}
		for (let attempt = 0; attempt < 9; attempt++) {
			const content = note.b;
			if (replaceAll) {
				const count = content.split(oldString).length - 1;
				if (count > 0) {
					note.b = content.split(oldString).join(newString);
					this.notes = { ...this.notes };
					this.qdrant_call('payload', note.i, undefined, note.b);
					play('tick');
					return `Replaced ${count} occurrence(s) in note.`;
				}
			} else {
				const first = content.indexOf(oldString);
				if (first !== -1) {
					const last_c = content.lastIndexOf(oldString);
					if (first !== last_c)
						return 'Error: Found multiple matches. Use replaceAll or provide more context.';
					note.b =
						content.substring(0, first) + newString + content.substring(first + oldString.length);
					this.notes = { ...this.notes };
					this.qdrant_call('payload', note.i, undefined, note.b);
					play('tick');
					return 'Edited note.';
				}
			}
			if (attempt < 8) await new Promise((r) => setTimeout(r, 100));
		}
		note.b = note.b + newString;
		this.notes = { ...this.notes };
		this.qdrant_call('payload', note.i, undefined, note.b);
		play('tick');
		return 'Appended to note (oldString not found after 9 attempts).';
	}

	list_notes(): string {
		return Object.values(this.notes)
			.map(
				(n) =>
					`- ${n.i}: "${n.t}" (${n.b.split('\n').length} lines)${n.i === this.active_note_id ? ' [active]' : ''}`
			)
			.join('\n');
	}

	add_note(t = 'Note', b = ''): string {
		const i = new_note_id();
		this.notes = { ...this.notes, [i]: { i, t, b } };
		this.active_note_id = i;
		this.qdrant_call('upsert', i, t, b);
		return `Created note "${t}" (id: ${i}).`;
	}

	delete_note(note_id: string): string {
		if (!this.notes[note_id]) return 'Error: Note not found.';
		if (Object.keys(this.notes).length <= 1) return 'Error: Cannot delete the last note.';
		const { [note_id]: _, ...rest } = this.notes;
		this.notes = rest;
		this.open_note_ids = this.open_note_ids.filter((id) => id !== note_id);
		if (this.active_note_id === note_id) {
			this.active_note_id = Object.values(this.notes)[0]?.i ?? '';
		}
		this.qdrant_call('delete', note_id);
		return 'Deleted note.';
	}

	rename_note(title: string, note_id?: string): string {
		const note = this.note_for_id(note_id);
		if (!note) return 'Error: Note not found.';
		note.t = title;
		this.notes = { ...this.notes };
		this.qdrant_call('payload', note.i, note.t);
		return `Renamed note to "${title}".`;
	}

	focus_note(note_id?: string): string {
		const n = this.note_for_id(note_id);
		if (!n) return 'Error: Note not found.';
		this.active_note_id = n.i;
		if (!this.open_note_ids.includes(n.i)) this.open_note_ids = [...this.open_note_ids, n.i];
		return `Focused note "${n.t}".`;
	}

	gemini_live_handle(msg: any) {
		if (msg.goAway) {
			this.log('GoAway received, reason=' + (msg.goAway.reason || 'none'));
			this.goaway_received = true;
		}
		if (msg.serverContent) {
			console.log(
				'[voice] serverContent:',
				JSON.stringify({
					...msg.serverContent,
					modelTurn: msg.serverContent.modelTurn
						? {
								parts: msg.serverContent.modelTurn.parts?.map((p: any) => ({
									...p,
									inlineData: p.inlineData
										? {
												mimeType: p.inlineData.mimeType,
												data: p.inlineData.data?.slice(0, 50) + '...'
											}
										: undefined
								}))
							}
						: undefined
				})
			);
		}
		if (msg.toolCall?.functionCalls?.length) {
			this.tool_call_pending = true;
			const has_stop = msg.toolCall.functionCalls.some((c) => c.name === 'stop_listening');
			if (!has_stop) {
				this.interrupt_audio();
				this.start_thinking_sound();
			}
			(async () => {
				for (const fc of msg.toolCall.functionCalls) {
					if (this.silent_mode && fc.name !== 'start_listening') {
						this.send_gemini_tool_response({
							functionResponses: [
								{ id: fc.id, name: fc.name, response: { result: 'Silent mode on — tool ignored.' } }
							]
						});
						continue;
					}
					if (fc.name === 'exa_search') {
						try {
							const body: Record<string, unknown> = { query: fc.args.query, type: fc.args.type };
							if (this.exa_key) body.apiKey = this.exa_key;
							const res = await fetch('/api/voice/exa-search', {
								method: 'POST',
								headers: { 'Content-Type': 'application/json' },
								body: JSON.stringify(body)
							});
							const data = await res.json();
							const snippets =
								data.results
									?.map(
										(r: any) =>
											`Title: ${r.title}\nURL: ${r.url}\nSnippet: ${r.highlights?.[0] || r.text?.slice(0, 500) || ''}`
									)
									.join('\n\n') || 'No results found';
							this.send_gemini_tool_response({
								functionResponses: [{ id: fc.id, name: fc.name, response: { result: snippets } }]
							});
						} catch (e) {
							this.send_gemini_tool_response({
								functionResponses: [{ id: fc.id, name: fc.name, response: { error: String(e) } }]
							});
						}
					} else if (fc.name === 'web_fetch') {
						try {
							const res = await fetch('/api/voice/web-fetch', {
								method: 'POST',
								headers: { 'Content-Type': 'application/json' },
								body: JSON.stringify({
									url: fc.args.url,
									offset: fc.args.offset ?? 1,
									limit: fc.args.limit ?? 2000
								})
							});
							const data = await res.json();
							if (data.error) {
								this.send_gemini_tool_response({
									functionResponses: [{ id: fc.id, name: fc.name, response: { error: data.error } }]
								});
							} else {
								const lines = data.lines as string[];
								const total = data.total as number;
								const offset = data.offset as number;
								const start = offset;
								const last = start + lines.length - 1;
								let out = `URL: ${fc.args.url}\n`;
								out += lines.map((line, i) => `${start + i}: ${line}`).join('\n');
								if (last < total)
									out += `\n(Showing lines ${start}-${last} of ${total}. Use offset=${last + 1} to continue.)`;
								else out += `\n(End - total ${total} lines)`;
								this.send_gemini_tool_response({
									functionResponses: [{ id: fc.id, name: fc.name, response: { result: out } }]
								});
							}
						} catch (e) {
							this.send_gemini_tool_response({
								functionResponses: [{ id: fc.id, name: fc.name, response: { error: String(e) } }]
							});
						}
					} else if (fc.name === 'read_note') {
						const lines = this.read_note(
							fc.args.note_id,
							fc.args.offset ?? 1,
							fc.args.limit ?? 2000
						);
						this.send_gemini_tool_response({
							functionResponses: [{ id: fc.id, name: fc.name, response: { result: lines } }]
						});
					} else if (fc.name === 'edit_note') {
						const result = await this.edit_note(
							fc.args.oldString ?? '',
							fc.args.newString ?? '',
							fc.args.replaceAll ?? false,
							fc.args.note_id
						);
						this.send_gemini_tool_response({
							functionResponses: [{ id: fc.id, name: fc.name, response: { result } }]
						});
					} else if (fc.name === 'clear_chat') {
						if (this.chat_messages.length === 0) {
							this.send_gemini_tool_response({
								functionResponses: [
									{ id: fc.id, name: fc.name, response: { result: 'Chat is already empty.' } }
								]
							});
						} else if (!this.pending_clear) {
							this.pending_clear = true;
							setTimeout(() => {
								this.pending_clear = false;
							}, 30000);
							this.send_gemini_tool_response({
								functionResponses: [
									{
										id: fc.id,
										name: fc.name,
										response: {
											result: 'Please ask the user to confirm they want to clear all chat messages.'
										}
									}
								]
							});
						} else {
							this.pending_clear = false;
							this.clearChat();
							this.send_gemini_tool_response({
								functionResponses: [
									{ id: fc.id, name: fc.name, response: { result: 'Chat cleared.' } }
								]
							});
						}
					} else if (fc.name === 'list_notes') {
						this.send_gemini_tool_response({
							functionResponses: [
								{ id: fc.id, name: fc.name, response: { result: this.list_notes() } }
							]
						});
					} else if (fc.name === 'add_note') {
						const result = this.add_note(fc.args.title, fc.args.content);
						this.send_gemini_tool_response({
							functionResponses: [{ id: fc.id, name: fc.name, response: { result } }]
						});
					} else if (fc.name === 'delete_note') {
						const result = this.delete_note(fc.args.note_id);
						this.send_gemini_tool_response({
							functionResponses: [{ id: fc.id, name: fc.name, response: { result } }]
						});
					} else if (fc.name === 'rename_note') {
						const result = this.rename_note(fc.args.title, fc.args.note_id);
						this.send_gemini_tool_response({
							functionResponses: [{ id: fc.id, name: fc.name, response: { result } }]
						});
					} else if (fc.name === 'focus_note') {
						const result = this.focus_note(fc.args.note_id);
						this.send_gemini_tool_response({
							functionResponses: [{ id: fc.id, name: fc.name, response: { result } }]
						});
					} else if (fc.name === 'start_listening') {
						const result = this.start_listening();
						this.send_gemini_tool_response({
							functionResponses: [{ id: fc.id, name: fc.name, response: { result } }]
						});
					} else if (fc.name === 'change_voice') {
						const result = await this.change_voice(fc.args.voice_name);
						this.send_gemini_tool_response({
							functionResponses: [{ id: fc.id, name: fc.name, response: { result } }]
						});
				} else if (fc.name === 'stop_listening') {
					this.pending_silent = true;
					this.send_gemini_tool_response({
						functionResponses: [
							{ id: fc.id, name: fc.name, response: { result: 'Listening silently — responses discarded until you call start_listening.' } }
						]
					});
				}
				}
				this.stop_thinking_sound();
			})();
		}
		if (msg.serverContent?.modelTurn?.parts) {
			this.stop_thinking_sound();
			let audio_count = 0;
			for (const part of msg.serverContent.modelTurn.parts) {
				if (part.inlineData?.mimeType?.startsWith('audio/')) {
					audio_count++;
					if (this.silent_mode) continue;
					try {
						const binary = atob(part.inlineData.data);
						const bytes = new Uint8Array(binary.length);
						for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
						const pcm16 = new Int16Array(bytes.buffer);
						const float32 = new Float32Array(pcm16.length);
						for (let i = 0; i < pcm16.length; i++) float32[i] = pcm16[i] / 32768;
						if (!this.gemini_live_audio_ctx) return;
						const buffer = this.gemini_live_audio_ctx.createBuffer(1, float32.length, 24000);
						buffer.getChannelData(0).set(float32);
						this.gemini_live_audio_queue = [...this.gemini_live_audio_queue, buffer];
						this.play_next_audio();
					} catch (e) {
						console.log('[voice] audio decode error:', e);
					}
				}
			}
			if (audio_count === 0)
				console.log(
					'[voice] modelTurn with no audio parts — parts:',
					msg.serverContent.modelTurn.parts?.map((p: any) => Object.keys(p))
				);
		}
		if (msg.serverContent?.interrupted) {
			this.interrupt_audio();
		}
		if (msg.serverContent?.inputTranscription?.text) {
			this.pending_clear = false;
			if (this.silent_mode) return;
			const text = msg.serverContent.inputTranscription.text;
			this.output_turn_active = false;
			this.chat_messages = [...this.chat_messages, { role: 'user', content: text }];
		}
		if (msg.serverContent?.outputTranscription?.text) {
			if (this.silent_mode) return;
			const text = msg.serverContent.outputTranscription.text;
			if (!this.output_turn_active) {
				this.output_turn_active = true;
				this.chat_messages = [...this.chat_messages, { role: 'assistant', content: text }];
			} else {
				const last = this.chat_messages[this.chat_messages.length - 1];
				const updated = [...this.chat_messages];
				updated[updated.length - 1] = { ...last, content: last.content + text };
				this.chat_messages = updated;
			}
		}
		if (msg.serverContent?.turnComplete) {
			if (this.pending_silent) {
				this.pending_silent = false;
				this.silent_mode = true;
				try {
					this.gemini_live_session?.sendRealtimeInput({ text: 'silent mode on' });
				} catch {}
			}
			if (this.silent_mode) return;
			this.output_turn_active = false;
		}
	}

	play_next_audio() {
		if (
			!this.gemini_live_audio_ctx ||
			!this.gemini_live_audio_gain ||
			this.gemini_live_audio_playing ||
			this.gemini_live_audio_queue.length === 0
		)
			return;
		this.gemini_live_audio_playing = true;
		const buffer = this.gemini_live_audio_queue[0];
		this.gemini_live_audio_queue = this.gemini_live_audio_queue.slice(1);
		const source = this.gemini_live_audio_ctx.createBufferSource();
		source.buffer = buffer;
		source.connect(this.gemini_live_audio_gain);
		source.onended = () => {
			if (this.gemini_live_current_source !== source) return;
			this.gemini_live_current_source = null;
			this.gemini_live_audio_playing = false;
			this.play_next_audio();
		};
		this.gemini_live_current_source = source;
		source.start();
	}

	interrupt_audio() {
		this.stop_thinking_sound();
		const ctx = this.gemini_live_audio_ctx;
		const gain = this.gemini_live_audio_gain;
		if (ctx && gain) {
			gain.gain.cancelScheduledValues(ctx.currentTime);
			gain.gain.setValueAtTime(gain.gain.value, ctx.currentTime);
			gain.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.15);
		}
		this.gemini_live_audio_playing = false;
		this.gemini_live_audio_queue = [];
		this.gemini_live_current_source?.stop();
		this.gemini_live_current_source = null;
		setTimeout(() => {
			if (this.gemini_live_audio_gain)
				this.gemini_live_audio_gain.gain.value = this.audio_muted ? 0 : 1;
		}, 200);
	}

	async sendChatMessage(text: string, hidden_prefix?: string) {
		if (!text.trim() && this.pending_images.length === 0) return;
		if (!this.gemini_live_can_send()) {
			this.add_toast('Start voice chat first to send messages', 'e');
			return;
		}
		const t = text.trim();
		const send_text = this.silent_mode ? `silent mode on. ${t}` : t;
		this.pending_clear = false;
		const imgs = this.pending_images;
		this.pending_images = [];
		this.chat_input = '';
		if (this.chat_input_ref) this.chat_input_ref.style.height = 'auto';
		this.output_turn_active = false;
		this.chat_messages = [
			...this.chat_messages,
			{ role: 'user', content: t || '(image)', images: imgs.length ? imgs : undefined }
		];
		try {
			const parts: Record<string, unknown>[] = [];
			for (const img of imgs) {
				const mime = img.split(';')[0].split(':')[1];
				const data = img.split(',')[1];
				parts.push({ media: { data, mimeType: mime } });
			}
			if (t) parts.push({ text: hidden_prefix ? `${hidden_prefix}\n\nUser: ${send_text}` : send_text });
			for (const p of parts) {
				this.gemini_live_session.sendRealtimeInput(p);
			}
		} catch {}
	}

	async sendChatMessageWithDeepSearch(text: string) {
		const prefix = `[SYSTEM OVERRIDE: Before answering, you MUST use the exa_search tool with type='deep-reasoning' to search the web for current information about the user's query]`;
		return this.sendChatMessage(text, prefix);
	}

	stopChat() {
		if (this.chat_abort) {
			this.chat_abort.abort();
			this.chat_abort = null;
			this.chat_loading = false;
		}
	}

	clearChat() {
		this.chat_messages = [];
		this.chat_queue = [];
		this.chat_loading = false;
		this.output_turn_active = false;
	}
}

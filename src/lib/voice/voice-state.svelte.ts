import { browser } from '$app/environment';
import { getContext, setContext } from 'svelte';
import { get_tool_declarations } from './gemini-live-dispatcher';
import type { ChatMsg, Note } from './types';
import { model_options } from './types';

let note_id_counter = 0;
function new_note_id() { return 'n' + (++note_id_counter); }

const SYS = `You are a helpful voice assistant. Keep responses extremely short — 1-3 sentences. Plain language, like talking to a friend. When the conversation starts, greet the user.

You have a tool called exa_search that searches the web. ALWAYS use exa_search for any query that might be time-sensitive, period-sensitive, or about recent events, news, prices, weather, dates, releases, or anything that may have changed recently. When in doubt, search.

When you use exa_search and produce a response based on the results, ALWAYS include the phrase "i searched the net" in your response.

You also have a tool called clear_chat that clears all chat messages. Use it when the user asks you to clear the chat or start over.

You also have note tools for working with the user's notes. read_note to read a note, edit_note to edit, list_notes to list all notes, add_note to create, delete_note to remove, rename_note to rename. Each note has a title and content. Always refer to the note title when talking to the user, not the id.`;
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
	audio_muted = $state(false);

	gemini_live_session: any = null;
	gemini_live_audio_ctx: AudioContext | null = null;
	gemini_live_audio_gain: GainNode | null = null;
	gemini_live_voice_gain: GainNode | null = null;
	gemini_live_mic_stream: MediaStream | null = null;
	gemini_live_processor: ScriptProcessorNode | null = null;
	gemini_live_audio_queue: AudioBuffer[] = [];
	gemini_live_audio_playing = false;
	gemini_live_current_source: AudioBufferSourceNode | null = null;

	gemini_live_healthy = false;
	gemini_live_closing = false;

	rnnoise_node: AudioWorkletNode | null = null;

	thinking_sound: { source: AudioBufferSourceNode; gain: GainNode } | null = null;
	thinking_sound_buf: AudioBuffer | null = null;

	chat_messages = $state<ChatMsg[]>([]);
	chat_queue = $state<{ text: string }[]>([]);
	chat_loading = $state(false);
	chat_abort: AbortController | null = null;
	chat_input = $state('');
	chat_body: HTMLDivElement | null = null;
	chat_input_ref: HTMLTextAreaElement | null = null;

	output_turn_active = false;

	model = $state(browser && localStorage.getItem('model') || model_options[0].v);
	voice_name = $state(browser && localStorage.getItem('voice_name') || 'Kore');
	noise_suppression = $state(browser && localStorage.getItem('noise_suppression') !== 'false');
	voice_gain = $state(browser ? parseFloat(localStorage.getItem('voice_gain') ?? '1') : 1);
	quiet = $state(browser && localStorage.getItem('quiet') === 'true');
	gemini_key = $state(browser && localStorage.getItem('gemini_key') || '');
	exa_key = $state(browser && localStorage.getItem('exa_key') || '');
	notes = $state<Note[]>(browser ? JSON.parse(localStorage.getItem('notes') || '[]') : []);
	active_note_id = $state(browser ? (localStorage.getItem('active_note_id') || '') : '');
	show_note = $state(browser && localStorage.getItem('show_note') !== 'false');

	get active_note(): Note | undefined {
		return this.notes.find(n => n.id === this.active_note_id);
	}

	get note_content(): string {
		return this.active_note?.content ?? '';
	}

	set note_content(val: string) {
		const n = this.active_note;
		if (n) {
			n.content = val;
			this.notes = [...this.notes];
		}
	}

	show_settings = $state(false);
	show_voice_menu = $state(false);
	show_model_menu = $state(false);

	toasts = $state<{ id: number; msg: string; t: string }[]>([]);
	toast_id = $state(0);

	constructor() {
		note_id_counter = Math.max(0, ...this.notes.map(n => {
			const m = n.id.match(/^n(\d+)$/);
			return m ? parseInt(m[1], 10) : 0;
		}));
		if (this.notes.length === 0) {
			this.notes = [{ id: new_note_id(), title: 'Note', content: '' }];
		}
		if (!this.active_note_id || !this.notes.find(n => n.id === this.active_note_id)) {
			this.active_note_id = this.notes[0].id;
		}
		$effect(() => {
			return () => { this.cleanup(); };
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
			if (browser) localStorage.setItem('gemini_key', this.gemini_key);
		});
		$effect(() => {
			if (browser) localStorage.setItem('exa_key', this.exa_key);
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
			requestAnimationFrame(() => { el.scrollTop = el.scrollHeight; });
		});
	}

	log(msg: string) {
		console.log('[voice] ' + msg);
	}

	add_toast(msg: string, t: 'e' | 'i' = 'i') {
		const id = ++this.toast_id;
		this.toasts = [...this.toasts, { id, msg, t }];
		setTimeout(() => this.toasts = this.toasts.filter(t => t.id !== id), 4000);
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
			this.gemini_live_mic_stream.getTracks().forEach(t => t.stop());
			this.gemini_live_mic_stream = null;
		}

		const session = this.gemini_live_session;
		this.gemini_live_session = null;
		if (session) {
			try { session.close(); } catch {}
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
		this.thinking_sound_buf = null;
		this.thinking_sound = null;
		this.chat_loading = false;
		this.log('cleanup: done');
	}

	toggleMicMute() {
		this.voice_muted = !this.voice_muted;
	}

	toggleSpeakerMute() {
		this.audio_muted = !this.audio_muted;
		if (this.gemini_live_audio_gain) {
			this.gemini_live_audio_gain.gain.value = this.audio_muted ? 0 : 1;
		}
	}

	async load_thinking_sound() {
		if (this.thinking_sound_buf) return;
		try {
			const ctx = this.gemini_live_audio_ctx;
			if (!ctx) return;
			const res = await fetch('/sounds/thinking.wav');
			if (!res.ok) return;
			const array_buf = await res.arrayBuffer();
			this.thinking_sound_buf = await ctx.decodeAudioData(array_buf);
		} catch {}
	}

	start_thinking_sound() {
		const ctx = this.gemini_live_audio_ctx;
		if (!ctx || this.thinking_sound || !this.thinking_sound_buf) return;
		try {
			const source = ctx.createBufferSource();
			source.buffer = this.thinking_sound_buf;
			source.loop = true;
			const gain = ctx.createGain();
			gain.gain.setValueAtTime(0, ctx.currentTime);
			gain.gain.linearRampToValueAtTime(0.5, ctx.currentTime + 0.3);
			source.connect(gain);
			gain.connect(ctx.destination);
			source.start();
			this.thinking_sound = { source, gain };
		} catch {}
	}

	stop_thinking_sound() {
		if (!this.thinking_sound) return;
		const { source, gain } = this.thinking_sound;
		const ctx = this.gemini_live_audio_ctx;
		if (ctx) {
			gain.gain.cancelScheduledValues(ctx.currentTime);
			gain.gain.setValueAtTime(gain.gain.value, ctx.currentTime);
			gain.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.5);
			source.stop(ctx.currentTime + 0.6);
		} else {
			source.stop();
		}
		this.thinking_sound = null;
	}

	async toggleVoiceChat() {
		if (this.gemini_live_session) {
			this.cleanup();
			return;
		}
		this.gemini_live_closing = false;
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
					const { RnnoiseWorkletNode, loadRnnoise } = await import('@sapphi-red/web-noise-suppressor');
					const wasmBinary = await loadRnnoise(
						{ url: '/rnnoise.wasm', simdUrl: '/rnnoise_simd.wasm' }
					);
					await audioCtx.audioWorklet.addModule('/rnnoise-worklet.js');
					const rnnoiseNode = new RnnoiseWorkletNode(audioCtx, {
						maxChannels: 1,
						wasmBinary,
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
						this.add_toast('Voice connected');
					},
					onmessage: (msg: any) => { this.gemini_live_handle(msg); },
					onerror: (e: any) => {
						this.log('onerror code=' + e?.code + ' reason=' + e?.reason + ' message=' + e?.message + ' error=' + (e?.error?.message ?? e?.error ?? ''));
						this.gemini_live_healthy = false;
						if (!this.gemini_live_closing) this.cleanup();
					},
					onclose: (e?: any) => {
						this.log('onclose code=' + e?.code + ' reason="' + e?.reason + '" wasClean=' + e?.wasClean);
						this.gemini_live_healthy = false;
						if (!this.gemini_live_closing) this.cleanup();
					},
				},
				config: {
					responseModalities: ['AUDIO'] as any,
					speechConfig: {
						voiceConfig: {
							prebuiltVoiceConfig: { voiceName: this.voice_name },
						},
					} as any,
					systemInstruction: { parts: [{ text: SYS }] } as any,
					tools: get_tool_declarations(),
				} as any,
			});
			this.gemini_live_session = session;
			try { session.sendRealtimeInput({ text: 'Hello' }); } catch {}
		} catch (e) {
			if (e instanceof DOMException && e.name === 'NotFoundError') {
				try {
					const devices = await navigator.mediaDevices.enumerateDevices();
					const audio_inputs = devices.filter(d => d.kind === 'audioinput');
					this.add_toast(audio_inputs.length === 0
						? 'No microphone detected'
						: 'Mic found but could not access it', 'e');
				} catch {
					this.add_toast('No microphone found', 'e');
				}
			} else {
				this.add_toast('Voice setup error: ' + (e instanceof Error ? e.message : String(e)), 'e');
			}
			this.cleanup();
		}
	}

	gemini_process_audio = (e: AudioProcessingEvent) => {
		if (this.voice_muted || this.gemini_live_closing) return;
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
					audio: { data: btoa(binary), mimeType: 'audio/pcm;rate=16000' },
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
		try {
			this.gemini_live_session.sendToolResponse(input);
		} catch {}
	}

	note_for_id(note_id?: string): Note | undefined {
		if (note_id) return this.notes.find(n => n.id === note_id);
		return this.active_note;
	}

	read_note(note_id?: string, offset = 1, limit = 2000): string {
		const note = this.note_for_id(note_id);
		if (!note) return 'Error: Note not found.';
		const lines = note.content.split('\n');
		const start = Math.max(0, offset - 1);
		const sliced = lines.slice(start, start + limit);
		const total = lines.length;
		const last = start + sliced.length;
		let out = `Note: "${note.title}"\n`;
		out += sliced.map((line, i) => `${start + i + 1}: ${line}`).join('\n');
		if (last < total) out += `\n(Showing lines ${offset}-${last} of ${total}. Use offset=${last + 1} to continue.)`;
		else out += `\n(End - total ${total} lines)`;
		return out;
	}

	edit_note(oldString: string, newString: string, replaceAll = false, note_id?: string): string {
		const note = this.note_for_id(note_id);
		if (!note) return 'Error: Note not found.';
		if (oldString === '') {
			note.content = note.content + newString;
			this.notes = [...this.notes];
			return 'Appended to note.';
		}
		const content = note.content;
		if (replaceAll) {
			const count = content.split(oldString).length - 1;
			if (count === 0) return 'Error: oldString not found in note.';
			note.content = content.split(oldString).join(newString);
			this.notes = [...this.notes];
			return `Replaced ${count} occurrence(s) in note.`;
		}
		const first = content.indexOf(oldString);
		if (first === -1) return 'Error: oldString not found in note.';
		const last_c = content.lastIndexOf(oldString);
		if (first !== last_c) return 'Error: Found multiple matches. Use replaceAll or provide more context.';
		note.content = content.substring(0, first) + newString + content.substring(first + oldString.length);
		this.notes = [...this.notes];
		return 'Edited note.';
	}

	list_notes(): string {
		return this.notes.map(n => `- ${n.id}: "${n.title}" (${n.content.split('\n').length} lines)${n.id === this.active_note_id ? ' [active]' : ''}`).join('\n');
	}

	add_note(title = 'Note', content = ''): string {
		const id = new_note_id();
		this.notes = [...this.notes, { id, title, content }];
		this.active_note_id = id;
		return `Created note "${title}" (id: ${id}).`;
	}

	delete_note(note_id: string): string {
		const idx = this.notes.findIndex(n => n.id === note_id);
		if (idx === -1) return 'Error: Note not found.';
		if (this.notes.length <= 1) return 'Error: Cannot delete the last note.';
		this.notes = this.notes.filter(n => n.id !== note_id);
		if (this.active_note_id === note_id) {
			this.active_note_id = this.notes[0].id;
		}
		return 'Deleted note.';
	}

	rename_note(title: string, note_id?: string): string {
		const note = this.note_for_id(note_id);
		if (!note) return 'Error: Note not found.';
		note.title = title;
		this.notes = [...this.notes];
		return `Renamed note to "${title}".`;
	}

	gemini_live_handle(msg: any) {
		if (msg.serverContent) {
			console.log('[voice] serverContent:', JSON.stringify({ ...msg.serverContent, modelTurn: msg.serverContent.modelTurn ? { parts: msg.serverContent.modelTurn.parts?.map((p: any) => ({ ...p, inlineData: p.inlineData ? { mimeType: p.inlineData.mimeType, data: p.inlineData.data?.slice(0, 50) + '...' } : undefined })) } : undefined }));
		}
		if (msg.toolCall?.functionCalls?.length) {
			this.interrupt_audio();
			this.start_thinking_sound();
			(async () => {
				for (const fc of msg.toolCall.functionCalls) {
					if (fc.name === 'exa_search') {
						try {
							const body: Record<string, unknown> = { query: fc.args.query, type: fc.args.type };
							if (this.exa_key) body.apiKey = this.exa_key;
							const res = await fetch('/api/voice/exa-search', {
								method: 'POST',
								headers: { 'Content-Type': 'application/json' },
								body: JSON.stringify(body),
							});
							const data = await res.json();
							const snippets = data.results?.map((r: any) =>
								`Title: ${r.title}\nURL: ${r.url}\nSnippet: ${(r.highlights?.[0] || r.text?.slice(0, 500) || '')}`
							).join('\n\n') || 'No results found';
							this.send_gemini_tool_response({
								functionResponses: [{ id: fc.id, name: fc.name, response: { result: snippets } }],
							});
						} catch (e) {
							this.send_gemini_tool_response({
								functionResponses: [{ id: fc.id, name: fc.name, response: { error: String(e) } }],
							});
						}
					} else if (fc.name === 'read_note') {
						const lines = this.read_note(fc.args.note_id, fc.args.offset ?? 1, fc.args.limit ?? 2000);
						this.send_gemini_tool_response({
							functionResponses: [{ id: fc.id, name: fc.name, response: { result: lines } }],
						});
					} else if (fc.name === 'edit_note') {
						const result = this.edit_note(fc.args.oldString ?? '', fc.args.newString ?? '', fc.args.replaceAll ?? false, fc.args.note_id);
						this.send_gemini_tool_response({
							functionResponses: [{ id: fc.id, name: fc.name, response: { result } }],
						});
					} else if (fc.name === 'clear_chat') {
						this.clearChat();
						this.send_gemini_tool_response({
							functionResponses: [{ id: fc.id, name: fc.name, response: { result: 'Chat cleared.' } }],
						});
					} else if (fc.name === 'list_notes') {
						this.send_gemini_tool_response({
							functionResponses: [{ id: fc.id, name: fc.name, response: { result: this.list_notes() } }],
						});
					} else if (fc.name === 'add_note') {
						const result = this.add_note(fc.args.title, fc.args.content);
						this.send_gemini_tool_response({
							functionResponses: [{ id: fc.id, name: fc.name, response: { result } }],
						});
					} else if (fc.name === 'delete_note') {
						const result = this.delete_note(fc.args.note_id);
						this.send_gemini_tool_response({
							functionResponses: [{ id: fc.id, name: fc.name, response: { result } }],
						});
					} else if (fc.name === 'rename_note') {
						const result = this.rename_note(fc.args.title, fc.args.note_id);
						this.send_gemini_tool_response({
							functionResponses: [{ id: fc.id, name: fc.name, response: { result } }],
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
					} catch (e) { console.log('[voice] audio decode error:', e); }
				}
			}
			if (audio_count === 0) console.log('[voice] modelTurn with no audio parts — parts:', msg.serverContent.modelTurn.parts?.map((p: any) => Object.keys(p)));
		}
		if (msg.serverContent?.interrupted) {
			this.interrupt_audio();
		}
		if (msg.serverContent?.inputTranscription?.text) {
			const text = msg.serverContent.inputTranscription.text;
			this.output_turn_active = false;
			this.chat_messages = [...this.chat_messages, { role: 'user', content: text }];
		}
		if (msg.serverContent?.outputTranscription?.text) {
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
			this.output_turn_active = false;
		}
	}

	play_next_audio() {
		if (!this.gemini_live_audio_ctx || !this.gemini_live_audio_gain || this.gemini_live_audio_playing || this.gemini_live_audio_queue.length === 0) return;
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
			if (this.gemini_live_audio_gain) this.gemini_live_audio_gain.gain.value = 1;
		}, 200);
	}

	async sendChatMessage(text: string) {
		if (!text.trim()) return;
		const t = text.trim();
		this.chat_input = '';
		if (this.chat_input_ref) this.chat_input_ref.style.height = 'auto';
		if (this.gemini_live_can_send()) {
			this.output_turn_active = false;
			this.chat_messages = [...this.chat_messages, { role: 'user', content: t }];
			try {
				this.gemini_live_session.sendRealtimeInput({ text: t });
			} catch {}
		} else {
			this.add_toast('Start voice chat first to send messages', 'e');
		}
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

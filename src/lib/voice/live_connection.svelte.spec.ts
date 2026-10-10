import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { LiveConnectParameters } from '@google/genai';
import { VoiceState } from './voice-state.svelte';

const connect = vi.hoisted(() => vi.fn());
vi.mock('@google/genai', () => ({
	GoogleGenAI: class {
		live = { connect };
	}
}));
vi.mock('cuelume', () => ({ play: vi.fn() }));

let dispose: () => void;

function make() {
	let state!: VoiceState;
	dispose = $effect.root(() => {
		state = new VoiceState();
	});
	state.gemini_key = 'test-key';
	state.noise_suppression = false;
	state.live_wanted = true;
	vi.spyOn(state, 'load_thinking_sound').mockResolvedValue();
	return state;
}

function session() {
	return {
		conn: { ws: { readyState: WebSocket.OPEN as number } },
		sendRealtimeInput: vi.fn(),
		sendToolResponse: vi.fn(),
		close: vi.fn()
	};
}

function callbacks() {
	return (connect.mock.lastCall![0] as LiveConnectParameters).callbacks;
}

function setup_complete() {
	callbacks().onmessage({ setupComplete: {}, text: undefined, data: undefined });
}

async function started() {
	await vi.waitFor(() => expect(connect).toHaveBeenCalled());
}

beforeEach(() => {
	localStorage.clear();
	connect.mockReset();
	vi.spyOn(navigator.mediaDevices, 'getUserMedia').mockResolvedValue({
		getTracks: () => [{ stop: vi.fn() }]
	} as unknown as MediaStream);
	vi.stubGlobal(
		'AudioContext',
		class {
			currentTime = 0;
			destination = {};
			createGain() {
				return {
					connect: vi.fn(),
					disconnect: vi.fn(),
					gain: {
						value: 0,
						cancelScheduledValues: vi.fn(),
						setValueAtTime: vi.fn(),
						linearRampToValueAtTime: vi.fn()
					}
				};
			}
			createMediaStreamSource() {
				return { connect: vi.fn() };
			}
			createScriptProcessor() {
				return { connect: vi.fn(), disconnect: vi.fn(), onaudioprocess: null };
			}
			close() {
				return Promise.resolve();
			}
		}
	);
});

afterEach(() => {
	dispose?.();
	vi.restoreAllMocks();
	vi.unstubAllGlobals();
	vi.useRealTimers();
});

describe('voice connection lifecycle', () => {
	it('waits for setup after transport open before greeting or sending audio', async () => {
		const v = make();
		const s = session();
		connect.mockResolvedValue(s);
		v.fail_streak = 4;
		const attempt = v.connectLive();
		await started();
		callbacks().onopen?.();
		v.gemini_process_audio({} as AudioProcessingEvent);
		expect(v.recording).toBe(false);
		expect(v.fail_streak).toBe(4);
		expect(s.sendRealtimeInput).not.toHaveBeenCalled();
		setup_complete();
		await attempt;
		expect(v.recording).toBe(true);
		expect(s.sendRealtimeInput).toHaveBeenCalledExactlyOnceWith({ text: 'Hello' });
	});

	it('waits for the session if setup arrives first', async () => {
		const v = make();
		const s = session();
		let resolve!: (value: typeof s) => void;
		connect.mockReturnValue(new Promise((done) => (resolve = done)));
		const attempt = v.connectLive();
		await started();
		setup_complete();
		expect(v.recording).toBe(false);
		resolve(s);
		await attempt;
		expect(v.recording).toBe(true);
		expect(s.sendRealtimeInput).toHaveBeenCalledOnce();
	});

	it('stops authentication rejection immediately and closes a late session', async () => {
		const v = make();
		const s = session();
		let resolve!: (value: typeof s) => void;
		connect.mockReturnValue(new Promise((done) => (resolve = done)));
		const attempt = v.connectLive();
		await started();
		callbacks().onopen?.();
		callbacks().onclose?.(
			new CloseEvent('close', { code: 1008, reason: 'invalid authentication credentials' })
		);
		await attempt;
		expect(v.live_wanted).toBe(false);
		expect(v.recording).toBe(false);
		expect(v.connecting).toBe(false);
		expect(v.pending_reconnect).toBe(false);
		expect(v.gemini_live_mic_stream).toBeNull();
		expect(v.toasts.filter((t) => t.t === 'e')).toHaveLength(1);
		resolve(s);
		await vi.waitFor(() => expect(s.close).toHaveBeenCalledOnce());
		expect(s.sendRealtimeInput).not.toHaveBeenCalled();
		expect(connect).toHaveBeenCalledOnce();
	});

	it('settles a close after setup even if the SDK session promise never resolves', async () => {
		const v = make();
		connect.mockReturnValue(new Promise(() => {}));
		vi.spyOn(v, 'auto_reconnect').mockResolvedValue();
		const attempt = v.connectLive();
		await started();
		setup_complete();
		callbacks().onclose?.(new CloseEvent('close', { code: 1006 }));
		await attempt;
		expect(v.connecting).toBe(false);
		expect(v.recording).toBe(false);
		expect(v.auto_reconnect).toHaveBeenCalledOnce();
	});

	it('blocks every send while the socket is closing', async () => {
		const v = make();
		const s = session();
		connect.mockResolvedValue(s);
		const attempt = v.connectLive();
		await started();
		setup_complete();
		await attempt;
		s.sendRealtimeInput.mockClear();
		s.conn.ws.readyState = WebSocket.CLOSING;
		v.gemini_process_audio({} as AudioProcessingEvent);
		v.toggle_quiet_mode();
		v.send_gemini_tool_response({ functionResponses: [] });
		v.push_staleness_notice(v.active_note!);
		await v.sendChatMessage('hello');
		expect(v.gemini_live_can_send()).toBe(false);
		expect(s.sendRealtimeInput).not.toHaveBeenCalled();
		expect(s.sendToolResponse).not.toHaveBeenCalled();
	});

	it('bounds a connection attempt before transport open', async () => {
		const v = make();
		connect.mockReturnValue(new Promise(() => {}));
		vi.spyOn(v, 'auto_reconnect').mockResolvedValue();
		vi.useFakeTimers();
		const attempt = v.connectLive();
		await started();
		await vi.advanceTimersByTimeAsync(15000);
		await attempt;
		expect(v.connecting).toBe(false);
		expect(v.recording).toBe(false);
		expect(v.auto_reconnect).toHaveBeenCalledOnce();
	});

	it('exhausts transient retries even when every transport opens', async () => {
		const v = make();
		vi.spyOn(v, 'add_toast');
		connect.mockImplementation((p: LiveConnectParameters) => {
			p.callbacks.onopen?.();
			p.callbacks.onclose?.(new CloseEvent('close', { code: 1006 }));
			return Promise.resolve(session());
		});
		vi.useFakeTimers();
		v.trigger_reconnect();
		await started();
		await vi.advanceTimersByTimeAsync(30000);
		expect(connect).toHaveBeenCalledTimes(5);
		expect(v.live_wanted).toBe(false);
		expect(v.reconnecting).toBe(false);
		expect(v.add_toast).toHaveBeenCalledWith('voice dropped — tap the mic to retry', 'e');
	});

	it('cannot restart an old retry after a manual stop and new start', async () => {
		const v = make();
		v.fail_streak = 1;
		vi.useFakeTimers();
		v.trigger_reconnect();
		expect(v.reconnecting).toBe(true);
		v.cleanup();
		v.live_wanted = true;
		v.gemini_live_closing = false;
		v.reconnecting = true;
		await vi.advanceTimersByTimeAsync(400);
		expect(connect).not.toHaveBeenCalled();
		expect(v.reconnecting).toBe(true);
	});

	it('uses groq text chat when voice is off', async () => {
		const v = make();
		v.live_wanted = false;
		vi.spyOn(globalThis, 'fetch').mockResolvedValue(Response.json({ t: 'groq hi' }));
		await v.sendChatMessage('hello');
		expect(v.chat_messages).toEqual([
			{ role: 'user', content: 'hello' },
			{ role: 'assistant', content: 'groq hi' }
		]);
		const [url, init] = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0] as [
			string,
			RequestInit
		];
		expect(url).toBe('/api/chat');
		expect(JSON.parse(init.body as string).m.at(-1)).toEqual({ role: 'user', content: 'hello' });
	});

	it('ends a failed token request without opening a socket', async () => {
		const v = make();
		v.gemini_key = '';
		vi.spyOn(globalThis, 'fetch').mockResolvedValue(
			Response.json({ e: 'voice authentication unavailable' }, { status: 503 })
		);
		await v.connectLive();
		expect(connect).not.toHaveBeenCalled();
		expect(v.live_wanted).toBe(false);
		expect(v.gemini_live_mic_stream).toBeNull();
		expect(v.toasts.filter((t) => t.t === 'e')).toHaveLength(1);
	});
});

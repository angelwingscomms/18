import { describe, it, expect, beforeEach, vi } from 'vitest';
import { AudioQueue } from './audio-queue';

let mockCtx: any;

function MockAudioContext() {
	return mockCtx;
}

function makeMockContext() {
	return {
		currentTime: 0,
		suspend: vi.fn(),
		resume: vi.fn(),
		close: vi.fn(),
		state: 'running',
		createBuffer: vi.fn(() => ({ duration: 1, getChannelData: vi.fn(() => new Float32Array(100)) })),
		createBufferSource: vi.fn(() => ({ buffer: null, connect: vi.fn(), start: vi.fn(), onended: null })),
		destination: {},
	};
}

describe('AudioQueue', () => {
	beforeEach(() => {
		mockCtx = makeMockContext();
		vi.stubGlobal('AudioContext', MockAudioContext);
	});

	it('creates instance', () => {
		const q = new AudioQueue();
		expect(q).toBeTruthy();
	});

	it('starts not playing and not paused', () => {
		const q = new AudioQueue();
		expect(q.isPlaying).toBe(false);
		expect(q.isPaused).toBe(false);
	});

	it('dispose closes context', () => {
		const ctx = makeMockContext();
		mockCtx = ctx;
		vi.stubGlobal('AudioContext', function () { return ctx; });
		const q = new AudioQueue();
		q.dispose();
		expect(ctx.close).toHaveBeenCalled();
	});
});

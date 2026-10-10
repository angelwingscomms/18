import { beforeEach, describe, expect, it, vi } from 'vitest';
import { GET } from '../../routes/api/voice/gemini-live/key/+server';

const mocks = vi.hoisted(() => ({ create: vi.fn(), constructor: vi.fn() }));
vi.mock('@google/genai', () => ({
	Modality: { AUDIO: 'AUDIO' },
	GoogleGenAI: class {
		authTokens = { create: mocks.create };
		constructor(options: unknown) {
			mocks.constructor(options);
		}
	}
}));

beforeEach(() => {
	vi.clearAllMocks();
	mocks.create.mockResolvedValue({ name: 'auth_tokens/test' });
});

describe('free voice tokens', () => {
	it.each([null, { id: 'zero-balance-user' }])(
		'issues a token for user %j without charging',
		async (user) => {
			const key = vi.fn().mockResolvedValue(' private-key ');
			const response = await GET({
				locals: { user },
				platform: { env: { GEMINI: { get: key } } }
			} as unknown as Parameters<typeof GET>[0]);
			expect(response.status).toBe(200);
			expect(await response.json()).toEqual({ k: 'auth_tokens/test' });
			expect(response.headers.get('Cache-Control')).toBe('no-store');
			expect(mocks.constructor).toHaveBeenCalledWith({
				apiKey: 'private-key',
				httpOptions: { apiVersion: 'v1alpha', timeout: 10000 }
			});
			expect(mocks.create.mock.lastCall![0].config.uses).toBe(1);
		}
	);

	it('supports the local development key binding', async () => {
		const response = await GET({
			platform: { env: { GEMINI: 'local-key' } }
		} as unknown as Parameters<typeof GET>[0]);
		expect(response.status).toBe(200);
		expect(await response.json()).toEqual({ k: 'auth_tokens/test' });
	});

	it('returns a private, bounded error on issuance failure', async () => {
		mocks.create.mockRejectedValue(new Error('upstream contains private-key'));
		const response = await GET({
			platform: { env: { GEMINI: 'private-key' } }
		} as unknown as Parameters<typeof GET>[0]);
		expect(response.status).toBe(503);
		expect(await response.json()).toEqual({ e: 'voice authentication unavailable' });
		expect(response.headers.get('Cache-Control')).toBe('no-store');
	});
});

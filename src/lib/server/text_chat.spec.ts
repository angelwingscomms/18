import { beforeEach, describe, expect, it, vi } from 'vitest';
import { POST } from '../../routes/api/chat/+server';

const fetch_mock = vi.fn();

beforeEach(() => {
	vi.stubGlobal('fetch', fetch_mock);
	fetch_mock.mockReset();
	fetch_mock.mockResolvedValue(
		Response.json({ choices: [{ message: { content: ' hello from groq ' } }] })
	);
});

describe('text chat', () => {
	it('replies with gpt-oss-120b and no reasoning', async () => {
		const key = vi.fn().mockResolvedValue(' private-groq ');
		const response = await POST({
			request: new Request('http://local/api/chat', {
				method: 'POST',
				body: JSON.stringify({ m: [{ role: 'user', content: 'hi' }] })
			}),
			platform: { env: { GROQ: { get: key } } }
		} as unknown as Parameters<typeof POST>[0]);
		expect(response.status).toBe(200);
		expect(await response.json()).toEqual({ t: 'hello from groq' });
		expect(response.headers.get('Cache-Control')).toBe('no-store');
		expect(fetch_mock).toHaveBeenCalledOnce();
		const [url, init] = fetch_mock.mock.calls[0] as [string, RequestInit];
		expect(url).toBe('https://api.groq.com/openai/v1/chat/completions');
		expect((init.headers as Record<string, string>).Authorization).toBe('Bearer private-groq');
		const body = JSON.parse(init.body as string);
		expect(body.model).toBe('openai/gpt-oss-120b');
		expect(body.include_reasoning).toBe(false);
		expect(body.messages.at(-1)).toEqual({ role: 'user', content: 'hi' });
	});

	it('uses an optional client groq key', async () => {
		await POST({
			request: new Request('http://local/api/chat', {
				method: 'POST',
				body: JSON.stringify({ m: [{ role: 'user', content: 'hi' }], k: ' byok ' })
			}),
			platform: { env: { GROQ: { get: vi.fn() } } }
		} as unknown as Parameters<typeof POST>[0]);
		const init = fetch_mock.mock.calls[0][1] as RequestInit;
		expect((init.headers as Record<string, string>).Authorization).toBe('Bearer byok');
	});

	it('returns a private error when groq fails', async () => {
		fetch_mock.mockResolvedValue(new Response('upstream leaked key', { status: 401 }));
		const response = await POST({
			request: new Request('http://local/api/chat', {
				method: 'POST',
				body: JSON.stringify({ m: [{ role: 'user', content: 'hi' }] })
			}),
			platform: { env: { GROQ: 'local-key' } }
		} as unknown as Parameters<typeof POST>[0]);
		expect(response.status).toBe(503);
		expect(await response.json()).toEqual({ e: 'text chat unavailable' });
		expect(response.headers.get('Cache-Control')).toBe('no-store');
	});
});

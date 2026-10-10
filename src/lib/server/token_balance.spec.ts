import { createHash } from 'node:crypto';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
	retrieve: vi.fn(),
	upsert: vi.fn(),
	decode_session: vi.fn(),
	get_user: vi.fn()
}));

vi.mock('@qdrant/js-client-rest', () => ({
	QdrantClient: class {
		retrieve = mocks.retrieve;
		upsert = mocks.upsert;
	}
}));

vi.mock('$lib/server/session', () => ({
	decode_session: mocks.decode_session
}));

vi.mock('$lib/server/user', () => ({
	get_user: mocks.get_user
}));

const USER_ID = 'synthetic-user';
const SESSION = 'synthetic-session';
const DAILY_AMOUNT = 5400;
const DAY_S = 86400;

function id_to_uuid(s: string): string {
	const h = createHash('sha1').update(s).digest('hex');
	return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20, 32)}`;
}

function env() {
	return {
		QDRANT_URL: { get: vi.fn().mockResolvedValue('https://qdrant.test') },
		QDRANT_KEY: { get: vi.fn().mockResolvedValue('synthetic-qdrant-key') }
	};
}

describe('token balance daily credit', () => {
	beforeEach(async () => {
		vi.resetModules();
		vi.clearAllMocks();
		mocks.upsert.mockImplementation(async (_c: string, body: { points: { vector: unknown }[] }) => {
			for (const p of body.points) {
				if (Array.isArray(p.vector) || p.vector == null || typeof p.vector !== 'object' || Object.keys(p.vector).length !== 0) {
					throw new Error('vector must be empty object');
				}
			}
		});
		mocks.decode_session.mockResolvedValue({ user: { id: USER_ID, name: 'Test' } });
		mocks.get_user.mockResolvedValue({ s: 'u', n: 'Test', d: 1 });
	});

	async function load_balance(daily: number, bal = 100) {
		mocks.retrieve.mockResolvedValue([{ payload: { t: bal, u: USER_ID, d: daily } }]);
		const { load } = await import('../../routes/+layout.server');
		const { get_balance } = await import('./token_balance');
		const platform = { env: env() };
		const result = await load({
			cookies: { get: (n: string) => (n === 'session' ? SESSION : undefined) },
			platform
		} as unknown as Parameters<typeof load>[0]);
		const helper = await get_balance({ platform }, USER_ID, platform.env as unknown as Env);
		return { result, helper };
	}

	it('returns today credit without upsert', async () => {
		const now = Math.floor(Date.now() / 1000);
		const { result, helper } = await load_balance(now, 100);
		expect(result.balance).toBe(100);
		expect(helper).toBe(100);
		expect(result.user).toEqual({ id: USER_ID, name: 'Test' });
		expect(mocks.upsert).not.toHaveBeenCalled();
	});

	it('credits 5400 when daily is overdue and upserts an empty vector', async () => {
		const now = Math.floor(Date.now() / 1000);
		const { result, helper } = await load_balance(now - DAY_S, 100);
		expect(result.balance).toBe(100 + DAILY_AMOUNT);
		expect(helper).toBe(100 + DAILY_AMOUNT);
		expect(mocks.upsert).toHaveBeenCalled();
		const [, body] = mocks.upsert.mock.calls[0] as [string, { points: { id: string; vector: object; payload: { t: number; u: string; d: number } }[] }];
		expect(body.points[0].id).toBe(id_to_uuid(USER_ID));
		expect(body.points[0].vector).toEqual({});
		expect(body.points[0].payload).toEqual({
			t: 100 + DAILY_AMOUNT,
			u: USER_ID,
			d: expect.any(Number)
		});
		expect(body.points[0].payload.d).toBeGreaterThanOrEqual(now);
	});
});

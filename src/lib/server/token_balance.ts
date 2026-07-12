import { createHash } from 'node:crypto';
import { QdrantClient } from '@qdrant/js-client-rest';

const DAILY_AMOUNT = 5400;
const DAY_S = 86400;
const C = 'i';
const local = new Map<string, number>();
const local_daily = new Map<string, number>();
let q: QdrantClient | null = null;

function id_to_uuid(s: string): string {
	const h = createHash('sha1').update(s).digest('hex');
	return `${h.slice(0,8)}-${h.slice(8,12)}-${h.slice(12,16)}-${h.slice(16,20)}-${h.slice(20,32)}`;
}

async function client(env: Env): Promise<QdrantClient> {
	if (!q) {
		const [url, key] = await Promise.all([env.QDRANT_URL.get(), env.QDRANT_KEY.get()]);
		q = new QdrantClient({ url, apiKey: key, checkCompatibility: false });
	}
	return q;
}

const ZV: number[] = new Array(3072).fill(0);

async function read_user(user_id: string, env: Env): Promise<{ bal: number; daily: number }> {
	const pid = id_to_uuid(user_id);
	try {
		const c = await client(env);
		const r = await c.retrieve(C, { ids: [pid] });
		const p = r[0]?.payload;
		return { bal: (p?.t as number) || 0, daily: (p?.d as number) || 0 };
	} catch {
		return { bal: local.get(user_id) || 0, daily: local_daily.get(user_id) || 0 };
	}
}

async function write_user(user_id: string, bal: number, daily: number, env: Env): Promise<void> {
	const pid = id_to_uuid(user_id);
	local.set(user_id, bal);
	local_daily.set(user_id, daily);
	const c = await client(env);
	await c.upsert(C, { points: [{ id: pid, vector: ZV, payload: { t: bal, u: user_id, d: daily } }] });
}

async function write_bal(user_id: string, n: number, env: Env): Promise<void> {
	const { daily } = await read_user(user_id, env);
	await write_user(user_id, n, daily, env);
}

async function maybe_daily_credit(user_id: string, env: Env): Promise<number> {
	const { bal, daily } = await read_user(user_id, env);
	const now = Math.floor(Date.now() / 1000);
	if (now - daily >= DAY_S) {
		const n = bal + DAILY_AMOUNT;
		await write_user(user_id, n, now, env);
		return n;
	}
	return bal;
}

export async function credit(_event: unknown, user_id: string, amount_kobo: number, env: Env): Promise<number> {
	const t = Math.floor(amount_kobo);
	const { bal, daily } = await read_user(user_id, env);
	const n = bal + t;
	await write_user(user_id, n, daily, env);
	return n;
}

export async function get_balance(_event: unknown, user_id: string, env: Env): Promise<number> {
	return maybe_daily_credit(user_id, env);
}

export async function deduct(_event: unknown, user_id: string, amount: number, env: Env): Promise<number> {
	const cur = await maybe_daily_credit(user_id, env);
	const n = Math.max(0, cur - amount);
	await write_bal(user_id, n, env);
	return n;
}

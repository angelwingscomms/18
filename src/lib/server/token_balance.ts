import { createHash } from 'node:crypto';
import { QdrantClient } from '@qdrant/js-client-rest';
import { QDRANT_KEY, QDRANT_URL } from '$env/static/private';
import { env } from '$env/dynamic/private';

export const TOKEN_RATE = Number(env.TOKEN_RATE) || 1.08;
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

function client(): QdrantClient {
	if (!q) q = new QdrantClient({ url: QDRANT_URL, apiKey: QDRANT_KEY, checkCompatibility: false });
	return q;
}

const ZV: number[] = new Array(3072).fill(0);

async function read_user(user_id: string): Promise<{ bal: number; daily: number }> {
	const pid = id_to_uuid(user_id);
	try {
		const r = await client().retrieve(C, { ids: [pid] });
		const p = r[0]?.payload;
		return { bal: (p?.t as number) || 0, daily: (p?.d as number) || 0 };
	} catch {
		return { bal: local.get(user_id) || 0, daily: local_daily.get(user_id) || 0 };
	}
}

async function write_user(user_id: string, bal: number, daily: number): Promise<void> {
	const pid = id_to_uuid(user_id);
	local.set(user_id, bal);
	local_daily.set(user_id, daily);
	await client().upsert(C, { points: [{ id: pid, vector: ZV, payload: { t: bal, u: user_id, d: daily } }] });
}

async function read_bal(user_id: string): Promise<number> {
	return (await read_user(user_id)).bal;
}

async function write_bal(user_id: string, n: number): Promise<void> {
	const { daily } = await read_user(user_id);
	await write_user(user_id, n, daily);
}

export async function maybe_daily_credit(user_id: string): Promise<number> {
	const { bal, daily } = await read_user(user_id);
	const now = Math.floor(Date.now() / 1000);
	if (now - daily >= DAY_S) {
		const n = bal + DAILY_AMOUNT;
		await write_user(user_id, n, now);
		return n;
	}
	return bal;
}

export async function credit(_event: unknown, user_id: string, amount_kobo: number): Promise<number> {
	const t = Math.floor(amount_kobo);
	const { bal, daily } = await read_user(user_id);
	const n = bal + t;
	await write_user(user_id, n, daily);
	return n;
}

export async function get_balance(_event: unknown, user_id: string): Promise<number> {
	return maybe_daily_credit(user_id);
}

export async function deduct(_event: unknown, user_id: string, amount: number): Promise<number> {
	const cur = await maybe_daily_credit(user_id);
	const n = Math.max(0, cur - amount);
	await write_bal(user_id, n);
	return n;
}

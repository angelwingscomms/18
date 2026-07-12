import { QdrantClient } from '@qdrant/js-client-rest';
import type { User } from '$lib/types/user';

const C = 'i';
const local = new Map<string, User>();
let q: QdrantClient | null = null;

async function client(env: Env): Promise<QdrantClient> {
	if (!q) {
		const [url, key] = await Promise.all([env.QDRANT_URL.get(), env.QDRANT_KEY.get()]);
		q = new QdrantClient({ url, apiKey: key, checkCompatibility: false });
	}
	return q;
}

function pid(id: string): string {
	return 'u_' + id;
}

export async function save_user(
	_event: unknown,
	id: string,
	name: string,
	picture?: string,
	email?: string,
	password_hash?: string,
	env?: Env,
): Promise<void> {
	const u: User = { s: 'u', n: name, p: picture, m: email, h: password_hash, d: Date.now() };
	try {
		const c = await client(env!);
		const r = await c.retrieve(C, { ids: [pid(id)] });
		const cur = r[0]?.payload as Record<string, unknown> | undefined;
		if (cur?.s === 'u') {
			u.d = (cur.d as number) || u.d;
			u.h = (cur.h as string) || password_hash;
		}
		await c.upsert(C, { points: [{ id: pid(id), payload: u as unknown as Record<string, unknown> }] });
	} catch {
		local.set(pid(id), u);
	}
}

export async function get_user(_event: unknown, id: string, env: Env): Promise<User | null> {
	try {
		const c = await client(env);
		const r = await c.retrieve(C, { ids: [pid(id)] });
		const u = r[0]?.payload as Record<string, unknown> | undefined;
		if (u?.s === 'u') {
			return { s: 'u', n: u.n as string, p: u.p as string | undefined, m: u.m as string | undefined, h: u.h as string | undefined, d: u.d as number };
		}
		return null;
	} catch {
		return local.get(pid(id)) || null;
	}
}

export async function find_user_by_email(email: string, env: Env): Promise<(User & { i: string }) | null> {
	try {
		const c = await client(env);
		const r = await c.scroll(C, {
			filter: {
				must: [
					{ key: 's', match: { value: 'u' } },
					{ key: 'm', match: { value: email } }
				]
			},
			limit: 1,
			with_payload: true,
			with_vector: false
		});
		const p = r.points[0];
		if (!p) return null;
		const pay = p.payload as Record<string, unknown>;
		return { s: 'u', n: pay.n as string, p: pay.p as string | undefined, m: pay.m as string | undefined, h: pay.h as string | undefined, d: pay.d as number, i: p.id as string };
	} catch {
		for (const [id, u] of local) {
			if (u.m === email) return { ...u, i: id };
		}
		return null;
	}
}

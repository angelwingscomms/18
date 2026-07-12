import { QdrantClient } from '@qdrant/js-client-rest';
import { QDRANT_KEY, QDRANT_URL } from '$env/static/private';
import type { User } from '$lib/types/user';

const C = 'i';
const local = new Map<string, User>();
let q: QdrantClient | null = null;

function client(): QdrantClient {
	if (!q) q = new QdrantClient({ url: QDRANT_URL, apiKey: QDRANT_KEY, checkCompatibility: false });
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
): Promise<void> {
	const u: User = { s: 'u', n: name, p: picture, m: email, h: password_hash, d: Date.now() };
	try {
		const r = await client().retrieve(C, { ids: [pid(id)] });
		const cur = r[0]?.payload as Record<string, unknown> | undefined;
		if (cur?.s === 'u') {
			u.d = (cur.d as number) || u.d;
			u.h = (cur.h as string) || password_hash;
		}
		await client().upsert(C, { points: [{ id: pid(id), payload: u as unknown as Record<string, unknown> }] });
	} catch (e) {
		local.set(pid(id), u);
	}
}

export async function get_user(_event: unknown, id: string): Promise<User | null> {
	try {
		const r = await client().retrieve(C, { ids: [pid(id)] });
		const u = r[0]?.payload as Record<string, unknown> | undefined;
		if (u?.s === 'u') {
			return { s: 'u', n: u.n as string, p: u.p as string | undefined, m: u.m as string | undefined, h: u.h as string | undefined, d: u.d as number };
		}
		return null;
	} catch {
		return local.get(pid(id)) || null;
	}
}

export async function find_user_by_email(email: string): Promise<(User & { i: string }) | null> {
	try {
		const r = await client().scroll(C, {
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

import { json } from '@sveltejs/kit';
import type { RequestHandler } from '@sveltejs/kit';
import { QdrantClient } from '@qdrant/js-client-rest';
import { decode_session } from '$lib/server/session';

const COL = 'notes';
const LEGACY_COL = 'i';
const VECTOR_SIZE = 4096;
const EMBED_MODEL = 'jcorners/ingot-8b-r3';

let qdrant: QdrantClient | null = null;
async function get_client(env: Env): Promise<QdrantClient> {
	if (!qdrant) {
		const [url, key] = await Promise.all([env.QDRANT_URL.get(), env.QDRANT_KEY.get()]);
		qdrant = new QdrantClient({ url, apiKey: key, checkCompatibility: false });
	}
	return qdrant;
}

let ensured = false;
async function ensure_collection(c: QdrantClient) {
	if (ensured) return;
	if (!(await c.collectionExists(COL)).exists) {
		await c.createCollection(COL, { vectors: { size: VECTOR_SIZE, distance: 'Cosine' } });
	}
	ensured = true;
}

async function embed(env: Env, text: string): Promise<number[]> {
	try {
		const key = await env.VOXELL_KEY.get();
		const r = await fetch('https://api.voxell.ai/v1/embeddings', {
			method: 'POST',
			headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
			body: JSON.stringify({ model: EMBED_MODEL, input: text || ' ' })
		});
		if (!r.ok) throw new Error(`voxell embed failed: ${r.status}`);
		const d: any = await r.json();
		return d.data[0].embedding;
	} catch (e) {
		console.error('[qdrant] embed failed, falling back to zero vector', e);
		return new Array(VECTOR_SIZE).fill(0);
	}
}

async function owns(c: QdrantClient, id: string, uid: string): Promise<boolean> {
	const pts = await c.retrieve(COL, { ids: [id], with_payload: true });
	return pts.length === 0 || pts[0].payload?.s === uid;
}

export const POST: RequestHandler = async ({ request, cookies, platform }) => {
	const s = await decode_session(cookies.get('session'), platform!.env);
	const uid = s?.user?.id;
	if (!uid) return json({ ok: false, e: 'not authenticated' });

	const { a: action, i: id, t, b, u, q } = await request.json();
	const env = platform!.env;
	const c = await get_client(env);
	await ensure_collection(c);

	try {
		if (action === 'upsert') {
			if (!id) return json({ ok: false, e: 'id required' });
			if (!(await owns(c, id, uid))) return json({ ok: false, e: 'forbidden' });
			const vector = await embed(env, `${t ?? ''}\n\n${b ?? ''}`);
			await c.upsert(COL, {
				wait: true,
				points: [{ id, vector, payload: { s: uid, t: t ?? '', b: b ?? '', u: u ?? Date.now(), d: 0 } }]
			});
		} else if (action === 'payload') {
			if (!id) return json({ ok: false, e: 'id required' });
			if (!(await owns(c, id, uid))) return json({ ok: false, e: 'forbidden' });
			if (b !== undefined) {
				// content changed — the vector must be recomputed, so this needs a full upsert.
				const existing = await c.retrieve(COL, { ids: [id], with_payload: true });
				const title = t ?? (existing[0]?.payload?.t as string | undefined) ?? '';
				const vector = await embed(env, `${title}\n\n${b}`);
				await c.upsert(COL, {
					wait: true,
					points: [{ id, vector, payload: { s: uid, t: title, b, u: u ?? Date.now(), d: 0 } }]
				});
			} else {
				const p: Record<string, unknown> = {};
				if (t !== undefined) p.t = t;
				if (u !== undefined) p.u = u;
				if (Object.keys(p).length === 0) return json({ ok: false, e: 'no fields' });
				await c.setPayload(COL, { wait: true, payload: p, points: [id] });
			}
		} else if (action === 'delete') {
			if (!id) return json({ ok: false, e: 'id required' });
			if (!(await owns(c, id, uid))) return json({ ok: false, e: 'forbidden' });
			// Soft delete (tombstone) so other devices can detect and propagate the delete on their next sync.
			await c.setPayload(COL, { wait: true, payload: { d: 1, u: Date.now() }, points: [id] });
		} else if (action === 'scroll') {
			const points = (
				await c.scroll(COL, {
					filter: { must: [{ key: 's', match: { value: uid } }] },
					limit: 999,
					with_payload: true
				})
			).points;
			// ponytail: lazy one-time migration of any notes still sitting in the old
			// zero-vector collection, capped per call — no separate migration script needed.
			const have = new Set(points.map((p) => String(p.id)));
			let legacy: typeof points = [];
			try {
				legacy = (
					await c.scroll(LEGACY_COL, {
						filter: { must: [{ key: 's', match: { value: uid } }] },
						limit: 999,
						with_payload: true
					})
				).points;
			} catch {
				/* legacy collection may not exist for new accounts */
			}
			for (const lp of legacy.slice(0, 20)) {
				if (have.has(String(lp.id))) continue;
				const title = String(lp.payload?.t || '');
				const body = String(lp.payload?.b || '');
				const vector = await embed(env, `${title}\n\n${body}`);
				const payload = { s: uid, t: title, b: body, u: Date.now(), d: 0 };
				await c.upsert(COL, { wait: true, points: [{ id: lp.id, vector, payload }] });
				points.push({ ...lp, payload } as any);
			}
			return json({
				notes: points
					.filter((p) => !p.payload?.d)
					.map((p) => ({ i: p.id, t: p.payload?.t || '', b: p.payload?.b || '', u: p.payload?.u || 0 })),
				tombstones: points
					.filter((p) => p.payload?.d)
					.map((p) => ({ i: p.id, u: p.payload?.u || 0 }))
			});
		} else if (action === 'search') {
			if (!q || !String(q).trim()) return json({ ok: false, e: 'q required' });
			const vector = await embed(env, String(q));
			const hits = await c.search(COL, {
				vector,
				limit: 5,
				filter: {
					must: [
						{ key: 's', match: { value: uid } },
						{ key: 'd', match: { value: 0 } }
					]
				}
			});
			return json({
				ok: true,
				hits: hits.map((h) => ({ i: h.id, t: h.payload?.t, b: h.payload?.b, s: h.score }))
			});
		} else {
			return json({ ok: false, e: 'unknown action' });
		}
		return json({ ok: true });
	} catch (e) {
		return json({ ok: false, e: String(e) });
	}
};

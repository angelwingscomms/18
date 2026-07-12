import { json } from '@sveltejs/kit';
import type { RequestHandler } from '@sveltejs/kit';
import { QdrantClient } from '@qdrant/js-client-rest';
import { decode_session } from '$lib/server/session';

let qdrant: QdrantClient | null = null;

async function get_client(env: Env): Promise<QdrantClient> {
	if (!qdrant) {
		const [url, key] = await Promise.all([env.QDRANT_URL.get(), env.QDRANT_KEY.get()]);
		qdrant = new QdrantClient({ url, apiKey: key });
	}
	return qdrant;
}

export const POST: RequestHandler = async ({ request, cookies, platform }) => {
	const s = await decode_session(cookies.get('session'), platform!.env);
	const uid = s?.user?.id;
	if (!uid) return json({ ok: false, e: 'not authenticated' });

	const { a: action, i: id, t, b } = await request.json();
	const c = await get_client(platform!.env);

	try {
		if (action === 'upsert') {
			await c.upsert('i', {
				wait: true,
				points: [{
					id,
					payload: { s: uid, t, b },
					vector: new Array(3072).fill(0),
				}],
			});
		} else if (action === 'payload') {
			const p: Record<string, unknown> = {};
			if (t !== undefined) p.t = t;
			if (b !== undefined) p.b = b;
			if (Object.keys(p).length === 0) return json({ ok: false, e: 'no fields' });
			await c.setPayload('i', { wait: true, payload: p, points: [id] });
		} else if (action === 'delete') {
			await c.delete('i', { wait: true, points: [id] });
		} else if (action === 'scroll') {
			let points = (await c.scroll('i', {
				filter: { must: [{ key: 's', match: { value: uid } }] },
				limit: 999,
			})).points;
			if (points.length === 0) {
				points = (await c.scroll('i', {
					filter: { must: [{ key: 's', match: { value: '18' } }] },
					limit: 999,
				})).points;
			}
			return json({ notes: points.map(p => ({ i: p.id, t: p.payload?.t || '', b: p.payload?.b || '' })) });
		} else {
			return json({ ok: false, e: 'unknown action' });
		}
		return json({ ok: true });
	} catch (e) {
		return json({ ok: false, e: String(e) });
	}
};

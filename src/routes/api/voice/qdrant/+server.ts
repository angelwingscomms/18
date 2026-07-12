import { env } from '$env/dynamic/private';
import { json } from '@sveltejs/kit';
import type { RequestHandler } from '@sveltejs/kit';
import { QdrantClient } from '@qdrant/js-client-rest';

const qdrant = new QdrantClient({ url: env.QDRANT_URL, apiKey: env.QDRANT_KEY });

export const POST: RequestHandler = async ({ request }) => {
	const { a: action, i: id, t, b } = await request.json();

	try {
		if (action === 'upsert') {
			await qdrant.upsert('i', {
				wait: true,
				points: [{
					id,
					payload: { s: 18, t, b },
					vector: new Array(3072).fill(0),
				}],
			});
		} else if (action === 'payload') {
			const p: Record<string, unknown> = {};
			if (t !== undefined) p.t = t;
			if (b !== undefined) p.b = b;
			if (Object.keys(p).length === 0) return json({ ok: false, e: 'no fields' });
			await qdrant.setPayload('i', { wait: true, payload: p, points: [id] });
		} else if (action === 'delete') {
			await qdrant.delete('i', { wait: true, points: [id] });
		} else {
			return json({ ok: false, e: 'unknown action' });
		}
		return json({ ok: true });
	} catch (e) {
		return json({ ok: false, e: String(e) });
	}
};
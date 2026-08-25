import { json } from '@sveltejs/kit';
import type { RequestHandler } from '@sveltejs/kit';
import { decode_session } from '$lib/server/session';
import { COL, get_client, ensure_collection, embed, owns, chat_to_text } from '$lib/server/chats';

export const POST: RequestHandler = async ({ request, cookies, platform }) => {
	const s = await decode_session(cookies.get('session'), platform!.env);
	const uid = s?.user?.id;
	if (!uid) return json({ ok: false, e: 'not authenticated' });

	const body = await request.json();
	const a = body.a as string;
	const id = body.i as string | undefined;
	const t = body.t as string | undefined;
	const m = body.m as { role: string; content: string; images?: string[] }[] | undefined;
	const u = body.u as number | undefined;
	const q = body.q as string | undefined;

	const env = platform!.env;
	const c = await get_client(env);
	await ensure_collection(c);

	try {
		if (a === 'create') {
			const cid = id || crypto.randomUUID();
			if (!(await owns(c, cid, uid))) return json({ ok: false, e: 'forbidden' });
			const title = t ?? 'new chat';
			const msgs = m ?? [];
			const updated = u ?? Date.now();
			const vector = await embed(env, chat_to_text(title, msgs));
			await c.upsert(COL, {
				wait: true,
				points: [{ id: cid, vector, payload: { s: uid, t: title, m: msgs, u: updated, d: 0 } }]
			});
			return json({ ok: true, i: cid });
		} else if (a === 'list') {
			const points = (
				await c.scroll(COL, {
					filter: { must: [{ key: 's', match: { value: uid } }, { key: 'd', match: { value: 0 } }] },
					limit: 999,
					with_payload: true,
					with_vector: false
				})
			).points;
			const chats = points
				.map((p) => ({
					i: p.id as string,
					t: (p.payload?.t as string) || 'new chat',
					m: (p.payload?.m as any) || [],
					u: (p.payload?.u as number) || 0
				}))
				.sort((x, y) => y.u - x.u);
			return json({ ok: true, chats });
		} else if (a === 'get') {
			if (!id) return json({ ok: false, e: 'id required' });
			const pts = await c.retrieve(COL, { ids: [id], with_payload: true });
			if (!pts.length) return json({ ok: false, e: 'not found' });
			if (pts[0].payload?.s !== uid) return json({ ok: false, e: 'forbidden' });
			if (pts[0].payload?.d) return json({ ok: false, e: 'deleted' });
			return json({
				ok: true,
				chat: { i: id, t: pts[0].payload?.t || '', m: pts[0].payload?.m || [], u: pts[0].payload?.u || 0 }
			});
		} else if (a === 'update') {
			if (!id) return json({ ok: false, e: 'id required' });
			if (!(await owns(c, id, uid))) return json({ ok: false, e: 'forbidden' });
			const existing = await c.retrieve(COL, { ids: [id], with_payload: true });
			const cur_t = (existing[0]?.payload?.t as string) ?? '';
			const cur_m = (existing[0]?.payload?.m as any) ?? [];
			const next_t = t ?? cur_t;
			const next_m = m ?? cur_m;
			const updated = u ?? Date.now();
			const changed = t !== undefined || m !== undefined;
			if (changed) {
				const vector = await embed(env, chat_to_text(next_t, next_m));
				await c.upsert(COL, {
					wait: true,
					points: [{ id, vector, payload: { s: uid, t: next_t, m: next_m, u: updated, d: 0 } }]
				});
			} else {
				const p: Record<string, unknown> = {};
				if (u !== undefined) p.u = updated;
				if (Object.keys(p).length) await c.setPayload(COL, { wait: true, payload: p, points: [id] });
			}
			return json({ ok: true });
		} else if (a === 'delete') {
			if (!id) return json({ ok: false, e: 'id required' });
			if (!(await owns(c, id, uid))) return json({ ok: false, e: 'forbidden' });
			await c.setPayload(COL, { wait: true, payload: { d: 1, u: Date.now() }, points: [id] });
			return json({ ok: true });
		} else if (a === 'search') {
			if (!q || !String(q).trim()) return json({ ok: false, e: 'q required' });
			const vector = await embed(env, String(q));
			const hits = await c.search(COL, {
				vector,
				limit: 20,
				filter: { must: [{ key: 's', match: { value: uid } }, { key: 'd', match: { value: 0 } }] },
				with_payload: true
			});
			return json({
				ok: true,
				hits: hits.map((h) => ({
					i: h.id,
					t: h.payload?.t || '',
					preview: Array.isArray(h.payload?.m) ? String((h.payload?.m as any[])[0]?.content || '').slice(0, 120) : '',
					u: h.payload?.u || 0,
					score: h.score
				}))
			});
		} else {
			return json({ ok: false, e: 'unknown action' });
		}
	} catch (e) {
		return json({ ok: false, e: String(e) });
	}
};

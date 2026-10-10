import { json } from '@sveltejs/kit';
import type { RequestHandler } from '@sveltejs/kit';
import { text_reply, type ChatTurn } from '$lib/server/text_chat';

export const POST: RequestHandler = async ({ request, platform }) => {
	try {
		const body = (await request.json()) as {
			m?: ChatTurn[]; // chat history
			s?: string; // system prompt
			k?: string; // optional groq key
		};
		const messages = Array.isArray(body.m)
			? body.m.filter(
					(x): x is ChatTurn =>
						!!x &&
						(x.role === 'user' || x.role === 'assistant') &&
						typeof x.content === 'string' &&
						!!x.content.trim()
				)
			: [];
		if (!messages.length) {
			return json({ e: 'text chat unavailable' }, { status: 400, headers: { 'Cache-Control': 'no-store' } });
		}
		return json(
			{ t: await text_reply(platform!.env, messages, typeof body.s === 'string' ? body.s : '', body.k) }, // t: assistant text
			{ headers: { 'Cache-Control': 'no-store' } }
		);
	} catch {
		return json(
			{ e: 'text chat unavailable' }, // e: public error
			{ status: 503, headers: { 'Cache-Control': 'no-store' } }
		);
	}
};

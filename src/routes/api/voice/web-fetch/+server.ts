import { json } from '@sveltejs/kit';
import type { RequestHandler } from '@sveltejs/kit';

function strip_html(html: string): string {
	return html
		.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
		.replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
		.replace(/<[^>]+>/g, ' ')
		.replace(/&[a-z]+;/g, ' ')
		.replace(/\s+/g, ' ')
		.trim();
}

export const POST: RequestHandler = async ({ request }) => {
	const { url, offset = 1, limit = 2000 } = await request.json();

	if (!url || typeof url !== 'string') {
		return json({ error: 'url is required' }, { status: 400 });
	}

	try {
		const res = await fetch(url, {
			headers: { 'User-Agent': 'Mozilla/5.0 (compatible; VoiceAssistant/1.0)' },
			signal: AbortSignal.timeout(15000),
		});
		if (!res.ok) {
			return json({ error: `HTTP ${res.status}: ${res.statusText}` }, { status: 502 });
		}
		const html = await res.text();
		const text = strip_html(html);
		const lines = text.split('\n');
		const total = lines.length;
		const start = Math.max(0, offset - 1);
		const sliced = lines.slice(start, start + limit);
		return json({ lines: sliced, total, offset, limit });
	} catch (e) {
		return json({ error: String(e) }, { status: 502 });
	}
};

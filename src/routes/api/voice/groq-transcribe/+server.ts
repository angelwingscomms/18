import { json } from '@sveltejs/kit';
import type { RequestHandler } from '@sveltejs/kit';

export const POST: RequestHandler = async ({ request, platform }) => {
	const form = await request.formData().catch(() => null);
	const file = form?.get('audio');
	const apiKey = form?.get('apiKey') as string | null;
	if (!file || typeof file === 'string') {
		return json({ error: 'Missing audio file' }, { status: 400 });
	}

	const key = apiKey || await platform!.env.GROQ.get();
	const body = new FormData();
	body.set('file', file);
	body.set('model', 'whisper-large-v3-turbo');
	body.set('response_format', 'json');

	const res = await fetch('https://api.groq.com/openai/v1/audio/transcriptions', {
		method: 'POST',
		headers: { Authorization: `Bearer ${key}` },
		body,
	});

	if (!res.ok) {
		const err = await res.text();
		return json({ error: `Groq API: ${res.status} ${err}` }, { status: 502 });
	}

	const data = await res.json();
	return json({ text: data.text });
};

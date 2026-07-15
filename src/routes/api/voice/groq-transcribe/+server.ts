import { json } from '@sveltejs/kit';
import type { RequestHandler } from '@sveltejs/kit';

export const POST: RequestHandler = async ({ request, platform }) => {
	const form = await request.formData();
	const audio = form.get('audio');
	const apiKey = form.get('apiKey');
	const groqKey = (apiKey as string) || (platform?.env?.GROQ ? await platform.env.GROQ.get() : '');

	if (!groqKey) {
		return json({ error: 'No Groq API key configured' }, { status: 400 });
	}
	if (!audio || typeof audio === 'string') {
		return json({ error: 'audio is required' }, { status: 400 });
	}

	const fd = new FormData();
	fd.set('file', audio, 'dictation.webm');
	fd.set('model', 'whisper-large-v3');
	fd.set('language', 'en');

	const res = await fetch('https://api.groq.com/openai/v1/audio/transcriptions', {
		method: 'POST',
		headers: { Authorization: `Bearer ${groqKey}` },
		body: fd,
	});

	if (!res.ok) {
		const err = await res.text();
		return json({ error: err }, { status: res.status });
	}

	const data: any = await res.json();
	return json({ text: data.text ?? '' });
};

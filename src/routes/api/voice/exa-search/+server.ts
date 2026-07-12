import { json } from '@sveltejs/kit';
import type { RequestHandler } from '@sveltejs/kit';

export const POST: RequestHandler = async ({ request, platform }) => {
	const { query, type = 'auto', apiKey } = await request.json();
	const exaKey = apiKey || await platform!.env.EXA_API_KEY.get();

	const res = await fetch('https://api.exa.ai/search', {
		method: 'POST',
		headers: {
			'Content-Type': 'application/json',
			'x-api-key': exaKey,
		},
		body: JSON.stringify({
			query,
			type,
			numResults: 5,
			contents: { highlights: true },
			maxAgeHours: 0,
		}),
	});

	const data = await res.json();
	return json(data);
};

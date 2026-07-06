import { GEMINI } from '$env/static/private';
import { json } from '@sveltejs/kit';
import type { RequestHandler } from '@sveltejs/kit';

export const GET: RequestHandler = async () => {
	return json({ k: GEMINI });
};

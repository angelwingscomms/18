import { json } from '@sveltejs/kit';
import type { RequestHandler } from '@sveltejs/kit';
import { live_token } from '$lib/server/live_token';

export const GET: RequestHandler = async ({ platform }) => {
	try {
		return json(
			{ k: await live_token(platform!.env) }, // k: single-use voice token
			{ headers: { 'Cache-Control': 'no-store' } }
		);
	} catch {
		return json(
			{ e: 'voice authentication unavailable' }, // e: public error
			{ status: 503, headers: { 'Cache-Control': 'no-store' } }
		);
	}
};

import { json } from '@sveltejs/kit';
import type { RequestHandler } from '@sveltejs/kit';
import { find_user_by_email } from '$lib/server/user';

export const GET: RequestHandler = async ({ url }) => {
  const email = url.searchParams.get('email');
  if (!email) return json({ error: 'Missing email' }, { status: 400 });
  const existing = await find_user_by_email(email);
  return json({ exists: !!existing });
};

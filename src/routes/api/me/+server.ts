import { json } from '@sveltejs/kit';
import type { RequestEvent } from '@sveltejs/kit';
import { get_user } from '$lib/server/user';

export async function GET(event: RequestEvent): Promise<Response> {
  if (!event.locals.user) return json({ user: null });
  const u = await get_user(event, event.locals.user.id);
  return json({ user: u ?? { s: 'u', n: event.locals.user.name, p: event.locals.user.picture, m: event.locals.user.email, d: 0 } });
}

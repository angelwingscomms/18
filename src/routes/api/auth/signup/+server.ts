import { json } from '@sveltejs/kit';
import type { RequestHandler } from '@sveltejs/kit';
import bcrypt from 'bcryptjs';
import { save_user, find_user_by_email } from '$lib/server/user';
import { encode_session } from '$lib/server/session';
import { new_id } from '$lib/util/new_id';

export const POST: RequestHandler = async ({ request, cookies }) => {
  const body = await request.json().catch(() => null);
  const email = body?.email;
  const password = body?.password;
  const name = body?.name;
  if (!email || !password || password.length < 8) {
    return json({ error: 'Email required and password min 8 characters' }, { status: 400 });
  }

  const existing = await find_user_by_email(email);
  if (existing) {
    return json({ error: 'Email already registered' }, { status: 409 });
  }

  const hash = await bcrypt.hash(password, 10);
  const user_id = new_id();
  await save_user(null, user_id, name || email.split('@')[0], undefined, email, hash);

  const session = await encode_session({ id: user_id, name: name || email.split('@')[0], email });
  cookies.set('session', session, { path: '/', httpOnly: true, maxAge: 604800, sameSite: 'lax' });

  return json({ success: true, user: { id: user_id, email, name: name || email.split('@')[0] } });
};

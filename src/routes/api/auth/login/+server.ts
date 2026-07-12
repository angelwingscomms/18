import { json } from '@sveltejs/kit';
import type { RequestHandler } from '@sveltejs/kit';
import bcrypt from 'bcryptjs';
import { find_user_by_email } from '$lib/server/user';
import { encode_session } from '$lib/server/session';

export const POST: RequestHandler = async ({ request, cookies }) => {
  const body = await request.json().catch(() => null);
  const email = body?.email;
  const password = body?.password;
  if (!email || !password) {
    return json({ error: 'Email and password required' }, { status: 400 });
  }

  const existing = await find_user_by_email(email);
  if (!existing || !existing.h) {
    return json({ error: existing && !existing.h ? 'Try signing in with Google' : 'Invalid email or password' }, { status: 401 });
  }

  const match = await bcrypt.compare(password, existing.h);
  if (!match) {
    return json({ error: 'Invalid email or password' }, { status: 401 });
  }

  const session = await encode_session({ id: existing.i, name: existing.n, picture: existing.p, email });
  cookies.set('session', session, { path: '/', httpOnly: true, maxAge: 604800, sameSite: 'lax' });

  return json({ success: true, user: { id: existing.i, email, name: existing.n, picture: existing.p } });
};

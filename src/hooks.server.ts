import { decode_session } from '$lib/server/session';
import type { Handle } from '@sveltejs/kit';

export const handle: Handle = async ({ event, resolve }) => {
  const session_id = event.cookies.get('session');
  event.locals.user = null;
  if (session_id) {
    const s = await decode_session(session_id);
    if (s) {
      event.locals.user = s.user;
    } else {
      event.cookies.delete('session', { path: '/' });
    }
  }
  const response = await resolve(event);
  response.headers.set('Cross-Origin-Opener-Policy', 'same-origin');
  response.headers.set('Cross-Origin-Embedder-Policy', 'credentialless');
  return response;
};

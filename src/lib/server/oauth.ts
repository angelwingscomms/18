import { Google, generateState, generateCodeVerifier } from 'arctic';
import { env } from '$env/dynamic/private';
import { google_redirect_uri } from '$lib/util/oauth/google_redirect_uri';

export function google_client(origin: string): Google {
  return new Google(env.GOOGLE_ID, env.GOOGLE_SECRET, google_redirect_uri(origin));
}
export { generateState, generateCodeVerifier };

import { Google, generateState, generateCodeVerifier } from 'arctic';
import { google_redirect_uri } from '$lib/util/oauth/google_redirect_uri';

export async function google_client(origin: string, env: Env): Promise<Google> {
  const [id, secret] = await Promise.all([env.GOOGLE_ID.get(), env.GOOGLE_SECRET.get()]);
  return new Google(id, secret, google_redirect_uri(origin));
}
export { generateState, generateCodeVerifier };

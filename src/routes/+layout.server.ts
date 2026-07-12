import { decode_session } from '$lib/server/session';
import { get_balance } from '$lib/server/token_balance';
import { get_user } from '$lib/server/user';
import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = async ({ cookies, platform }) => {
  const session_id = cookies.get('session');
  if (!session_id) return { user: null, balance: 0 };

  const s = await decode_session(session_id, platform!.env);
  if (!s) return { user: null, balance: 0 };

  const balance = await get_balance({ platform }, s.user.id, platform!.env);
  const u = await get_user({ platform }, s.user.id, platform!.env);
  return { user: s.user, balance, date_joined: u?.d ?? null };
};

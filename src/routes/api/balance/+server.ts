import { json } from '@sveltejs/kit';
import type { RequestHandler } from '@sveltejs/kit';
import { get_balance } from '$lib/server/token_balance';

export const GET: RequestHandler = async ({ locals, platform }) => {
  if (!locals.user?.id) return json({ balance: 0 });
  const b = await get_balance({ platform }, locals.user.id);
  return json({ balance: b });
};

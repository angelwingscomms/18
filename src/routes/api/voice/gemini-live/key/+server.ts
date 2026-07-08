import { GEMINI } from '$env/static/private';
import { json } from '@sveltejs/kit';
import type { RequestHandler } from '@sveltejs/kit';
import { get_balance, deduct } from '$lib/server/token_balance';

const SESSION_FEE = 500;

export const GET: RequestHandler = async ({ locals, platform }) => {
  const user = locals.user;
  if (user) {
    const bal = await get_balance({ platform }, user.id);
    if (bal < SESSION_FEE) {
      return json({ error: 'insufficient_balance', balance: bal, fee: SESSION_FEE });
    }
    await deduct({ platform }, user.id, SESSION_FEE);
  }
  return json({ k: GEMINI });
};

import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from '@sveltejs/kit';
import { paystack_verify } from '$lib/paystack';
import { credit, get_balance } from '$lib/server/token_balance';

export const POST: RequestHandler = async ({ request, locals, platform }) => {
  const user = locals.user;
  if (!user?.id) throw error(401, 'Unauthorized');

  const body = await request.json().catch(() => null);
  const ref = body?.reference;
  if (!ref || typeof ref !== 'string') return json({ success: false, error: 'Missing reference' }, { status: 400 });

  try {
    const result = await paystack_verify(ref, platform!.env);
    if (result.status !== 'success') return json({ success: false, error: `Transaction ${result.status}` });

    await credit({ platform }, user.id, result.amount, platform!.env);
    const bal = await get_balance({ platform }, user.id, platform!.env);
    return json({ success: true, balance: bal });
  } catch (e) {
    console.error('[verify-payment]', e);
    return json({ success: false, error: 'Verification failed' }, { status: 500 });
  }
};

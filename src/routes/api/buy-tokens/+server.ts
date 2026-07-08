import { json } from '@sveltejs/kit';
import type { RequestHandler } from '@sveltejs/kit';
import { paystack_init } from '$lib/paystack';
import { new_id } from '$lib/util/new_id';

export const POST: RequestHandler = async ({ request, url, locals }) => {
  const user = locals.user;
  if (!user?.email) {
    return json({ error: 'Unauthorized' }, { status: 401 });
  }

  const MIN_KOBO = 10_000;
  const body = await request.json().catch(() => null);
  const amount_kobo = body?.amount_kobo;
  if (!amount_kobo || typeof amount_kobo !== 'number' || amount_kobo < MIN_KOBO) {
    return json({ error: 'Invalid amount' }, { status: 400 });
  }

  const ref = new_id();
  const callback_url = `${url.origin}/payment/callback`;

  try {
    const result = await paystack_init(user.email, amount_kobo, ref, callback_url, { user_id: user.id });
    return json({
      success: true,
      authorization_url: result.authorization_url,
      access_code: result.access_code,
      reference: result.reference
    });
  } catch (e) {
    console.error('[buy-tokens]', e);
    return json({ error: 'Payment initialization failed' }, { status: 500 });
  }
};

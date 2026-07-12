import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { paystack_verify } from '$lib/paystack';
import { credit } from '$lib/server/token_balance';

export const load: PageServerLoad = async ({ url, locals, platform }) => {
  const user = locals.user;
  if (!user?.email || !user.id) {
    throw redirect(303, '/');
  }

  const ref = url.searchParams.get('reference') || url.searchParams.get('trxref');
  const status = url.searchParams.get('status');

  if (status === 'cancelled') {
    return { success: false, message: 'Payment was cancelled.', ref: null, balance: 0 };
  }

  if (!ref) {
    return { success: false, message: 'No transaction reference found.', ref: null, balance: 0 };
  }

  try {
    const result = await paystack_verify(ref, platform!.env);
    if (result.status !== 'success') {
      return { success: false, message: `Transaction ${result.status}.`, ref, balance: 0 };
    }

    const new_bal = await credit({ platform }, user.id, result.amount, platform!.env);
    return { success: true, message: 'Deposit successful!', ref, balance: new_bal };
  } catch {
    return { success: false, message: 'Could not verify payment. Contact support.', ref, balance: 0 };
  }
};

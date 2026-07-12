import { createHmac } from 'node:crypto';
import { dev } from '$app/environment';

const BASE = 'https://api.paystack.co';

export interface PaystackInitResult {
	authorization_url: string;
	access_code: string;
	reference: string;
}

export interface PaystackVerifyResult {
	status: string;
	reference: string;
	amount: number;
	customer: { email: string };
	metadata: Record<string, unknown>;
}

async function get_secret_key(env: Env): Promise<string> {
	const paystack_test = await env.PAYSTACK_TEST.get();
	const is_test = paystack_test !== undefined && paystack_test !== null
		? paystack_test === '.'
		: dev;

	const key = is_test
		? await env.PAYSTACK_SECRET_KEY_TEST.get()
		: await env.PAYSTACK_SECRET_KEY_LIVE.get();
	return key || '';
}

export async function paystack_init(
	email: string,
	amount_kobo: number,
	reference: string,
	callback_url: string,
	metadata?: Record<string, unknown>,
	env?: Env,
): Promise<PaystackInitResult> {
	const secret_key = await get_secret_key(env!);
	const res = await fetch(`${BASE}/transaction/initialize`, {
		method: 'POST',
		headers: {
			Authorization: `Bearer ${secret_key}`,
			'Content-Type': 'application/json'
		},
		body: JSON.stringify({
			email,
			amount: amount_kobo,
			reference,
			callback_url,
			metadata: metadata ? JSON.stringify(metadata) : undefined
		})
	});

	if (!res.ok) {
		const err = await res.text();
		throw new Error(`Paystack init failed: ${err}`);
	}

	const body = await res.json();
	if (!body.status) {
		throw new Error(`Paystack init error: ${body.message}`);
	}

	return body.data as PaystackInitResult;
}

export async function paystack_verify(reference: string, env: Env): Promise<PaystackVerifyResult> {
	const secret_key = await get_secret_key(env);
	const res = await fetch(
		`${BASE}/transaction/verify/${encodeURIComponent(reference)}`,
		{
			headers: {
				Authorization: `Bearer ${secret_key}`,
				'Content-Type': 'application/json'
			}
		}
	);

	if (!res.ok) {
		const err = await res.text();
		throw new Error(`Paystack verify failed: ${err}`);
	}

	const body = await res.json();
	if (!body.status) {
		throw new Error(`Paystack verify error: ${body.message}`);
	}

	return body.data as PaystackVerifyResult;
}

export async function verify_webhook_sig(raw_body: string, signature: string, env: Env): Promise<boolean> {
	const secret_key = await get_secret_key(env);
	if (!secret_key) return false;

	const hash = createHmac('sha512', secret_key)
		.update(raw_body)
		.digest('hex');

	return hash === signature;
}

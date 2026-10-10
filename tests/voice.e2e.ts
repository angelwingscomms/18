import { test } from '@e2e-dev/web';
import { expect } from 'e2e';

test.beforeEach(async ({ app, browser }) => {
	await browser.addInitScript(() => {
		localStorage.setItem('gemini_key', 'test-key');
		localStorage.setItem('noise_suppression', 'false');
		Reflect.set(window, 'voice_connections', 0);
		navigator.mediaDevices.getUserMedia = async () =>
			new AudioContext().createMediaStreamDestination().stream;
		class VoiceSocket {
			readyState: number = WebSocket.CONNECTING;
			onopen: ((event: Event) => void) | null = null;
			onmessage: ((event: MessageEvent) => void) | null = null;
			onclose: ((event: CloseEvent) => void) | null = null;
			constructor() {
				Reflect.set(window, 'voice_socket', this);
				Reflect.set(window, 'voice_connections', Reflect.get(window, 'voice_connections') + 1);
				setTimeout(() => {
					this.readyState = WebSocket.OPEN;
					this.onopen?.(new Event('open'));
				});
			}
			send() {}
			close() {
				this.readyState = WebSocket.CLOSED;
				this.onclose?.(new CloseEvent('close', { code: 1000, wasClean: true }));
			}
		}
		window.WebSocket = new Proxy(WebSocket, {
			construct(target, args) {
				return String(args[0]).includes('generativelanguage.googleapis.com')
					? new VoiceSocket()
					: Reflect.construct(target, args);
			}
		});
	});
	await app.open('/');
});

test('text input appears after voice setup and preserves its draft across stops', async ({
	browser
}) => {
	await expect(browser.locator('.record-btn')).toBeVisible();
	await expect(browser.locator('.chat-input-row')).toBeHidden();
	await browser.locator('.record-btn').click();
	await expect
		.poll(() => browser.evaluate(() => Reflect.get(window, 'voice_socket')?.readyState))
		.toBe(1);
	await expect(browser.locator('.chat-input-row')).toBeHidden();
	await browser.evaluate(() => {
		Reflect.get(window, 'voice_socket').onmessage(
			new MessageEvent('message', {
				data: JSON.stringify({ setupComplete: {} })
			})
		);
		return true;
	});
	await expect(browser.locator('.chat-input-row')).toBeVisible();
	await browser.locator('.chat-input-row textarea').fill('keep this draft');
	await browser.locator('.record-btn').click();
	await expect(browser.locator('.chat-input-row')).toBeHidden();
	await browser.locator('.record-btn').click();
	await expect.poll(() => browser.evaluate(() => Reflect.get(window, 'voice_connections'))).toBe(2);
	await browser.evaluate(() => {
		Reflect.get(window, 'voice_socket').onmessage(
			new MessageEvent('message', {
				data: JSON.stringify({ setupComplete: {} })
			})
		);
		return true;
	});
	await expect(browser.locator('.chat-input-row textarea')).toHaveValue('keep this draft');
});

test('authentication rejection ends voice without reconnecting', async ({ browser }) => {
	await browser.locator('.record-btn').click();
	await expect
		.poll(() => browser.evaluate(() => Reflect.get(window, 'voice_socket')?.readyState))
		.toBe(1);
	await browser.evaluate(() => {
		const socket = Reflect.get(window, 'voice_socket');
		socket.readyState = WebSocket.CLOSED;
		socket.onclose(
			new CloseEvent('close', {
				code: 1008,
				reason: 'Request had invalid authentication credentials',
				wasClean: true
			})
		);
		return true;
	});
	await expect(browser.locator('.chat-input-row')).toBeHidden();
	await expect(browser.locator('body')).toContainText('voice authentication failed');
	await browser.evaluate(() => new Promise<boolean>((resolve) => setTimeout(() => resolve(true), 1000)));
	expect(await browser.evaluate(() => Reflect.get(window, 'voice_connections'))).toBe(1);
});

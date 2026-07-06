<script lang="ts">
	import { marked } from 'marked';
	import { get_voice_state } from '$lib/voice/voice-state.svelte.ts';

	const v = get_voice_state();

	let panel: HTMLDivElement;

	$effect(() => {
		if (!panel) return;
		const update = () => {
			const rect = panel.getBoundingClientRect();
			const suggestions = panel.querySelector<HTMLDivElement>('[data-ms]');
			const input = panel.querySelector<HTMLDivElement>('[data-mi]');
			const btm = (suggestions?.offsetHeight ?? 0) + (input?.offsetHeight ?? 0) + 12;
			const avail = window.innerHeight - rect.top - btm;
			const h = Math.max(60, Math.round(avail));
			panel.querySelector<HTMLDivElement>('.chat-msgs')!.style.maxHeight = h + 'px';
		};
		update();
		const ro = new ResizeObserver(update);
		ro.observe(panel);
		ro.observe(document.documentElement);
		window.addEventListener('resize', update);
		return () => {
			ro.disconnect();
			window.removeEventListener('resize', update);
		};
	});
</script>

<div bind:this={panel} class="chat-panel">
	<div bind:this={v.chat_body} class="chat-msgs">
		{#if v.chat_messages.length === 0}
			<p class="empty-msg">No messages yet</p>
		{/if}
		{#each v.chat_messages as msg, i (i)}
			<div class="msg-row {msg.role === 'user' ? 'user' : 'assistant'}">
				<div class="msg-group {msg.role === 'user' ? 'user-group' : ''}">
					<div class="msg-bubble {msg.role === 'user' ? 'user-bubble' : 'assistant-bubble'}">
						{#if msg.role === 'assistant'}
							{@html marked.parse(msg.content)}
						{:else}
							{msg.content}
						{/if}
					</div>
					<div class="msg-actions">
						<button
							class="copy-btn"
							title="Copy"
							onclick={(e) => { try { navigator.clipboard.writeText(msg.content); const t = e.currentTarget; t.classList.add('copied'); setTimeout(() => t.classList.remove('copied'), 1200); } catch {} }}
						>
							<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2" /><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" /></svg>
						</button>
					</div>
				</div>
			</div>
		{/each}
	</div>
	<div data-mi class="chat-input-row">
		<textarea
			bind:this={v.chat_input_ref}
			bind:value={v.chat_input}
			rows={1}
			onkeydown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); v.sendChatMessage(v.chat_input); } }}
			oninput={(e) => { const t = e.currentTarget; t.style.height = 'auto'; t.style.height = t.scrollHeight + 'px'; }}
			placeholder="Ask anything..."
			class="chat-textarea"
		></textarea>
		<button
			onclick={() => v.sendChatMessage(v.chat_input)}
			disabled={!v.chat_input.trim()}
			class="send-btn"
		>→</button>
	</div>
</div>

<style>
	.chat-panel {
		width: 100%;
		max-width: 42rem;
		margin: 0 auto;
		background: rgba(20, 20, 20, 0.6);
		border-radius: 16px;
		overflow: hidden;
		border: 1px solid rgba(255,255,255,0.06);
		backdrop-filter: blur(8px);
	}

	.chat-msgs {
		overflow-y: auto;
		padding: 1.25rem;
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
	}

	.empty-msg {
		color: #555;
		font-size: 0.8125rem;
		text-align: center;
		padding: 2rem 0;
		margin: 0;
		letter-spacing: 0.05em;
	}

	.msg-row {
		display: flex;
	}

	.msg-row.user {
		justify-content: flex-end;
	}

	.msg-row.assistant {
		justify-content: flex-start;
	}

	.msg-group {
		display: flex;
		align-items: flex-end;
		gap: 0.375rem;
		max-width: 80%;
	}

	.msg-group.user-group {
		flex-direction: row-reverse;
	}

	.msg-bubble {
		padding: 0.625rem 1rem;
		font-size: 0.875rem;
		line-height: 1.6;
	}

	.msg-actions {
		opacity: 0;
		transition: opacity 0.15s;
		display: flex;
		align-items: center;
	}

	.msg-row:hover .msg-actions {
		opacity: 1;
	}

	.copy-btn {
		background: none;
		border: none;
		color: #555;
		cursor: pointer;
		padding: 0.25rem;
		border-radius: 4px;
		display: grid;
		place-items: center;
		transition: all 0.15s;
		line-height: 1;
	}

	.copy-btn:hover {
		color: #aaa;
		background: rgba(255,255,255,0.06);
	}

	.copy-btn.copied {
		color: #4ade80;
	}

	.msg-bubble :global(p) {
		margin: 0;
	}

	.msg-bubble :global(p + p) {
		margin-top: 0.5em;
	}

	.user-bubble {
		background: linear-gradient(135deg, #3a8eff, #4a9eff);
		color: #fff;
		border-radius: 18px 4px 18px 18px;
	}

	.assistant-bubble {
		background: rgba(40, 40, 40, 0.8);
		color: #ccc;
		border-radius: 4px 18px 18px 18px;
		border: 1px solid rgba(255,255,255,0.04);
	}

	.chat-input-row {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		padding: 0.75rem;
		border-top: 1px solid rgba(255,255,255,0.04);
		background: rgba(0,0,0,0.15);
	}

	.chat-textarea {
		flex: 1;
		min-height: 40px;
		max-height: 8rem;
		background: rgba(0,0,0,0.35);
		color: #ccc;
		padding: 0.625rem 0.875rem;
		font-size: 0.875rem;
		border: 1px solid rgba(255,255,255,0.06);
		border-radius: 10px;
		outline: none;
		resize: none;
		overflow-y: auto;
		line-height: 1.5;
		font-family: inherit;
		transition: border-color 0.2s;
	}

	.chat-textarea:focus {
		border-color: rgba(74, 158, 255, 0.3);
	}

	.chat-textarea::placeholder {
		color: #555;
	}

	.send-btn {
		width: 40px;
		height: 40px;
		border-radius: 10px;
		border: none;
		background: #4a9eff;
		color: #fff;
		font-size: 1.25rem;
		cursor: pointer;
		display: grid;
		place-items: center;
		flex-shrink: 0;
		transition: all 0.15s;
	}

	.send-btn:disabled {
		opacity: 0.3;
		cursor: not-allowed;
	}

	.send-btn:hover:not(:disabled) {
		background: #3a8eef;
		transform: scale(1.05);
	}

	.send-btn:active:not(:disabled) {
		transform: scale(0.95);
	}
</style>

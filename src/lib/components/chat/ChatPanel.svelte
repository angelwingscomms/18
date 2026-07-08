<script lang="ts">
	import { marked } from 'marked';
	import { get_voice_state } from '$lib/voice/voice-state.svelte.ts';

	const v = get_voice_state();

	let panel: HTMLDivElement;
	let file_input: HTMLInputElement;

	function pick_images() {
		file_input?.click();
	}

	function on_files_selected(e: Event) {
		const input = e.target as HTMLInputElement;
		if (!input.files?.length) return;
		const files = Array.from(input.files);
		for (const f of files) {
			if (!f.type.startsWith('image/')) continue;
			const reader = new FileReader();
			reader.onload = (re) => {
				const url = re.target?.result as string;
				if (url) v.pending_images = [...v.pending_images, url];
			};
			reader.readAsDataURL(f);
		}
		input.value = '';
	}

	function remove_pending_img(idx: number) {
		v.pending_images = v.pending_images.filter((_, i) => i !== idx);
	}

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
						{#if msg.images && msg.images.length > 0}
							<div class="msg-imgs">
								{#each msg.images as img}
									<img src={img} alt="user image" class="msg-img" />
								{/each}
							</div>
						{/if}
						{#if msg.content}
							{#if msg.role === 'assistant'}
								{@html marked.parse(msg.content)}
							{:else}
								{msg.content}
							{/if}
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
		{#if v.pending_images.length > 0}
			<div class="pending-imgs">
				{#each v.pending_images as img, idx (idx)}
					<div class="pending-img-wrap">
						<img src={img} alt="pending" class="pending-img" />
						<button class="remove-img" onclick={() => remove_pending_img(idx)}>×</button>
					</div>
				{/each}
			</div>
		{/if}
		<div class="input-row-inner">
			<button class="img-btn" onclick={pick_images} title="Upload image">
				<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2" /><circle cx="8.5" cy="8.5" r="1.5" /><polyline points="21 15 16 10 5 21" /></svg>
			</button>
			<input
				type="file"
				accept="image/*"
				multiple
				bind:this={file_input}
				onchange={on_files_selected}
				class="file-input-hidden"
			/>
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
				disabled={!v.chat_input.trim() && v.pending_images.length === 0}
				class="send-btn"
			>→</button>
		</div>
	</div>
</div>

<style>
	.chat-panel {
		width: 100%;
		height: 100%;
		display: flex;
		flex-direction: column;
		background: rgba(20, 20, 20, 0.6);
		border-radius: 16px;
		overflow: hidden;
		border: 1px solid rgba(255,255,255,0.06);
		backdrop-filter: blur(8px);
	}

	.chat-msgs {
		flex: 1;
		overflow-y: auto;
		min-height: 0;
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

	.file-input-hidden {
		display: none;
	}

	.img-btn {
		background: none;
		border: none;
		color: #555;
		cursor: pointer;
		padding: 0.375rem;
		border-radius: 8px;
		display: grid;
		place-items: center;
		flex-shrink: 0;
		transition: all 0.15s;
	}

	.img-btn:hover {
		color: #aaa;
		background: rgba(255,255,255,0.06);
	}

	.input-row-inner {
		display: flex;
		align-items: center;
		gap: 0.375rem;
		width: 100%;
	}

	.pending-imgs {
		display: flex;
		gap: 0.375rem;
		flex-wrap: wrap;
		padding: 0 0 0.375rem 0;
	}

	.pending-img-wrap {
		position: relative;
		width: 56px;
		height: 56px;
		border-radius: 8px;
		overflow: hidden;
		border: 1px solid rgba(255,255,255,0.08);
	}

	.pending-img {
		width: 100%;
		height: 100%;
		object-fit: cover;
	}

	.remove-img {
		position: absolute;
		top: -2px;
		right: -2px;
		width: 18px;
		height: 18px;
		border-radius: 50%;
		border: none;
		background: rgba(0,0,0,0.7);
		color: #fff;
		font-size: 12px;
		line-height: 1;
		cursor: pointer;
		display: grid;
		place-items: center;
		padding: 0;
	}

	.msg-imgs {
		display: flex;
		gap: 0.375rem;
		flex-wrap: wrap;
		margin-bottom: 0.375rem;
	}

	.msg-img {
		max-width: 200px;
		max-height: 200px;
		border-radius: 8px;
		object-fit: contain;
	}
</style>

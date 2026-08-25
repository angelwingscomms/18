<script lang="ts">
	import { get_voice_state } from '$lib/voice/voice-state.svelte.ts';
	const v = get_voice_state();
	let search_timer: ReturnType<typeof setTimeout> | null = null;

	function on_search_input(e: Event) {
		const q = (e.currentTarget as HTMLInputElement).value;
		v.chat_search_q = q;
		if (search_timer) clearTimeout(search_timer);
		search_timer = setTimeout(() => {
			if (q.trim()) v.search_chats(q);
			else v.chat_search_hits = [];
		}, 300);
	}

	let sorted = $derived(
		Object.values(v.chats).sort((a, b) => b.u - a.u)
	);

	let visible = $derived(
		v.chat_search_q.trim() && v.chat_search_hits.length
			? v.chat_search_hits.map((h: any) => {
					const c = v.chats[h.i];
					return c ? { ...c, score: h.score, preview: h.preview } : { i: h.i, t: h.t, m: [], u: h.u, preview: h.preview, score: h.score };
				})
			: sorted
	);
</script>

<div class="chat-history">
	<button class="new-btn" onclick={() => v.new_chat()}>+ new chat</button>
	<input class="search" placeholder="search chats..." value={v.chat_search_q} oninput={on_search_input} />
	{#if v.chat_search_q.trim() && v.chat_search_hits.length === 0}
		<p class="empty">no matches</p>
	{/if}
	<div class="list">
		{#each visible as c (c.i)}
			<div class="row {v.active_chat_id === c.i ? 'active' : ''}">
				<button class="row-main" onclick={() => v.load_chat(c.i)}>
					<span class="row-title">{c.t || 'new chat'}</span>
					<span class="row-preview">{(c.m?.[0]?.content || c.preview || '').slice(0, 60)}</span>
				</button>
				<button class="del" onclick={() => v.delete_chat(c.i)} title="delete">×</button>
			</div>
		{/each}
		{#if sorted.length === 0}
			<p class="empty">no chats yet</p>
		{/if}
	</div>
</div>

<style>
	.chat-history {
		width: 100%;
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
		background: rgba(20, 20, 20, 0.6);
		border: 1px solid rgba(255, 255, 255, 0.06);
		border-radius: 16px;
		padding: 0.75rem;
		overflow: hidden;
	}
	.new-btn {
		width: 100%;
		padding: 0.5rem;
		border-radius: 10px;
		border: 1px solid rgba(255, 255, 255, 0.08);
		background: rgba(255, 255, 255, 0.05);
		color: #aaa;
		font-size: 0.8125rem;
		cursor: pointer;
		text-transform: lowercase;
	}
	.new-btn:hover { background: rgba(255,255,255,0.08); color: #eee; }
	.search {
		width: 100%;
		padding: 0.5rem 0.75rem;
		border-radius: 8px;
		border: 1px solid rgba(255,255,255,0.06);
		background: rgba(0,0,0,0.3);
		color: #ccc;
		font-size: 0.8125rem;
		outline: none;
	}
	.search::placeholder { color: #555; }
	.list { display: flex; flex-direction: column; gap: 0.25rem; overflow-y: auto; max-height: 40dvh; }
	.row { display: flex; align-items: center; gap: 0.25rem; border-radius: 8px; }
	.row.active { background: rgba(74,158,255,0.12); }
	.row-main { flex: 1; text-align: left; background: none; border: none; cursor: pointer; padding: 0.5rem; display: flex; flex-direction: column; gap: 0.125rem; min-width: 0; }
	.row-title { color: #ccc; font-size: 0.8125rem; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; text-transform: lowercase; }
	.row-preview { color: #666; font-size: 0.75rem; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
	.del { background: none; border: none; color: #555; cursor: pointer; padding: 0.25rem 0.5rem; font-size: 1rem; line-height: 1; }
	.del:hover { color: #f55; }
	.empty { color: #555; font-size: 0.75rem; text-align: center; padding: 0.75rem 0; margin: 0; }
</style>

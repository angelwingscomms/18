<script lang="ts">
	import { get_voice_state } from '$lib/voice/voice-state.svelte.ts';
	import MarkIcon from '$lib/components/icons/mark-icon.svelte';
	import XIcon from '$lib/components/icons/x-icon.svelte';
	import PlusIcon from '$lib/components/icons/plus-icon.svelte';

	const v = get_voice_state();

	let textarea = $state<HTMLTextAreaElement | null>(null);
	let rename_id = $state<string | null>(null);
	let rename_val = $state('');
	let rename_input = $state<HTMLInputElement | null>(null);

	function start_rename(note_id: string) {
		const n = v.notes.find(x => x.id === note_id);
		if (!n) return;
		rename_id = note_id;
		rename_val = n.title;
		requestAnimationFrame(() => rename_input?.select());
	}

	function commit_rename() {
		if (rename_id && rename_val.trim()) {
			v.rename_note(rename_val.trim(), rename_id);
		}
		rename_id = null;
	}

	function cancel_rename() {
		rename_id = null;
	}

	function add() {
		v.add_note('Note ' + (v.notes.length + 1));
	}

	function remove(note_id: string) {
		v.delete_note(note_id);
	}

	$effect(() => {
		const n = v.active_note;
		if (textarea && n) {
			textarea.style.height = 'auto';
			const line_h = parseFloat(getComputedStyle(textarea).lineHeight);
			textarea.style.height = Math.max(line_h * 4, Math.min(line_h * 40, n.content.split('\n').length * line_h + 24)) + 'px';
		}
	});
</script>

<div class="note-panel">
	<div class="note-header">
		<div class="note-tabs">
			<button class="note-toggle" onclick={() => v.show_note = !v.show_note} title="Toggle note">
				<MarkIcon size={13} color="#888" />
				<span class="note-label">{v.show_note ? 'Notes' : 'Note'}</span>
			</button>
			{#if v.show_note}
				<div class="tabs-scroll">
					{#each v.notes as note (note.id)}
						{#if rename_id === note.id}
							<input
								bind:this={rename_input}
								class="rename-input"
								bind:value={rename_val}
								onkeydown={(e) => { if (e.key === 'Enter') commit_rename(); if (e.key === 'Escape') cancel_rename(); }}
								onblur={commit_rename}
							/>
						{:else}
							<button
								class="tab {note.id === v.active_note_id ? 'active' : ''}"
								onclick={() => v.active_note_id = note.id}
								ondblclick={() => start_rename(note.id)}
								title={note.title}
							>
								<span class="tab-title">{note.title}</span>
								{#if v.notes.length > 1}
									<span class="tab-close" onclick={(e) => { e.stopPropagation(); remove(note.id); }} role="button" tabindex="-1" title="Delete note">
										<XIcon size={10} color="#555" />
									</span>
								{/if}
							</button>
						{/if}
					{/each}
					<button class="tab-add" onclick={add} title="Add note">
						<PlusIcon size={12} color="#888" />
					</button>
				</div>
			{/if}
		</div>
	</div>
	{#if v.show_note && v.active_note}
		<textarea
			bind:this={textarea}
			class="note-textarea"
			bind:value={v.note_content}
			placeholder="Write your note here..."
			spellcheck="false"
		></textarea>
	{/if}
</div>

<style>
	.note-panel {
		border: 1px solid rgba(255,255,255,0.06);
		border-radius: 12px;
		background: rgba(255,255,255,0.02);
	}

	.note-header {
		padding: 0.5rem 0.75rem;
	}

	.note-tabs {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}

	.note-toggle {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		background: none;
		border: none;
		color: #888;
		cursor: pointer;
		padding: 0.25rem 0;
		font-size: 0.8125rem;
		width: fit-content;
	}

	.note-toggle:hover {
		color: #ccc;
	}

	.note-label {
		font-weight: 500;
	}

	.tabs-scroll {
		display: flex;
		align-items: center;
		gap: 0.25rem;
		overflow-x: auto;
		padding-bottom: 0.25rem;
		scrollbar-width: none;
	}

	.tabs-scroll::-webkit-scrollbar {
		display: none;
	}

	.tab {
		display: flex;
		align-items: center;
		gap: 0.375rem;
		background: rgba(255,255,255,0.03);
		border: 1px solid rgba(255,255,255,0.04);
		border-radius: 8px;
		padding: 0.25rem 0.5rem;
		cursor: pointer;
		color: #888;
		font-size: 0.75rem;
		white-space: nowrap;
		flex-shrink: 0;
		transition: all 0.15s;
		max-width: 140px;
	}

	.tab:hover {
		background: rgba(255,255,255,0.06);
		border-color: rgba(255,255,255,0.08);
		color: #bbb;
	}

	.tab.active {
		background: rgba(74, 158, 255, 0.08);
		border-color: rgba(74, 158, 255, 0.15);
		color: #4a9eff;
	}

	.tab-title {
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.tab-close {
		background: none;
		border: none;
		cursor: pointer;
		padding: 1px;
		border-radius: 3px;
		display: flex;
		opacity: 0;
		transition: opacity 0.1s;
		flex-shrink: 0;
		color: inherit;
		line-height: 0;
	}

	.tab:hover .tab-close {
		opacity: 1;
	}

	.tab-close:hover {
		background: rgba(255,255,255,0.08);
	}

	.rename-input {
		background: rgba(0,0,0,0.3);
		border: 1px solid rgba(74, 158, 255, 0.3);
		border-radius: 8px;
		color: #ddd;
		font-size: 0.75rem;
		padding: 0.25rem 0.5rem;
		outline: none;
		width: 100px;
		flex-shrink: 0;
	}

	.tab-add {
		display: flex;
		align-items: center;
		justify-content: center;
		background: none;
		border: 1px dashed rgba(255,255,255,0.08);
		border-radius: 8px;
		padding: 0.25rem 0.375rem;
		cursor: pointer;
		flex-shrink: 0;
		transition: all 0.15s;
	}

	.tab-add:hover {
		border-color: rgba(74, 158, 255, 0.3);
		background: rgba(74, 158, 255, 0.05);
	}

	.note-textarea {
		display: block;
		width: 100%;
		min-height: 100px;
		max-height: 60vh;
		border: none;
		border-top: 1px solid rgba(255,255,255,0.04);
		background: rgba(0,0,0,0.2);
		color: #ccc;
		font-family: 'SF Mono', 'Cascadia Code', 'Fira Code', 'Consolas', monospace;
		font-size: 0.8125rem;
		line-height: 1.6;
		padding: 0.75rem;
		resize: vertical;
		outline: none;
		border-radius: 0 0 12px 12px;
		tab-size: 2;
	}

	.note-textarea:focus {
		background: rgba(0,0,0,0.3);
	}

	.note-textarea::placeholder {
		color: #444;
	}
</style>

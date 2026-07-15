<script lang="ts">
	import { get_voice_state } from '$lib/voice/voice-state.svelte.ts';
	import NoteEditor from '$lib/components/chat/NoteEditor.svelte';
	import MarkIcon from '$lib/components/icons/mark-icon.svelte';
	import XIcon from '$lib/components/icons/x-icon.svelte';
	import PlusIcon from '$lib/components/icons/plus-icon.svelte';
	import FilesIcon from '$lib/components/icons/files-icon.svelte';
	import MicIcon from '$lib/components/icons/mic-icon.svelte';

	const v = get_voice_state();

	let textarea = $state<HTMLTextAreaElement | null>(null);
	let rename_id = $state<string | null>(null);
	let rename_val = $state('');
	let rename_input = $state<HTMLInputElement | null>(null);
	let show_files = $state(false);

	function start_rename(note_id: string) {
		const n = v.notes[note_id];
		if (!n) return;
		rename_id = note_id;
		rename_val = n.t;
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
		v.add_note('Note ' + (Object.keys(v.notes).length + 1));
	}

	function remove(note_id: string) {
		v.delete_note(note_id);
	}

	function close(note_id: string) {
		v.open_note_ids = v.open_note_ids.filter((id) => id !== note_id);
	}

	$effect(() => {
		const n = v.active_note;
		if (textarea && n) {
			textarea.style.height = 'auto';
			const line_h = parseFloat(getComputedStyle(textarea).lineHeight);
			textarea.style.height =
				Math.max(line_h * 4, Math.min(line_h * 40, n.b.split('\n').length * line_h + 24)) + 'px';
		}
	});
</script>

<div class="note-panel">
	<div class="note-header">
		<div class="note-tabs">
			<div class="note-toggle-row">
				<button
					class="note-toggle"
					onclick={() => (v.show_note = !v.show_note)}
					title="Toggle note"
				>
					<MarkIcon size={13} color="#888" />
					<span class="note-label">{v.show_note ? 'Notes' : 'Note'}</span>
				</button>

				<button class="note-toggle" onclick={() => (show_files = true)} title="All files">
					<FilesIcon size={13} color="#888" />
					<span class="note-label">Files</span>
				</button>

				<button
					class="dictate-btn {v.note_dictating ? 'active' : ''}"
					onclick={() => {
						if (!textarea) return;
						v.note_dictation_cursor = textarea.selectionStart ?? v.note_content.length;
						if (v.note_dictating) v.stopNoteDictation();
						else v.startNoteDictation();
					}}
					title="Dictate into note"
				>
					<MicIcon size={13} color={v.note_dictating ? '#4a9eff' : '#888'} />
					<span class="note-label">{v.note_dictating ? 'Stop' : 'Dictate'}</span>
				</button>
			</div>
			{#if v.show_note}
				<div class="tabs-scroll">
					{#each v.open_note_ids as id (id)}
						{#if v.notes[id]}
							{@const note = v.notes[id]}
							{#if rename_id === note.i}
								<input
									bind:this={rename_input}
									class="rename-input"
									bind:value={rename_val}
									onkeydown={(e) => {
										if (e.key === 'Enter') commit_rename();
										if (e.key === 'Escape') cancel_rename();
									}}
									onblur={commit_rename}
								/>
							{:else}
								<button
									class="tab {note.i === v.active_note_id ? 'active' : ''}"
									onclick={() => (v.active_note_id = note.i)}
									ondblclick={() => start_rename(note.i)}
									title={note.t}
								>
									<span class="tab-title">{note.t}</span>
									<span
										class="tab-close"
										onclick={(e) => {
											e.stopPropagation();
											close(note.i);
										}}
										role="button"
										tabindex="-1"
										title="Close (keep note)"
									>
										<XIcon size={10} color="#555" />
									</span>
								</button>
							{/if}
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
		{#if v.fold_lines}
			<NoteEditor
				content={v.note_content}
				tab_size={v.tab_size}
				onchange={(t) => (v.note_content = t)}
			/>
		{:else}
			<textarea
				bind:this={textarea}
				class="note-textarea"
				style="tab-size: {v.tab_size}"
				bind:value={v.note_content}
				placeholder="Write your note here..."
				spellcheck="false"
				onkeydown={(e) => {
					if (e.key !== 'Tab' || !v.use_tab) return;
					e.preventDefault();
					const el = e.currentTarget;
					const s = el.selectionStart;
					const en = el.selectionEnd;
					const val = el.value;
					v.note_content = val.slice(0, s) + '\t' + val.slice(en);
					requestAnimationFrame(() => {
						el.selectionStart = el.selectionEnd = s + 1;
					});
				}}></textarea>
		{/if}
	{/if}
</div>

{#if show_files}
	<div class="overlay" role="presentation" onclick={() => (show_files = false)}>
		<div
			class="files-modal"
			role="dialog"
			aria-modal="true"
			onclick={(e) => e.stopPropagation()}
			onkeydown={(e) => e.key === 'Escape' && (show_files = false)}
		>
			<div class="modal-header">
				<span class="modal-label">All files</span>
				<span
					class="tab-close"
					onclick={() => (show_files = false)}
					role="button"
					tabindex="-1"
					title="Close"
				>
					<XIcon size={12} color="#888" />
				</span>
			</div>
			<div class="files-list">
				{#each Object.values(v.notes) as note (note.i)}
					<div class="file-row {note.i === v.active_note_id ? 'active' : ''}">
						<button
							class="file-name"
							onclick={() => {
								v.active_note_id = note.i;
								if (!v.open_note_ids.includes(note.i))
									v.open_note_ids = [...v.open_note_ids, note.i];
								show_files = false;
							}}
							title={note.t}
						>
							{note.t}
						</button>
						<button class="file-del" onclick={() => remove(note.i)} title="Delete note">
							<XIcon size={11} color="#888" />
						</button>
					</div>
				{/each}
			</div>
		</div>
	</div>
{/if}

<style>
	.note-panel {
		height: 100%;
		display: flex;
		flex-direction: column;
		border: 1px solid rgba(255, 255, 255, 0.06);
		border-radius: 12px;
		background: rgba(255, 255, 255, 0.02);
		overflow: hidden;
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
		background: rgba(255, 255, 255, 0.03);
		border: 1px solid rgba(255, 255, 255, 0.04);
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
		background: rgba(255, 255, 255, 0.06);
		border-color: rgba(255, 255, 255, 0.08);
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
		background: rgba(255, 255, 255, 0.08);
	}

	.rename-input {
		background: rgba(0, 0, 0, 0.3);
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
		border: 1px dashed rgba(255, 255, 255, 0.08);
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
		flex: 1;
		min-height: 80px;
		border: none;
		border-top: 1px solid rgba(255, 255, 255, 0.04);
		background: rgba(0, 0, 0, 0.2);
		color: #ccc;
		font-family: 'SF Mono', 'Cascadia Code', 'Fira Code', 'Consolas', monospace;
		font-size: 0.8125rem;
		line-height: 1.6;
		padding: 0.75rem;
		resize: none;
		outline: none;
		border-radius: 0 0 12px 12px;
		tab-size: 2;
	}

	.note-textarea:focus {
		background: rgba(0, 0, 0, 0.3);
	}

	.note-textarea::placeholder {
		color: #444;
	}

	.note-toggle-row {
		display: flex;
		align-items: center;
		gap: 0.5rem;
	}

	.overlay {
		position: fixed;
		inset: 0;
		background: rgba(0, 0, 0, 0.5);
		display: flex;
		align-items: center;
		justify-content: center;
		z-index: 100;
	}

	.files-modal {
		background: #161616;
		border: 1px solid rgba(255, 255, 255, 0.08);
		border-radius: 12px;
		width: 360px;
		max-width: 90vw;
		max-height: 70vh;
		overflow: hidden;
		display: flex;
		flex-direction: column;
	}

	.modal-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 0.75rem 1rem;
		border-bottom: 1px solid rgba(255, 255, 255, 0.06);
	}

	.modal-label {
		font-size: 0.8125rem;
		font-weight: 600;
		color: #ccc;
	}

	.files-list {
		overflow-y: auto;
		padding: 0.5rem;
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
	}

	.file-row {
		display: flex;
		align-items: center;
		gap: 0.25rem;
		border-radius: 8px;
		padding: 0.125rem 0.25rem;
	}

	.file-row.active {
		background: rgba(74, 158, 255, 0.08);
	}

	.file-name {
		flex: 1;
		text-align: left;
		background: none;
		border: none;
		color: #ccc;
		cursor: pointer;
		font-size: 0.8125rem;
		padding: 0.375rem 0.5rem;
		border-radius: 6px;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.file-name:hover {
		background: rgba(255, 255, 255, 0.05);
		color: #fff;
	}

	.file-del {
		background: none;
		border: none;
		cursor: pointer;
		padding: 4px;
		border-radius: 4px;
		display: flex;
		flex-shrink: 0;
	}

	.file-del:hover {
		background: rgba(255, 255, 255, 0.08);
	}

	.dictate-btn {
		display: flex;
		align-items: center;
		gap: 0.375rem;
		background: none;
		border: 1px solid rgba(255, 255, 255, 0.06);
		border-radius: 8px;
		color: #888;
		cursor: pointer;
		padding: 0.25rem 0.5rem;
		font-size: 0.8125rem;
		width: fit-content;
		transition: all 0.15s;
	}

	.dictate-btn:hover {
		color: #ccc;
		border-color: rgba(255, 255, 255, 0.1);
	}

	.dictate-btn.active {
		color: #4a9eff;
		border-color: rgba(74, 158, 255, 0.3);
		background: rgba(74, 158, 255, 0.08);
		animation: dictate-pulse 1.4s ease-in-out infinite;
	}

	@keyframes dictate-pulse {
		0%,
		100% {
			opacity: 1;
		}
		50% {
			opacity: 0.55;
		}
	}
</style>

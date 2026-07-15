<script lang="ts">
	import { SvelteSet } from 'svelte/reactivity';
	import { indent_level, has_children, visible_indices } from '$lib/voice/fold';

	let { content, onchange }: { content: string; onchange: (t: string) => void } = $props();

	let text_lines = $state<string[]>(content.split('\n'));
	let collapsed = new SvelteSet<number>();
	let last_emitted = content;
	let inputs = $state<(HTMLInputElement | null)[]>([]);

	let visible = $derived(visible_indices(text_lines, collapsed));
	let levels = $derived(text_lines.map(indent_level));
	let kids = $derived(has_children(text_lines));

	$effect(() => {
		if (content !== last_emitted) {
			text_lines = content.split('\n');
			collapsed.clear();
			last_emitted = content;
		}
	});

	function emit() {
		const t = text_lines.join('\n');
		last_emitted = t;
		onchange(t);
	}

	function update_line(i: number, val: string) {
		text_lines = text_lines.map((l, idx) => (idx === i ? val : l));
		emit();
	}

	function toggle(i: number) {
		if (collapsed.has(i)) collapsed.delete(i);
		else collapsed.add(i);
	}

	function focus_line(i: number, col: number) {
		const el = inputs[i];
		if (!el) return;
		el.focus();
		const pos = Math.min(col, el.value.length);
		el.selectionStart = el.selectionEnd = pos;
	}

	function on_key(e: KeyboardEvent, i: number) {
		const inp = e.currentTarget as HTMLInputElement;
		const s = inp.selectionStart ?? 0;
		const en = inp.selectionEnd ?? 0;

		if (e.key === 'Tab') {
			e.preventDefault();
			const v = inp.value;
			if (e.shiftKey) {
				if (v.startsWith('\t')) {
					update_line(i, v.slice(1));
					requestAnimationFrame(() => {
						inp.selectionStart = inp.selectionEnd = Math.max(0, s - 1);
					});
				}
				return;
			}
			update_line(i, v.slice(0, s) + '\t' + v.slice(en));
			requestAnimationFrame(() => {
				inp.selectionStart = inp.selectionEnd = s + 1;
			});
			return;
		}
		if (e.key === 'Enter') {
			e.preventDefault();
			const v = inp.value;
			const before = v.slice(0, s);
			const after = v.slice(en);
			const indent = '\t'.repeat(indent_level(v));
			const nl = [...text_lines];
			nl[i] = before;
			nl.splice(i + 1, 0, indent + after);
			text_lines = nl;
			emit();
			requestAnimationFrame(() => {
				const ni = inputs[i + 1];
				if (ni) {
					ni.focus();
					ni.selectionStart = ni.selectionEnd = indent.length;
				}
			});
			return;
		}
		if (e.key === 'ArrowUp') {
			const idx = visible.indexOf(i);
			if (idx > 0) {
				e.preventDefault();
				focus_line(visible[idx - 1], s);
			}
			return;
		}
		if (e.key === 'ArrowDown') {
			const idx = visible.indexOf(i);
			if (idx < visible.length - 1) {
				e.preventDefault();
				focus_line(visible[idx + 1], s);
			}
			return;
		}
		if (e.key === 'Backspace' && s === 0 && en === 0) {
			const idx = visible.indexOf(i);
			if (idx > 0) {
				e.preventDefault();
				const prev = visible[idx - 1];
				const merged_len = text_lines[prev].length;
				const nl = [...text_lines];
				nl[prev] = nl[prev] + nl[i];
				nl.splice(i, 1);
				text_lines = nl;
				emit();
				requestAnimationFrame(() => {
					const pi = inputs[prev];
					if (pi) {
						pi.focus();
						pi.selectionStart = pi.selectionEnd = merged_len;
					}
				});
			}
			return;
		}
	}

	function on_paste(e: ClipboardEvent, i: number) {
		const inp = e.currentTarget as HTMLInputElement;
		const text = e.clipboardData?.getData('text');
		if (!text || !text.includes('\n')) return;
		e.preventDefault();
		const s = inp.selectionStart ?? 0;
		const en = inp.selectionEnd ?? 0;
		const v = inp.value;
		const parts = text.split('\n');
		const before = v.slice(0, s);
		const after = v.slice(en);
		const nl = [...text_lines];
		nl[i] = before + parts[0];
		const mid = parts.slice(1, parts.length - 1);
		const last = parts[parts.length - 1] + after;
		const insert = [...mid, last];
		nl.splice(i + 1, 0, ...insert);
		text_lines = nl;
		emit();
		requestAnimationFrame(() => {
			const li = inputs[i + insert.length];
			if (li) {
				li.focus();
				li.selectionStart = li.selectionEnd = (parts[parts.length - 1] ?? '').length;
			}
		});
	}
</script>

<div class="editor">
	{#each visible as i (i)}
		<div class="row" style="padding-left:{levels[i] * 1.2}rem">
			{#if kids[i]}
				<button class="fold" onclick={() => toggle(i)} aria-label="toggle fold"
					>{collapsed.has(i) ? '▸' : '▾'}</button
				>
			{:else}
				<span class="fold-spacer"></span>
			{/if}
			<input
				class="line"
				bind:this={inputs[i]}
				value={text_lines[i]}
				oninput={(e) => update_line(i, (e.currentTarget as HTMLInputElement).value)}
				onkeydown={(e) => on_key(e, i)}
				onpaste={(e) => on_paste(e, i)}
				spellcheck="false"
			/>
		</div>
	{/each}
</div>

<style>
	.editor {
		display: flex;
		flex-direction: column;
		flex: 1;
		min-height: 80px;
		overflow-y: auto;
		border-top: 1px solid rgba(255, 255, 255, 0.04);
		background: rgba(0, 0, 0, 0.2);
		color: #ccc;
		font-family: 'SF Mono', 'Cascadia Code', 'Fira Code', 'Consolas', monospace;
		font-size: 0.8125rem;
		line-height: 1.6;
		padding: 0.4rem 0;
		border-radius: 0 0 12px 12px;
	}

	.editor:focus-within {
		background: rgba(0, 0, 0, 0.3);
	}

	.row {
		display: flex;
		align-items: center;
		gap: 0.25rem;
		padding-right: 0.75rem;
	}

	.fold {
		flex: 0 0 16px;
		width: 16px;
		background: none;
		border: none;
		color: #888;
		cursor: pointer;
		font-size: 0.7rem;
		line-height: 1.6;
		padding: 0;
	}

	.fold:hover {
		color: #ccc;
	}

	.fold-spacer {
		flex: 0 0 16px;
		width: 16px;
	}

	.line {
		flex: 1;
		border: none;
		background: none;
		color: inherit;
		font-family: inherit;
		font-size: inherit;
		line-height: inherit;
		padding: 0;
		outline: none;
	}
</style>

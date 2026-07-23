<script lang="ts">
	import { SvelteSet } from 'svelte/reactivity';
	import { indent_level, has_children, visible_indices } from '$lib/voice/fold';

	let {
		content,
		tab_size = 1,
		onchange
	}: { content: string; tab_size?: number; onchange: (t: string) => void } = $props();

	let editor_el = $state<HTMLDivElement | null>(null);
	let text_lines: string[] = content.split('\n');
	let collapsed = new SvelteSet<number>();
	let last_emitted = content;
	let struct_version = $state(0);
	let pending_caret: { i: number; offset: number } | null = null;

	let visible = $derived.by(() => {
		void struct_version;
		return visible_indices(text_lines, collapsed);
	});
	let kids = $derived.by(() => {
		void struct_version;
		return has_children(text_lines);
	});

	$effect(() => {
		if (content !== last_emitted) {
			text_lines = content.split('\n');
			collapsed.clear();
			last_emitted = content;
			struct_version++;
		}
	});

	function emit() {
		const t = text_lines.join('\n');
		last_emitted = t;
		onchange(t);
	}

	function toggle(i: number) {
		if (collapsed.has(i)) collapsed.delete(i);
		else collapsed.add(i);
	}

	function render_lines() {
		if (!editor_el) return;
		// eslint-disable-next-line svelte/no-dom-manipulating
		editor_el.textContent = '';
		for (const i of visible) {
			const d = document.createElement('div');
			d.className = 'line';
			d.dataset.i = String(i);
			d.textContent = text_lines[i] ?? '';
			// eslint-disable-next-line svelte/no-dom-manipulating
			editor_el.appendChild(d);
		}
	}

	$effect(() => {
		void visible;
		void editor_el;
		render_lines();
		if (pending_caret) {
			const pc = pending_caret;
			pending_caret = null;
			requestAnimationFrame(() => {
				const d = editor_el?.querySelector(`.line[data-i="${pc.i}"]`) as HTMLElement | null;
				if (d) set_caret(d, pc.offset);
			});
		}
	});

	function line_el_from(node: Node | null): HTMLElement | null {
		let n: Node | null = node;
		while (n && n !== editor_el) {
			if (n instanceof HTMLElement && n.classList.contains('line')) return n;
			n = n.parentNode;
		}
		return null;
	}

	function sel_info(): { line: HTMLElement; idx: number; offset: number } | null {
		const sel = window.getSelection();
		if (!sel || sel.rangeCount === 0) return null;
		const range = sel.getRangeAt(0);
		let line = line_el_from(range.startContainer);
		if (!line && range.startContainer === editor_el) {
			// Clicked in empty space below/around the lines: fall back to the nearest line.
			const lines = editor_el?.querySelectorAll('.line');
			if (lines && lines.length > 0) {
				line = lines[Math.min(range.startOffset, lines.length - 1)] as HTMLElement;
				return { line, idx: parseInt(line.dataset.i ?? '-1', 10), offset: line.textContent?.length ?? 0 };
			}
		}
		if (!line) return null;
		const idx = parseInt(line.dataset.i ?? '-1', 10);
		if (Number.isNaN(idx)) return null;
		let offset: number;
		if (range.startContainer === line) {
			offset = 0;
			for (let c = 0; c < range.startOffset; c++) {
				offset += line.childNodes[c]?.textContent?.length ?? 0;
			}
		} else {
			offset = range.startOffset;
		}
		return { line, idx, offset };
	}

	function set_caret(line: HTMLElement, offset: number) {
		const sel = window.getSelection();
		if (!sel) return;
		const range = document.createRange();
		const text_node = line.firstChild;
		if (text_node && text_node.nodeType === Node.TEXT_NODE) {
			const len = (text_node.textContent ?? '').length;
			range.setStart(text_node, Math.min(offset, len));
		} else {
			range.setStart(line, 0);
		}
		range.collapse(true);
		sel.removeAllRanges();
		sel.addRange(range);
	}

	function on_input() {
		if (!editor_el) return;
		const divs = editor_el.querySelectorAll('.line');
		const arr: string[] = [];
		divs.forEach((d) => arr.push((d as HTMLElement).textContent ?? ''));
		text_lines = arr;
		emit();
	}

	function on_key(e: KeyboardEvent) {
		if (e.key === 'Tab') {
			e.preventDefault();
			const info = sel_info();
			if (!info) return;
			const { line, idx, offset } = info;
			const cur = line.textContent ?? '';
			if (e.shiftKey) {
				if (cur.startsWith('\t')) {
					const nl = [...text_lines];
					nl[idx] = cur.slice(1);
					text_lines = nl;
					pending_caret = { i: idx, offset: Math.max(0, offset - 1) };
					struct_version++;
					emit();
				}
				return;
			}
			const nl = [...text_lines];
			nl[idx] = '\t' + cur;
			text_lines = nl;
			pending_caret = { i: idx, offset: offset + 1 };
			struct_version++;
			emit();
			return;
		}
		if (e.key === 'Enter') {
			e.preventDefault();
			const info = sel_info();
			if (!info) return;
			const { idx, offset } = info;
			const cur = text_lines[idx] ?? '';
			const before = cur.slice(0, offset);
			const after = cur.slice(offset);
			const indent = '\t'.repeat(indent_level(cur));
			const nl = [...text_lines];
			nl[idx] = before;
			nl.splice(idx + 1, 0, indent + after);
			text_lines = nl;
			pending_caret = { i: idx + 1, offset: indent.length };
			struct_version++;
			emit();
			return;
		}
		if (e.key === 'Backspace') {
			const sel = window.getSelection();
			if (sel && sel.toString().length > 0) return;
			const info = sel_info();
			if (!info) return;
			const { idx, offset } = info;
			if (offset !== 0) return;
			const vis_idx = visible.indexOf(idx);
			if (vis_idx <= 0) return;
			e.preventDefault();
			const prev = visible[vis_idx - 1];
			const prev_text = text_lines[prev] ?? '';
			const cur = text_lines[idx] ?? '';
			const merged_len = prev_text.length;
			const nl = [...text_lines];
			nl[prev] = prev_text + cur;
			nl.splice(idx, 1);
			text_lines = nl;
			pending_caret = { i: prev, offset: merged_len };
			struct_version++;
			emit();
			return;
		}
	}

	function on_paste(e: ClipboardEvent) {
		const text = e.clipboardData?.getData('text');
		if (!text) return;
		e.preventDefault();
		const info = sel_info();
		if (!info) return;
		const { idx, offset } = info;
		const cur = text_lines[idx] ?? '';
		const before = cur.slice(0, offset);
		const after = cur.slice(offset);
		const parts = text.split('\n');
		const nl = [...text_lines];
		if (parts.length === 1) {
			nl[idx] = before + parts[0] + after;
			pending_caret = { i: idx, offset: before.length + parts[0].length };
		} else {
			nl[idx] = before + parts[0];
			const insert = parts.slice(1, parts.length - 1).concat(parts[parts.length - 1] + after);
			nl.splice(idx + 1, 0, ...insert);
			pending_caret = { i: idx + parts.length - 1, offset: (parts[parts.length - 1] ?? '').length };
		}
		text_lines = nl;
		struct_version++;
		emit();
	}
</script>

<div class="editor">
	<div class="gutter">
		{#each visible as i (i)}
			<div class="gline">
				{#if kids[i]}
					<button class="fold" onclick={() => toggle(i)} aria-label="toggle fold"
						>{collapsed.has(i) ? '▸' : '▾'}</button
					>
				{:else}
					<span class="fold-spacer"></span>
				{/if}
			</div>
		{/each}
	</div>
	<div
		class="text"
		contenteditable="true"
		spellcheck="false"
		bind:this={editor_el}
		oninput={on_input}
		onkeydown={on_key}
		onpaste={on_paste}
		style="tab-size: {tab_size}"
	></div>
</div>

<style>
	.editor {
		display: flex;
		flex: 1;
		min-height: 80px;
		overflow: hidden;
		border-top: 1px solid rgba(255, 255, 255, 0.04);
		background: rgba(0, 0, 0, 0.2);
		color: #ccc;
		font-family: 'SF Mono', 'Cascadia Code', 'Fira Code', 'Consolas', monospace;
		font-size: 0.8125rem;
		line-height: 1.6;
		border-radius: 0 0 12px 12px;
	}

	.editor:focus-within {
		background: rgba(0, 0, 0, 0.3);
	}

	.gutter {
		flex: 0 0 auto;
		padding: 0.4rem 0;
		user-select: none;
	}

	.gline {
		height: 1.6em;
		display: flex;
		align-items: center;
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

	.text {
		flex: 1;
		min-height: 80px;
		overflow: auto;
		padding: 0.4rem 0.75rem 0.4rem 0;
		outline: none;
		white-space: pre;
	}

	.line {
		min-height: 1.6em;
	}
</style>

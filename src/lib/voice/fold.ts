export function indent_level(line: string): number {
	const m = line.match(/^(\t*)/);
	return m ? m[1].length : 0;
}

export function has_children(lines: string[]): boolean[] {
	const levels = lines.map(indent_level);
	const out: boolean[] = new Array(lines.length).fill(false);
	for (let i = 0; i < lines.length; i++) {
		if (i + 1 < lines.length && levels[i + 1] > levels[i]) out[i] = true;
	}
	return out;
}

export function visible_indices(lines: string[], collapsed: Set<number>): number[] {
	const levels = lines.map(indent_level);
	const out: number[] = [];
	const stack: { i: number; l: number }[] = [];
	for (let i = 0; i < lines.length; i++) {
		while (stack.length && stack[stack.length - 1].l >= levels[i]) stack.pop();
		const hidden = stack.length > 0 && collapsed.has(stack[stack.length - 1].i);
		if (!hidden) out.push(i);
		if (collapsed.has(i)) stack.push({ i, l: levels[i] });
	}
	return out;
}

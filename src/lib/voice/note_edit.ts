export type EditResult =
	| { ok: true; content: string; message: string; at: number }
	| { ok: false; error: string };

/** `at` is the character offset into the ORIGINAL content where the edit landed — used to
 *  compute which line to highlight/scroll to in the editor. */
export function apply_edit(
	content: string,
	oldString: string,
	newString: string,
	replaceAll = false
): EditResult {
	if (oldString === '') {
		const glue = content && !content.endsWith('\n') ? '\n' : '';
		return {
			ok: true,
			content: content + glue + newString,
			message: 'Appended to note.',
			at: content.length
		};
	}
	if (replaceAll) {
		const count = content.split(oldString).length - 1;
		if (count === 0) return { ok: false, error: 'oldString not found in note.' };
		return {
			ok: true,
			content: content.split(oldString).join(newString),
			message: `Replaced ${count} occurrence(s) in note.`,
			at: content.indexOf(oldString)
		};
	}
	const first = content.indexOf(oldString);
	if (first === -1) return { ok: false, error: 'oldString not found in note.' };
	const last = content.lastIndexOf(oldString);
	if (first !== last)
		return { ok: false, error: 'Found multiple matches. Use replaceAll or provide more context.' };
	return {
		ok: true,
		content: content.slice(0, first) + newString + content.slice(first + oldString.length),
		message: 'Edited note.',
		at: first
	};
}

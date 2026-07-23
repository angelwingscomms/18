/// <reference lib="deno.ns" />
import { apply_edit } from './note_edit';
import { assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';

Deno.test('apply_edit appends to empty note with no leading newline', () => {
	const r = apply_edit('', '', 'hello');
	assertEquals(r, { ok: true, content: 'hello', message: 'Appended to note.', at: 0 });
});

Deno.test('apply_edit appends with a newline glue when note has no trailing newline', () => {
	const r = apply_edit('line1', '', 'line2');
	assertEquals(r, { ok: true, content: 'line1\nline2', message: 'Appended to note.', at: 5 });
});

Deno.test('apply_edit does not double up when note already ends with a newline', () => {
	const r = apply_edit('line1\n', '', 'line2');
	assertEquals(r, { ok: true, content: 'line1\nline2', message: 'Appended to note.', at: 6 });
});

Deno.test('apply_edit replaces a unique match', () => {
	const r = apply_edit('milk\neggs\nbread', 'eggs', 'cheese');
	assertEquals(r, { ok: true, content: 'milk\ncheese\nbread', message: 'Edited note.', at: 5 });
});

Deno.test('apply_edit errors when oldString is not found', () => {
	const r = apply_edit('milk\neggs', 'butter', 'x');
	assertEquals(r, { ok: false, error: 'oldString not found in note.' });
});

Deno.test('apply_edit errors on ambiguous match without replaceAll', () => {
	const r = apply_edit('a\na\na', 'a', 'b');
	assertEquals(r, {
		ok: false,
		error: 'Found multiple matches. Use replaceAll or provide more context.'
	});
});

Deno.test('apply_edit replaceAll replaces every occurrence and reports the count', () => {
	const r = apply_edit('a\na\na', 'a', 'b', true);
	assertEquals(r, {
		ok: true,
		content: 'b\nb\nb',
		message: 'Replaced 3 occurrence(s) in note.',
		at: 0
	});
});

Deno.test('apply_edit replaceAll errors when nothing matches', () => {
	const r = apply_edit('x\nx', 'a', 'b', true);
	assertEquals(r, { ok: false, error: 'oldString not found in note.' });
});

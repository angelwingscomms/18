/// <reference lib="deno.ns" />
import { indent_level, has_children, visible_indices } from './fold';
import { assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';

Deno.test('indent_level counts leading tabs', () => {
	assertEquals(indent_level(''), 0);
	assertEquals(indent_level('x'), 0);
	assertEquals(indent_level('\tx'), 1);
	assertEquals(indent_level('\t\t\tx'), 3);
});

Deno.test('has_children flags lines with deeper next line', () => {
	const lines = ['a', '\tb', '\t\tc', 'd'];
	assertEquals(has_children(lines), [true, true, false, false]);
});

Deno.test('visible_indices shows all when nothing collapsed', () => {
	const lines = ['a', '\tb', '\t\tc', 'd'];
	assertEquals(visible_indices(lines, new Set()), [0, 1, 2, 3]);
});

Deno.test('visible_indices hides descendants of a collapsed parent', () => {
	const lines = ['a', '\tb', '\t\tc', 'd'];
	assertEquals(visible_indices(lines, new Set([0])), [0, 3]);
	assertEquals(visible_indices(lines, new Set([1])), [0, 1, 3]);
});

Deno.test('visible_indices handles nested collapse', () => {
	const lines = ['a', '\tb', '\t\tc', '\t\t\td', '\te'];
	assertEquals(visible_indices(lines, new Set([0])), [0]);
	assertEquals(visible_indices(lines, new Set([1])), [0, 1, 4]);
});

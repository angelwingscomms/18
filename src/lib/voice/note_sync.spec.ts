/// <reference lib="deno.ns" />
import { reconcile_note, reconcile_tombstone } from './note_sync';
import { assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';

Deno.test('reconcile_note creates locally when only the remote has the note', () => {
	assertEquals(reconcile_note(undefined, { u: 100 }), { type: 'create_local' });
});

Deno.test('reconcile_note pushes local up when only the local has the note', () => {
	assertEquals(reconcile_note({ u: 100 }, undefined), { type: 'push_local' });
});

Deno.test('reconcile_note adopts remote when remote is strictly newer', () => {
	assertEquals(reconcile_note({ u: 100 }, { u: 200 }), { type: 'adopt_remote' });
});

Deno.test('reconcile_note pushes local when local is strictly newer', () => {
	assertEquals(reconcile_note({ u: 200 }, { u: 100 }), { type: 'push_local' });
});

Deno.test('reconcile_note is a no-op when timestamps are equal', () => {
	assertEquals(reconcile_note({ u: 100 }, { u: 100 }), { type: 'noop' });
});

Deno.test('reconcile_note is a no-op when neither side has the note', () => {
	assertEquals(reconcile_note(undefined, undefined), { type: 'noop' });
});

Deno.test('reconcile_tombstone removes the local note when the tombstone is newer', () => {
	assertEquals(reconcile_tombstone({ u: 100 }, 200, 2), 'remove_local');
});

Deno.test('reconcile_tombstone keeps the local note when it was edited after the delete', () => {
	assertEquals(reconcile_tombstone({ u: 300 }, 200, 2), 'noop');
});

Deno.test('reconcile_tombstone never removes the last remaining note', () => {
	assertEquals(reconcile_tombstone({ u: 100 }, 200, 1), 'noop');
});

Deno.test('reconcile_tombstone is a no-op when there is no local copy to remove', () => {
	assertEquals(reconcile_tombstone(undefined, 200, 2), 'noop');
});

Deno.test('reconcile_tombstone treats equal timestamps as not-newer (keeps local)', () => {
	assertEquals(reconcile_tombstone({ u: 200 }, 200, 2), 'noop');
});

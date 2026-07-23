import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { VoiceState } from './voice-state.svelte';

let roots: (() => void)[] = [];

function make(): VoiceState {
	let state!: VoiceState;
	roots.push(
		$effect.root(() => {
			state = new VoiceState();
		})
	);
	return state;
}

beforeEach(() => {
	localStorage.clear();
});

afterEach(() => {
	for (const dispose of roots) dispose();
	roots = [];
});

describe('VoiceState note handles', () => {
	it('starts with a single default note handled n1', () => {
		const v = make();
		const notes = Object.values(v.notes);
		expect(notes.length).toBe(1);
		expect(notes[0].n).toBe('n1');
		expect(v.active_note_id).toBe(notes[0].i);
	});

	it('assigns sequential handles to new notes', () => {
		const v = make();
		v.add_note('Second');
		v.add_note('Third');
		const handles = Object.values(v.notes)
			.map((n) => n.n)
			.sort();
		expect(handles).toEqual(['n1', 'n2', 'n3']);
	});

	it('note_for_id resolves by handle', () => {
		const v = make();
		v.add_note('Groceries', 'milk');
		const note = v.note_for_id('n2');
		expect(note?.t).toBe('Groceries');
	});

	it('note_for_id resolves by raw id', () => {
		const v = make();
		const first = Object.values(v.notes)[0];
		expect(v.note_for_id(first.i)?.i).toBe(first.i);
	});

	it('note_for_id falls back to the active note when omitted', () => {
		const v = make();
		expect(v.note_for_id(undefined)?.i).toBe(v.active_note_id);
	});

	it('note_for_id returns undefined for an unknown handle', () => {
		const v = make();
		expect(v.note_for_id('n99')).toBeUndefined();
	});
});

describe('VoiceState note CRUD', () => {
	it('add_note creates the note, makes it active, and opens its tab', () => {
		const v = make();
		const msg = v.add_note('Shopping', 'eggs');
		const created = Object.values(v.notes).find((n) => n.t === 'Shopping')!;
		expect(created.b).toBe('eggs');
		expect(v.active_note_id).toBe(created.i);
		expect(v.open_note_ids).toContain(created.i);
		expect(msg).toContain(created.n);
		expect(msg).toContain('Shopping');
	});

	it('read_note reports "Error: Note not found." for a missing note', () => {
		const v = make();
		expect(v.read_note('n99')).toBe('Error: Note not found.');
	});

	it('read_note numbers lines and reports the end marker', () => {
		const v = make();
		v.write_note('a\nb\nc');
		const out = v.read_note();
		expect(out).toContain('1: a');
		expect(out).toContain('2: b');
		expect(out).toContain('3: c');
		expect(out).toContain('(End - total 3 lines)');
	});

	it('read_note paginates with offset/limit and a continuation hint', () => {
		const v = make();
		v.write_note(['a', 'b', 'c', 'd', 'e'].join('\n'));
		const out = v.read_note(undefined, 2, 2);
		expect(out).toContain('2: b');
		expect(out).toContain('3: c');
		expect(out).not.toContain('1: a');
		expect(out).toContain('Showing lines 2-3 of 5');
		expect(out).toContain('offset=4');
	});

	it('edit_note replaces a unique match and bumps the updated timestamp', () => {
		const v = make();
		v.write_note('milk\neggs\nbread');
		const before = v.active_note!.u;
		const msg = v.edit_note('eggs', 'cheese');
		expect(v.active_note!.b).toBe('milk\ncheese\nbread');
		expect(v.active_note!.u).toBeGreaterThanOrEqual(before);
		expect(msg).toContain('Edited note.');
	});

	it('edit_note errors and echoes content back when the anchor is missing (no corruption)', () => {
		const v = make();
		v.write_note('milk\neggs');
		const before = v.active_note!.b;
		const msg = v.edit_note('butter', 'cheese');
		expect(v.active_note!.b).toBe(before);
		expect(msg).toContain('Error: oldString not found in note.');
		expect(msg).toContain('1: milk');
	});

	it('edit_note errors on an ambiguous match instead of guessing', () => {
		const v = make();
		v.write_note('a\na');
		const before = v.active_note!.b;
		const msg = v.edit_note('a', 'b');
		expect(v.active_note!.b).toBe(before);
		expect(msg).toContain('Found multiple matches');
	});

	it('write_note fully replaces the content', () => {
		const v = make();
		v.write_note('old content');
		const msg = v.write_note('brand new content\nwith two lines');
		expect(v.active_note!.b).toBe('brand new content\nwith two lines');
		expect(msg).toContain('2 lines');
	});

	it('insert_note at line 0 inserts before everything', () => {
		const v = make();
		v.write_note('b\nc');
		v.insert_note(0, 'a');
		expect(v.active_note!.b).toBe('a\nb\nc');
	});

	it('insert_note in the middle inserts after the given line', () => {
		const v = make();
		v.write_note('a\nc');
		v.insert_note(1, 'b');
		expect(v.active_note!.b).toBe('a\nb\nc');
	});

	it('insert_note clamps a line number past the end to the end', () => {
		const v = make();
		v.write_note('a\nb');
		v.insert_note(999, 'c');
		expect(v.active_note!.b).toBe('a\nb\nc');
	});

	it('list_notes shows handle, title, line count, and the active marker', () => {
		const v = make();
		v.write_note('one\ntwo');
		const out = v.list_notes();
		expect(out).toContain('n1: "Note" (2 lines) [active]');
	});

	it('delete_note removes the note and reassigns the active note if needed', () => {
		const v = make();
		v.add_note('Doomed');
		const doomed = Object.values(v.notes).find((n) => n.t === 'Doomed')!;
		const msg = v.delete_note(doomed.n);
		expect(v.notes[doomed.i]).toBeUndefined();
		expect(v.active_note_id).not.toBe(doomed.i);
		expect(msg).toBe('Deleted note.');
	});

	it('delete_note refuses to delete the last remaining note', () => {
		const v = make();
		const only = Object.values(v.notes)[0];
		const msg = v.delete_note(only.n);
		expect(v.notes[only.i]).toBeDefined();
		expect(msg).toBe('Error: Cannot delete the last note.');
	});

	it('rename_note updates the title and returns a confirmation', () => {
		const v = make();
		const msg = v.rename_note('Renamed');
		expect(v.active_note!.t).toBe('Renamed');
		expect(msg).toContain('Renamed');
	});

	it('focus_note switches the active note and reopens a closed tab', () => {
		const v = make();
		v.add_note('Background');
		const bg = Object.values(v.notes).find((n) => n.t === 'Background')!;
		v.open_note_ids = v.open_note_ids.filter((id) => id !== bg.i);
		v.active_note_id = Object.values(v.notes).find((n) => n.i !== bg.i)!.i;
		v.focus_note(bg.n);
		expect(v.active_note_id).toBe(bg.i);
		expect(v.open_note_ids).toContain(bg.i);
	});
});

describe('VoiceState manage_notes dispatch', () => {
	it('routes "list" to list_notes', () => {
		const v = make();
		expect(v.manage_notes('list', {})).toBe(v.list_notes());
	});

	it('routes "create" to add_note with title and content', () => {
		const v = make();
		v.manage_notes('create', { title: 'Via manage_notes', content: 'body' });
		const created = Object.values(v.notes).find((n) => n.t === 'Via manage_notes')!;
		expect(created.b).toBe('body');
	});

	it('routes "delete" to delete_note by note_id', () => {
		const v = make();
		v.add_note('ToDelete');
		const target = Object.values(v.notes).find((n) => n.t === 'ToDelete')!;
		v.manage_notes('delete', { note_id: target.n });
		expect(v.notes[target.i]).toBeUndefined();
	});

	it('routes "rename" to rename_note with title and note_id', () => {
		const v = make();
		v.manage_notes('rename', { title: 'New Name' });
		expect(v.active_note!.t).toBe('New Name');
	});

	it('routes "focus" to focus_note', () => {
		const v = make();
		v.add_note('Other');
		const other = Object.values(v.notes).find((n) => n.t === 'Other')!;
		const first_id = Object.values(v.notes).find((n) => n.i !== other.i)!.i;
		v.manage_notes('focus', { note_id: first_id });
		expect(v.active_note_id).toBe(first_id);
	});

	it('returns a helpful error for an unknown action instead of throwing', () => {
		const v = make();
		const msg = v.manage_notes('nonsense', {});
		expect(msg).toContain('unknown action "nonsense"');
		expect(msg).toContain('list, create, delete, rename, or focus');
	});
});

describe('VoiceState notes_context_block', () => {
	it('lists every note and inlines the active note under 100 lines', () => {
		const v = make();
		v.write_note('one\ntwo');
		const block = v.notes_context_block();
		expect(block).toContain('[NOTES]');
		expect(block).toContain('[active]');
		expect(block).toContain('[ACTIVE NOTE]');
		expect(block).toContain('1: one');
		expect(block).toContain('2: two');
	});

	it('does not inline an active note over 100 lines', () => {
		const v = make();
		const long = Array.from({ length: 150 }, (_, i) => `line ${i}`).join('\n');
		v.write_note(long);
		const block = v.notes_context_block();
		expect(block).toContain('150 lines — too long to inline');
		expect(block).not.toContain('1: line 0');
	});
});

describe('VoiceState quiet mode / speaker gain', () => {
	it('resume_talking clears quiet_mode and pending_quiet', () => {
		const v = make();
		v.stay_quiet();
		v.quiet_mode = true;
		v.resume_talking();
		expect(v.quiet_mode).toBe(false);
		expect(v.pending_quiet).toBe(false);
	});

	it('stay_quiet only sets pending_quiet, not quiet_mode itself (deferred until turn end)', () => {
		const v = make();
		v.stay_quiet();
		expect(v.pending_quiet).toBe(true);
		expect(v.quiet_mode).toBe(false);
	});

	it('toggleMicMute flips voice_muted independent of quiet_mode', () => {
		const v = make();
		expect(v.voice_muted).toBe(false);
		v.toggleMicMute();
		expect(v.voice_muted).toBe(true);
		expect(v.quiet_mode).toBe(false);
	});
});

describe('VoiceState AI-edit signal', () => {
	it('signal_ai_edit records the note id and line', () => {
		const v = make();
		v.signal_ai_edit('note-1', 4);
		expect(v.ai_edit_signal).toEqual(
			expect.objectContaining({ note_id: 'note-1', line: 4 })
		);
	});

	it('a later signal for a different edit gets a fresh token', () => {
		const v = make();
		v.signal_ai_edit('note-1', 1);
		const first_token = v.ai_edit_signal!.token;
		v.signal_ai_edit('note-1', 2);
		expect(v.ai_edit_signal!.token).not.toBe(first_token);
	});

	it('edit_note/write_note/insert_note each raise a signal for their own note', () => {
		const v = make();
		const id = v.active_note!.i;
		v.write_note('a\nb\nc');
		v.edit_note('b', 'B');
		expect(v.ai_edit_signal?.note_id).toBe(id);
		v.insert_note(0, 'z');
		expect(v.ai_edit_signal?.note_id).toBe(id);
	});
});

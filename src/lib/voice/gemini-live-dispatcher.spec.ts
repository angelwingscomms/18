import { describe, it, expect, vi } from 'vitest';
import { get_tool_declarations, tool_handlers } from './gemini-live-dispatcher';
import type { VoiceState } from './voice-state.svelte';

function declared_names(): string[] {
	return get_tool_declarations()[0].functionDeclarations.map((d) => d.name);
}

describe('tool declarations vs. handlers', () => {
	it('declares no duplicate tool names', () => {
		const names = declared_names();
		expect(new Set(names).size).toBe(names.length);
	});

	it('has a handler for every declared tool', () => {
		for (const name of declared_names()) {
			expect(tool_handlers[name], `missing handler for "${name}"`).toBeTypeOf('function');
		}
	});

	it('declares a tool for every handler (no orphan handlers)', () => {
		const names = new Set(declared_names());
		for (const key of Object.keys(tool_handlers)) {
			expect(names.has(key), `handler "${key}" has no matching declaration`).toBe(true);
		}
	});

	it('marks required parameters that actually have no default in the handler', () => {
		// edit_note requires oldString/newString at the schema level even though the
		// handler defaults them — this just documents that the schema's `required` list
		// is non-empty for every tool that takes at least one parameter with no sensible default.
		const decls = get_tool_declarations()[0].functionDeclarations;
		const write_note = decls.find((d) => d.name === 'write_note')!;
		expect(write_note.parameters.required).toContain('content');
		const insert_note = decls.find((d) => d.name === 'insert_note')!;
		expect(insert_note.parameters.required).toEqual(expect.arrayContaining(['line', 'text']));
		const manage_notes = decls.find((d) => d.name === 'manage_notes')!;
		expect(manage_notes.parameters.required).toEqual(['action']);
	});
});

function fake_state(overrides: Record<string, ReturnType<typeof vi.fn>> = {}) {
	return {
		tool_exa_search: vi.fn().mockResolvedValue('exa-result'),
		tool_web_fetch: vi.fn().mockResolvedValue('fetch-result'),
		read_note: vi.fn().mockReturnValue('read-result'),
		edit_note: vi.fn().mockReturnValue('edit-result'),
		write_note: vi.fn().mockReturnValue('write-result'),
		insert_note: vi.fn().mockReturnValue('insert-result'),
		tool_search_notes: vi.fn().mockResolvedValue('search-result'),
		tool_clear_chat: vi.fn().mockReturnValue('clear-result'),
		manage_notes: vi.fn().mockReturnValue('manage-result'),
		change_voice: vi.fn().mockReturnValue('voice-result'),
		stay_quiet: vi.fn().mockReturnValue('quiet-result'),
		resume_talking: vi.fn().mockReturnValue('talk-result'),
		tool_end_chat: vi.fn().mockReturnValue('end-result'),
		...overrides
	} as unknown as VoiceState;
}

describe('tool_handlers argument forwarding', () => {
	it('exa_search forwards query and type', () => {
		const state = fake_state();
		tool_handlers.exa_search(state, { query: 'weather', type: 'instant' });
		expect(state.tool_exa_search).toHaveBeenCalledWith('weather', 'instant');
	});

	it('web_fetch defaults offset to 1 and limit to 2000', () => {
		const state = fake_state();
		tool_handlers.web_fetch(state, { url: 'https://example.com' });
		expect(state.tool_web_fetch).toHaveBeenCalledWith('https://example.com', 1, 2000);
	});

	it('web_fetch forwards explicit offset/limit', () => {
		const state = fake_state();
		tool_handlers.web_fetch(state, { url: 'https://example.com', offset: 50, limit: 10 });
		expect(state.tool_web_fetch).toHaveBeenCalledWith('https://example.com', 50, 10);
	});

	it('read_note defaults note_id to undefined, offset to 1, limit to 2000', () => {
		const state = fake_state();
		tool_handlers.read_note(state, {});
		expect(state.read_note).toHaveBeenCalledWith(undefined, 1, 2000);
	});

	it('read_note forwards an explicit note_id', () => {
		const state = fake_state();
		tool_handlers.read_note(state, { note_id: 'n2', offset: 5, limit: 20 });
		expect(state.read_note).toHaveBeenCalledWith('n2', 5, 20);
	});

	it('edit_note defaults oldString/newString to empty string and replaceAll to false', () => {
		const state = fake_state();
		tool_handlers.edit_note(state, {});
		expect(state.edit_note).toHaveBeenCalledWith('', '', false, undefined);
	});

	it('edit_note forwards all four arguments', () => {
		const state = fake_state();
		tool_handlers.edit_note(state, {
			oldString: 'old',
			newString: 'new',
			replaceAll: true,
			note_id: 'n3'
		});
		expect(state.edit_note).toHaveBeenCalledWith('old', 'new', true, 'n3');
	});

	it('write_note defaults content to empty string', () => {
		const state = fake_state();
		tool_handlers.write_note(state, { note_id: 'n1' });
		expect(state.write_note).toHaveBeenCalledWith('', 'n1');
	});

	it('insert_note defaults line to 0 and text to empty string', () => {
		const state = fake_state();
		tool_handlers.insert_note(state, {});
		expect(state.insert_note).toHaveBeenCalledWith(0, '', undefined);
	});

	it('search_notes forwards the query', () => {
		const state = fake_state();
		tool_handlers.search_notes(state, { query: 'groceries' });
		expect(state.tool_search_notes).toHaveBeenCalledWith('groceries');
	});

	it('clear_chat ignores args and calls tool_clear_chat with no arguments', () => {
		const state = fake_state();
		tool_handlers.clear_chat(state, { anything: 'ignored' });
		expect(state.tool_clear_chat).toHaveBeenCalledWith();
	});

	it('manage_notes forwards the action and the full args object', () => {
		const state = fake_state();
		const args = { action: 'rename', note_id: 'n1', title: 'New Title' };
		tool_handlers.manage_notes(state, args);
		expect(state.manage_notes).toHaveBeenCalledWith('rename', args);
	});

	it('change_voice forwards voice_name', () => {
		const state = fake_state();
		tool_handlers.change_voice(state, { voice_name: 'Puck' });
		expect(state.change_voice).toHaveBeenCalledWith('Puck');
	});

	it('stay_quiet, resume_talking, and end_chat take no arguments', () => {
		const state = fake_state();
		tool_handlers.stay_quiet(state, {});
		tool_handlers.resume_talking(state, {});
		tool_handlers.end_chat(state, {});
		expect(state.stay_quiet).toHaveBeenCalledWith();
		expect(state.resume_talking).toHaveBeenCalledWith();
		expect(state.tool_end_chat).toHaveBeenCalledWith();
	});
});

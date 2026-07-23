import type { VoiceState } from './voice-state.svelte';

export function get_tool_declarations() {
	return [
		{
			functionDeclarations: [
				{
					name: 'exa_search',
					description: 'Search the web for current, up-to-date information.',
					parameters: {
						type: 'object',
						properties: {
							query: {
								type: 'string',
								description: 'The search query',
							},
							type: {
								type: 'string',
								description: 'Search depth. Recommended types (favored):\n- "instant" (~250ms): fastest, use for simple factoid queries where latency matters most — this is the best default for voice.\n- "auto" (~1s): balanced speed/quality, use when instant is too shallow.\n- "deep-reasoning" (12-40s): maximum depth, use for complex multi-source research.\n\nAlso available (use sparingly):\n- "fast" (~450ms): middle ground between instant and auto.\n- "deep-lite" (~4s): lightweight synthesized output.\n- "deep" (4-15s): full multi-step reasoning.',
								default: 'auto',
							},
						},
						required: ['query'],
					},
				},
				{
					name: 'web_fetch',
					description: 'Fetch and read the content of a webpage. Use offset/limit to paginate through long content (like reading a book page by page).',
					parameters: {
						type: 'object',
						properties: {
							url: {
								type: 'string',
								description: 'The full URL to fetch (e.g. https://example.com/page)',
							},
							offset: {
								type: 'number',
								description: 'Line number to start reading from (1-indexed, default 1)',
							},
							limit: {
								type: 'number',
								description: 'Maximum number of lines to return (default 2000)',
							},
						},
						required: ['url'],
					},
				},
				{
					name: 'read_note',
					description: 'Read lines from a note. If note_id is omitted, reads the active note.',
					parameters: {
						type: 'object',
						properties: {
							note_id: {
								type: 'string',
								description: 'The note handle to read, e.g. "n1" (omit for active note)',
							},
							offset: {
								type: 'number',
								description: 'Line number to start reading from (1-indexed, default 1)',
							},
							limit: {
								type: 'number',
								description: 'Maximum number of lines to read (default 2000)',
							},
						},
					},
				},
				{
					name: 'edit_note',
					description: 'Edit a note by replacing exact text. If note_id is omitted, edits the active note. Use empty oldString to append. Errors (no match / multiple matches) return the current note content so you can retry immediately.',
					parameters: {
						type: 'object',
						properties: {
							note_id: {
								type: 'string',
								description: 'The note handle to edit, e.g. "n1" (omit for active note)',
							},
							oldString: {
								type: 'string',
								description: 'The exact text in the note to replace (empty = append newString)',
							},
							newString: {
								type: 'string',
								description: 'The text to replace it with',
							},
							replaceAll: {
								type: 'boolean',
								description: 'Replace all occurrences instead of just the first (default false)',
							},
						},
						required: ['oldString', 'newString'],
					},
				},
				{
					name: 'write_note',
					description: 'Replace a note\'s entire content. Prefer this over edit_note when rewriting or restructuring most of a note, instead of chaining several fragile edit_note calls.',
					parameters: {
						type: 'object',
						properties: {
							note_id: {
								type: 'string',
								description: 'The note handle to write, e.g. "n1" (omit for active note)',
							},
							content: {
								type: 'string',
								description: 'The full new content of the note',
							},
						},
						required: ['content'],
					},
				},
				{
					name: 'insert_note',
					description: 'Insert text as new line(s) after a given line number in a note, without needing to match existing text.',
					parameters: {
						type: 'object',
						properties: {
							note_id: {
								type: 'string',
								description: 'The note handle to insert into, e.g. "n1" (omit for active note)',
							},
							line: {
								type: 'number',
								description: 'Insert after this line number (1-indexed). Use 0 to insert at the very start.',
							},
							text: {
								type: 'string',
								description: 'The text to insert (can be multiple lines)',
							},
						},
						required: ['line', 'text'],
					},
				},
				{
					name: 'search_notes',
					description: 'Semantically search across all of the user\'s notes and return the best-matching ones. Use this when the user asks you to find a note by topic rather than by name.',
					parameters: {
						type: 'object',
						properties: {
							query: {
								type: 'string',
								description: 'What to search for',
							},
						},
						required: ['query'],
					},
				},
				{
					name: 'clear_chat',
					description: 'Clear all chat messages.',
					parameters: {
						type: 'object',
						properties: {},
					},
				},
				{
					name: 'manage_notes',
					description: 'Manage notes other than editing their content: list all notes, create a new one, delete one, rename one, or focus one as the active note shown in the editor.',
					parameters: {
						type: 'object',
						properties: {
							action: {
								type: 'string',
								description: 'One of: "list", "create", "delete", "rename", "focus".',
							},
							note_id: {
								type: 'string',
								description: 'Note handle, e.g. "n1". Required for delete; omit for the active note on rename/focus.',
							},
							title: {
								type: 'string',
								description: 'Required for create and rename.',
							},
							content: {
								type: 'string',
								description: 'Optional initial content, only used for create.',
							},
						},
						required: ['action'],
					},
				},
				{
					name: 'change_voice',
					description: 'Change the voice Gemini speaks with. The live session will be restarted to apply the new voice.',
					parameters: {
						type: 'object',
						properties: {
							voice_name: {
								type: 'string',
								description: 'The voice name to use (e.g. Kore, Charon, Puck, Aoede).',
							},
						},
						required: ['voice_name'],
					},
				},
				{
					name: 'stay_quiet',
					description: 'Mute your voice and hide your chat replies, while you keep listening and keep working (including calling tools) normally. Call this when the user says things like "stay quiet", "stop talking", "shush", "quiet down" — they want a break from hearing/seeing you, not from you listening.',
					parameters: {
						type: 'object',
						properties: {},
					},
				},
				{
					name: 'resume_talking',
					description: 'Unmute your voice and start replying normally again. Call this when the user asks you to resume, unmute, stop being quiet, or calls your name / addresses you directly (e.g. "Gemini", "hey chat", "hey live") while quiet mode is active.',
					parameters: {
						type: 'object',
						properties: {},
					},
				},
				{
					name: 'end_chat',
					description: 'End the conversation and disconnect entirely. Call this only when the user clearly wants to end the session for good (e.g. "end chat", "hang up", "disconnect", "we\'re done") — NOT when they just want quiet, which is stay_quiet instead. After end_chat the user must manually reconnect to talk to you again.',
					parameters: {
						type: 'object',
						properties: {},
					},
				},
			],
		},
	];
}

export type ToolHandler = (state: VoiceState, args: Record<string, any>) => string | Promise<string>;

export const tool_handlers: Record<string, ToolHandler> = {
	exa_search: (state, args) => state.tool_exa_search(args.query, args.type),
	web_fetch: (state, args) => state.tool_web_fetch(args.url, args.offset ?? 1, args.limit ?? 2000),
	read_note: (state, args) => state.read_note(args.note_id, args.offset ?? 1, args.limit ?? 2000),
	edit_note: (state, args) =>
		state.edit_note(args.oldString ?? '', args.newString ?? '', args.replaceAll ?? false, args.note_id),
	write_note: (state, args) => state.write_note(args.content ?? '', args.note_id),
	insert_note: (state, args) => state.insert_note(args.line ?? 0, args.text ?? '', args.note_id),
	search_notes: (state, args) => state.tool_search_notes(args.query),
	clear_chat: (state) => state.tool_clear_chat(),
	manage_notes: (state, args) => state.manage_notes(args.action, args),
	change_voice: (state, args) => state.change_voice(args.voice_name),
	stay_quiet: (state) => state.stay_quiet(),
	resume_talking: (state) => state.resume_talking(),
	end_chat: (state) => state.tool_end_chat(),
};

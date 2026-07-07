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
					name: 'read_note',
					description: 'Read lines from a note. If note_id is omitted, reads the active note.',
					parameters: {
						type: 'object',
						properties: {
							note_id: {
								type: 'string',
								description: 'The note id to read (omit for active note)',
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
					description: 'Edit a note by replacing exact text. If note_id is omitted, edits the active note. Use empty oldString to append.',
					parameters: {
						type: 'object',
						properties: {
							note_id: {
								type: 'string',
								description: 'The note id to edit (omit for active note)',
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
					name: 'clear_chat',
					description: 'Clear all chat messages.',
					parameters: {
						type: 'object',
						properties: {},
					},
				},
				{
					name: 'list_notes',
					description: 'List all notes with their titles and line counts.',
					parameters: {
						type: 'object',
						properties: {},
					},
				},
				{
					name: 'add_note',
					description: 'Create a new note with the given title and optional initial content. Becomes the active note.',
					parameters: {
						type: 'object',
						properties: {
							title: {
								type: 'string',
								description: 'Title for the new note',
							},
							content: {
								type: 'string',
								description: 'Optional initial content for the note',
							},
						},
						required: ['title'],
					},
				},
				{
					name: 'delete_note',
					description: 'Delete a note by id.',
					parameters: {
						type: 'object',
						properties: {
							note_id: {
								type: 'string',
								description: 'The note id to delete',
							},
						},
						required: ['note_id'],
					},
				},
				{
					name: 'rename_note',
					description: 'Rename a note. If note_id is omitted, renames the active note.',
					parameters: {
						type: 'object',
						properties: {
							note_id: {
								type: 'string',
								description: 'The note id to rename (omit for active note)',
							},
							title: {
								type: 'string',
								description: 'New title for the note',
							},
						},
						required: ['title'],
					},
				},
			],
		},
	];
}

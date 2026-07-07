export function get_tool_declarations() {
	return [
		{
			functionDeclarations: [
				{
					name: 'exa_search',
					description: 'Search the web for current, up-to-date information. Always use this for any query that could be time-sensitive, period-sensitive, or about recent events, news, prices, weather, dates, releases, or anything that may have changed recently.',
					parameters: {
						type: 'object',
						properties: {
							query: {
								type: 'string',
								description: 'The search query',
							},
							type: {
								type: 'string',
								description: 'Search depth. "auto" is fast (~1s), good for most queries. "deep-reasoning" is slower (12-40s) but does multi-step reasoning across sources — use when the query is complex, controversial, or needs deep synthesis across multiple pages.',
								default: 'auto',
							},
						},
						required: ['query'],
					},
				},
			],
		},
	];
}

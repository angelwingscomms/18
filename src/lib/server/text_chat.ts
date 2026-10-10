const GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions';
const MODEL = 'openai/gpt-oss-120b';
const MAX_MESSAGES = 40;

export type ChatTurn = { role: 'user' | 'assistant'; content: string };

async function groq_key(env: App.Platform['env'], override?: string) {
	const o = override?.trim();
	if (o) return o;
	const source = env.GROQ as string | { get(): Promise<string> } | undefined;
	if (!source) return '';
	try {
		return (typeof source === 'string' ? source : await source.get()).trim();
	} catch {
		return '';
	}
}

export async function text_reply(
	env: App.Platform['env'],
	messages: ChatTurn[],
	system: string,
	override?: string
): Promise<string> {
	const key = await groq_key(env, override);
	if (!key) throw new Error('missing groq key');
	const history = messages
		.filter((m) => m.content.trim())
		.slice(-MAX_MESSAGES)
		.map((m) => ({ role: m.role, content: m.content }));
	const res = await fetch(GROQ_URL, {
		method: 'POST',
		headers: {
			Authorization: `Bearer ${key}`,
			'Content-Type': 'application/json'
		},
		body: JSON.stringify({
			model: MODEL,
			messages: [{ role: 'system', content: system }, ...history],
			temperature: 0.6,
			max_completion_tokens: 2048,
			include_reasoning: false
		}),
		signal: AbortSignal.timeout(45000)
	});
	if (!res.ok) throw new Error('groq ' + res.status);
	const data = (await res.json()) as { choices?: { message?: { content?: string } }[] };
	const text = data.choices?.[0]?.message?.content?.trim();
	if (!text) throw new Error('text chat unavailable');
	return text;
}

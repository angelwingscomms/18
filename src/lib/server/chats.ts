import { QdrantClient } from '@qdrant/js-client-rest';

export const COL = 'chats';
export const VECTOR_SIZE = 4096;
export const EMBED_MODEL = 'jcorners/ingot-8b-r3';

let qdrant: QdrantClient | null = null;

export async function get_client(env: Env): Promise<QdrantClient> {
	if (!qdrant) {
		const [url, key] = await Promise.all([env.QDRANT_URL.get(), env.QDRANT_KEY.get()]);
		qdrant = new QdrantClient({ url, apiKey: key, checkCompatibility: false });
	}
	return qdrant;
}

let ensured = false;
export async function ensure_collection(c: QdrantClient) {
	if (ensured) return;
	if (!(await c.collectionExists(COL)).exists) {
		await c.createCollection(COL, { vectors: { size: VECTOR_SIZE, distance: 'Cosine' } });
	}
	ensured = true;
}

export async function embed(env: Env, text: string): Promise<number[]> {
	try {
		const key = await env.VOXELL_KEY.get();
		const r = await fetch('https://api.voxell.ai/v1/embeddings', {
			method: 'POST',
			headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
			body: JSON.stringify({ model: EMBED_MODEL, input: text || ' ' })
		});
		if (!r.ok) throw new Error(`voxell embed failed: ${r.status}`);
		const d: any = await r.json();
		return d.data[0].embedding;
	} catch (e) {
		console.error('[chats] embed failed, falling back to zero vector', e);
		return new Array(VECTOR_SIZE).fill(0);
	}
}

export async function owns(c: QdrantClient, id: string, uid: string): Promise<boolean> {
	const pts = await c.retrieve(COL, { ids: [id], with_payload: true });
	return pts.length === 0 || pts[0].payload?.s === uid;
}

export function chat_to_text(t: string, m: { content: string }[]): string {
	return `${t}\n\n${m.map((x) => x.content).join('\n')}`;
}

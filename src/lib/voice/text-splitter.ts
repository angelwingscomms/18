export interface Chunk {
	text: string;
	index: number;
}

const SENTENCE_BOUNDARY = /(?<=[.!?])\s+/;
const MAX_CHUNK_SIZE = 200;

export class TextSplitterStream {
	private buffer = '';
	private chunkIndex = 0;

	feed(partial: string): Chunk[] {
		this.buffer += partial;
		const chunks: Chunk[] = [];
		while (this.buffer.length > 0) {
			const match = this.buffer.match(SENTENCE_BOUNDARY);
			if (match) {
				const sentence = this.buffer.substring(0, match.index! + match[0].length);
				if (sentence.length <= MAX_CHUNK_SIZE) {
					chunks.push({ text: sentence.trim(), index: this.chunkIndex++ });
					this.buffer = this.buffer.substring(match.index! + match[0].length);
				} else {
					const lastSpace = sentence.lastIndexOf(' ', MAX_CHUNK_SIZE);
					if (lastSpace > 0) {
						const split = sentence.substring(0, lastSpace);
						chunks.push({ text: split.trim(), index: this.chunkIndex++ });
						this.buffer = sentence.substring(lastSpace).trimStart() + this.buffer.substring(match.index! + match[0].length);
					} else {
						const split = sentence.substring(0, MAX_CHUNK_SIZE);
						chunks.push({ text: split.trim(), index: this.chunkIndex++ });
						this.buffer = this.buffer.substring(MAX_CHUNK_SIZE);
					}
				}
			} else if (this.buffer.length > MAX_CHUNK_SIZE) {
				const lastSpace = this.buffer.lastIndexOf(' ', MAX_CHUNK_SIZE);
				if (lastSpace > 0) {
					const split = this.buffer.substring(0, lastSpace);
					chunks.push({ text: split.trim(), index: this.chunkIndex++ });
					this.buffer = this.buffer.substring(lastSpace).trimStart();
				} else {
					const split = this.buffer.substring(0, MAX_CHUNK_SIZE);
					chunks.push({ text: split.trim(), index: this.chunkIndex++ });
					this.buffer = this.buffer.substring(MAX_CHUNK_SIZE);
				}
			} else {
				break;
			}
		}
		return chunks;
	}

	flush(): Chunk[] {
		const chunks: Chunk[] = [];
		if (this.buffer.trim()) {
			chunks.push({ text: this.buffer.trim(), index: this.chunkIndex++ });
			this.buffer = '';
		}
		return chunks;
	}

	static split(text: string): Chunk[] {
		const instance = new TextSplitterStream();
		return instance.feed(text).concat(instance.flush());
	}
}
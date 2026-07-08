import { describe, it, expect } from 'vitest';
import { TextSplitterStream, type Chunk } from './text-splitter';

describe('TextSplitterStream', () => {
	it('splits text at sentence boundaries', () => {
		const chunks = TextSplitterStream.split('Hello world. How are you? I am fine.');
		expect(chunks).toHaveLength(3);
		expect(chunks[0].text).toBe('Hello world.');
		expect(chunks[1].text).toBe('How are you?');
		expect(chunks[2].text).toBe('I am fine.');
	});

	it('returns single chunk for short text without punctuation', () => {
		const chunks = TextSplitterStream.split('Hello world');
		expect(chunks).toHaveLength(1);
		expect(chunks[0].text).toBe('Hello world');
	});

	it('handles empty text', () => {
		const chunks = TextSplitterStream.split('');
		expect(chunks).toHaveLength(0);
	});

	it('handles whitespace-only text', () => {
		const chunks = TextSplitterStream.split('   ');
		expect(chunks).toHaveLength(0);
	});

	it('splits long text exceeding max chunk size at word boundary', () => {
		const long = 'a'.repeat(100) + ' ' + 'b'.repeat(100) + ' ' + 'c'.repeat(50);
		const chunks = TextSplitterStream.split(long);
		expect(chunks.length).toBeGreaterThan(1);
		for (const c of chunks) {
			expect(c.text.length).toBeLessThanOrEqual(210);
		}
	});

	it('splits text with multiple sentences into correct number of chunks', () => {
		const text = 'First sentence. Second sentence! Third sentence? Fourth.';
		const chunks = TextSplitterStream.split(text);
		expect(chunks).toHaveLength(4);
		expect(chunks[0].text).toBe('First sentence.');
		expect(chunks[1].text).toBe('Second sentence!');
		expect(chunks[2].text).toBe('Third sentence?');
		expect(chunks[3].text).toBe('Fourth.');
	});

	it('assigns sequential indices', () => {
		const chunks = TextSplitterStream.split('A. B. C.');
		chunks.forEach((c, i) => {
			expect(c.index).toBe(i);
		});
	});

	it('feed + flush produces correct chunks', () => {
		const splitter = new TextSplitterStream();
		const first = splitter.feed('Hello world. ');
		const second = splitter.feed('How are you? ');
		const flushed = splitter.flush();
		const all = [...first, ...second, ...flushed];
		expect(all).toHaveLength(2);
		expect(all[0].text).toBe('Hello world.');
		expect(all[1].text).toBe('How are you?');
	});
});

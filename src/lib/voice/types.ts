export type ChatMsg = { role: 'user' | 'assistant'; content: string };

export interface Note {
	id: string;
	title: string;
	content: string;
}

export const model_options = [
	{ v: 'gemini-3.1-flash-live-preview', l: 'Gemini 3.1 Flash Live', d: 'Latest live model with native audio + web search' },
	{ v: 'gemini-2.5-flash-native-audio-preview-12-2025', l: 'Gemini 2.5 Flash Native Audio', d: 'Deprecated — native audio dialog model' },
];

export const voice_options = [
	{ v: 'Kore', l: 'Kore', d: 'Firm' },
	{ v: 'Zephyr', l: 'Zephyr', d: 'Bright' },
	{ v: 'Orus', l: 'Orus', d: 'Firm' },
	{ v: 'Puck', l: 'Puck', d: 'Upbeat' },
	{ v: 'Fenrir', l: 'Fenrir', d: 'Excitable' },
	{ v: 'Aoede', l: 'Aoede', d: 'Breezy' },
	{ v: 'Charon', l: 'Charon', d: 'Informative' },
	{ v: 'Leda', l: 'Leda', d: 'Youthful' },
	{ v: 'Umbriel', l: 'Umbriel', d: 'Easy-going' },
	{ v: 'Erinome', l: 'Erinome', d: 'Clear' },
	{ v: 'Algieba', l: 'Algieba', d: 'Smooth' },
	{ v: 'Achernar', l: 'Achernar', d: 'Soft' },
	{ v: 'Gacrux', l: 'Gacrux', d: 'Mature' },
	{ v: 'Despina', l: 'Despina', d: 'Smooth' },
	{ v: 'Sulafat', l: 'Sulafat', d: 'Warm' },
	{ v: 'Autonoe', l: 'Autonoe', d: 'Bright' },
	{ v: 'Laomedeia', l: 'Laomedeia', d: 'Upbeat' },
	{ v: 'Schedar', l: 'Schedar', d: 'Even' },
	{ v: 'Achird', l: 'Achird', d: 'Friendly' },
	{ v: 'Sadachbia', l: 'Sadachbia', d: 'Lively' },
	{ v: 'Enceladus', l: 'Enceladus', d: 'Breathy' },
	{ v: 'Algenib', l: 'Algenib', d: 'Gravelly' },
	{ v: 'Zubenelgenubi', l: 'Zubenelgenubi', d: 'Casual' },
	{ v: 'Sadaltager', l: 'Sadaltager', d: 'Knowledgeable' },
	{ v: 'Callirrhoe', l: 'Callirrhoe', d: 'Easy-going' },
	{ v: 'Iapetus', l: 'Iapetus', d: 'Clear' },
	{ v: 'Rasalgethi', l: 'Rasalgethi', d: 'Informative' },
	{ v: 'Alnilam', l: 'Alnilam', d: 'Firm' },
	{ v: 'Pulcherrima', l: 'Pulcherrima', d: 'Forward' },
	{ v: 'Vindemiatrix', l: 'Vindemiatrix', d: 'Gentle' },
];

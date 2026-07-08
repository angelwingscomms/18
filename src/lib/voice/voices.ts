export type VoiceId = string;

export interface VoiceInfo {
	name: string;
	size: number;
	lang: string;
}

export const VOICES: Record<VoiceId, VoiceInfo> = {
	'en_US-hfc_female-medium': { name: 'HFC Female', size: 20, lang: 'en' },
	'en_US-lessac-medium': { name: 'Lessac Male', size: 20, lang: 'en' },
	'en_US-ryan-medium': { name: 'Ryan Male', size: 40, lang: 'en' },
	'en_US-libritts_r-medium': { name: 'LibriTTS R', size: 75, lang: 'en' },
};

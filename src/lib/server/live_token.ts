import { GoogleGenAI, Modality } from '@google/genai';
import { model_options } from '$lib/voice/types';

export async function live_token(env: App.Platform['env']) {
	const source = env.GEMINI;
	const token = await new GoogleGenAI({
		apiKey: (typeof source === 'string' ? source : await source.get()).trim(),
		httpOptions: { apiVersion: 'v1alpha', timeout: 10000 }
	}).authTokens.create({
		config: {
			uses: 1,
			lockAdditionalFields: [],
			expireTime: new Date(Date.now() + 1800000).toISOString(),
			newSessionExpireTime: new Date(Date.now() + 60000).toISOString(),
			liveConnectConstraints: {
				model: model_options[0].v,
				config: { responseModalities: [Modality.AUDIO] }
			}
		}
	});
	if (!token.name) throw new Error('voice authentication unavailable');
	return token.name;
}

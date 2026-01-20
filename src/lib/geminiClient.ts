import { GoogleGenerativeAI } from '@google/generative-ai';
import { GEMINI_API_KEY } from '$env/static/private';

let geminiClient: GoogleGenerativeAI | null = null;

// Modèle par défaut : gemini-2.5-flash (rapide et moins cher, stable)
// Modèles disponibles :
// - gemini-2.5-flash : Rapide et moins cher (recommandé)
// - gemini-2.5-pro : Plus puissant mais plus lent et plus cher
// - gemini-2.5-flash-lite : Version légère pour haut débit
const DEFAULT_MODEL = 'gemini-2.5-flash';

export function getGeminiClient(): GoogleGenerativeAI {
	if (!geminiClient) {
		if (!GEMINI_API_KEY) {
			throw new Error('GEMINI_API_KEY is not set in environment variables');
		}
		geminiClient = new GoogleGenerativeAI(GEMINI_API_KEY);
	}
	return geminiClient;
}

export async function generateText(prompt: string): Promise<string> {
	const client = getGeminiClient();
	// Utiliser gemini-2.5-flash par défaut (rapide et moins cher, stable)
	// Pour utiliser un autre modèle, modifiez DEFAULT_MODEL ci-dessus
	const model = client.getGenerativeModel({ model: DEFAULT_MODEL });
	
	const result = await model.generateContent(prompt);
	const response = await result.response;
	return response.text();
}

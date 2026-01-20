import { generateText } from './geminiClient';
import { supabase } from './supabaseClient';

export interface Question {
	content: string;
	response: string;
}

/**
 * Génère des questions avec leurs réponses associées en utilisant Gemini
 * @param count Le nombre de questions à générer
 * @returns Un tableau de questions avec leurs réponses
 */
export async function generateQuestions(count: number): Promise<Question[]> {
	const prompt = `Génère ${count} questions de quiz amusantes et variées pour un jeu de bluff/quiz. 
Chaque question doit être intéressante et avoir une réponse claire et factuelle.

Format de réponse attendu (JSON valide) :
{
  "questions": [
    {
      "content": "Question ici",
      "response": "Réponse ici"
    }
  ]
}

Les questions doivent être variées (histoire, géographie, sciences, culture générale, etc.) et adaptées à un public général.
Réponds UNIQUEMENT avec le JSON, sans texte supplémentaire avant ou après.`;

	try {
		const response = await generateText(prompt);
		
		// Nettoyer la réponse pour extraire le JSON
		const jsonMatch = response.match(/\{[\s\S]*\}/);
		if (!jsonMatch) {
			throw new Error('Réponse de Gemini ne contient pas de JSON valide');
		}

		const parsed = JSON.parse(jsonMatch[0]);
		
		if (!parsed.questions || !Array.isArray(parsed.questions)) {
			throw new Error('Format de réponse invalide : propriété "questions" manquante');
		}

		return parsed.questions.map((q: any) => ({
			content: q.content || q.question || '',
			response: q.response || q.answer || ''
		}));
	} catch (error) {
		console.error('Erreur lors de la génération des questions:', error);
		throw new Error(`Erreur lors de la génération des questions: ${error instanceof Error ? error.message : 'Erreur inconnue'}`);
	}
}

/**
 * Insère des questions générées dans la base de données Supabase
 * @param questions Les questions à insérer
 * @param roomId L'ID de la room
 * @param roundNumber Le numéro du round
 * @returns Les questions insérées avec leurs IDs
 */
export async function insertQuestions(
	questions: Question[],
	roomId: string,
	roundNumber: number
): Promise<any[]> {
	const questionsToInsert = questions.map((q) => ({
		content: q.content,
		response: q.response,
		room_id: roomId,
		round_number: roundNumber
	}));

	const { data, error } = await supabase
		.from('question')
		.insert(questionsToInsert)
		.select();

	if (error) {
		throw new Error(`Erreur lors de l'insertion des questions: ${error.message}`);
	}

	return data || [];
}

/**
 * Génère et insère des questions dans la base de données
 * @param count Le nombre de questions à générer
 * @param roomId L'ID de la room
 * @param roundNumber Le numéro du round
 * @returns Les questions insérées
 */
export async function generateAndInsertQuestions(
	count: number,
	roomId: string,
	roundNumber: number
): Promise<any[]> {
	const questions = await generateQuestions(count);
	return await insertQuestions(questions, roomId, roundNumber);
}

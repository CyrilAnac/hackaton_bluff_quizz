import { generateText } from './geminiClient';
import { supabase } from './supabaseClient';

export interface Question {
	content: string;
}

/**
 * Génère des questions difficiles pour un jeu de bluff où les joueurs doivent répondre avec une phrase
 * Les questions sont conçues pour créer du doute et permettre des réponses ambiguës
 * @param count Le nombre de questions à générer
 * @returns Un tableau de questions
 */
export async function generateQuestions(count: number): Promise<Question[]> {
	const prompt = `Génère ${count} questions difficiles et ambiguës pour un jeu de bluff/quiz. 
Ces questions doivent être suffisamment difficiles pour créer du doute chez les joueurs, et doivent pouvoir être répondues avec une phrase (pas juste un mot ou un nombre).

Les questions doivent :
- Être suffisamment difficiles pour que les joueurs ne soient pas sûrs de la réponse
- Permettre des réponses formulées en phrase (pas juste "Paris" mais "La capitale de la France")
- Créer de l'ambiguïté et du doute entre les joueurs
- Être variées (histoire, géographie, sciences, culture générale, etc.)

Exemples de bonnes questions :
- "Quel événement historique a marqué le début de la Renaissance en Europe ?"
- "Quelle est la particularité géographique qui distingue l'Islande de la plupart des autres îles ?"
- "Quel scientifique est crédité de la découverte de la structure en double hélice de l'ADN ?"

Format de réponse attendu (JSON valide) :
{
  "questions": [
    {
      "content": "Question ici"
    }
  ]
}

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
			content: q.content || q.question || ''
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

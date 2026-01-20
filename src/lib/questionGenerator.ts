import { generateText } from './geminiClient';
import { supabase } from './supabaseClient';

export interface Question {
	content: string;
	accepted_answers: string[];
}

/**
 * Génère des questions difficiles pour un jeu de bluff où les joueurs doivent répondre avec une phrase
 * Les questions sont conçues pour créer du doute et permettre des réponses ambiguës
 * @param count Le nombre de questions à générer
 * @returns Un tableau de questions
 */
export async function generateQuestions(count: number): Promise<Question[]> {
	const prompt = `Génère ${count} questions de culture générale insolites et méconnues pour un jeu de bluff.
Les questions doivent être difficiles (peu de gens connaissent la réponse) mais doivent avoir une réponse factuelle unique et claire.

Pour chaque question, fournis une liste de "accepted_answers" qui contient :
- La bonne réponse exacte.
- Les variations d'orthographe acceptables (avec/sans accents).
- Les synonymes ou formulations proches (ex: "Louis 14", "Louis XIV", "Le Roi Soleil").

Les questions doivent :
- Porter sur des faits surprenants ou des anecdotes historiques/scientifiques peu connues.
- Avoir une réponse qui peut s'exprimer par une courte phrase ou un nom propre.
- Ne PAS être ambiguës.

Exemple de format attendu (JSON valide) :
{
  "questions": [
    {
      "content": "Quel animal est connu pour avoir des empreintes digitales presque indiscernables de celles des humains ?",
      "accepted_answers": ["Le koala", "Koala", "Les koalas"]
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
			content: q.content || q.question || '',
			accepted_answers: q.accepted_answers || []
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
		accepted_answers: q.accepted_answers,
		room_id: roomId,
		round_number: roundNumber
	}));

	const { data, error } = await supabase
		.from('question')
		.insert(questionsToInsert)
		.select();

	if (error) {
		console.error("Supabase insert error:", error);
		if (error.message?.includes("accepted_answers")) {
			console.error("IMPORTANT: Did you add the 'accepted_answers' column to the 'question' table in Supabase?");
			console.error("Run SQL: alter table \"public\".\"question\" add column \"accepted_answers\" text[] default '{}';");
		}
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

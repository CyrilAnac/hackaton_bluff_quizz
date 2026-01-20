import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { generateAndInsertQuestions } from '$lib/questionGenerator';

export const POST: RequestHandler = async ({ request }) => {
	try {
		const body = await request.json();
		const { count, roomId, roundNumber } = body;

		// Validation des paramètres
		if (!count || typeof count !== 'number' || count <= 0) {
			return json(
				{ error: 'Le paramètre "count" doit être un nombre positif' },
				{ status: 400 }
			);
		}

		if (!roomId || typeof roomId !== 'string') {
			return json(
				{ error: 'Le paramètre "roomId" est requis' },
				{ status: 400 }
			);
		}

		if (!roundNumber || typeof roundNumber !== 'number' || roundNumber <= 0) {
			return json(
				{ error: 'Le paramètre "roundNumber" doit être un nombre positif' },
				{ status: 400 }
			);
		}

		// Générer et insérer les questions
		const questions = await generateAndInsertQuestions(count, roomId, roundNumber);

		return json({
			success: true,
			questions,
			count: questions.length
		});
	} catch (error) {
		console.error('Erreur lors de la génération des questions:', error);
		return json(
			{
				error: error instanceof Error ? error.message : 'Erreur lors de la génération des questions'
			},
			{ status: 500 }
		);
	}
};

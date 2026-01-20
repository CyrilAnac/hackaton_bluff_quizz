import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { generateText } from '$lib/geminiClient';
import { supabase } from '$lib/supabaseClient';

export const POST: RequestHandler = async ({ request }) => {
	try {
		const body = await request.json();
		const { questionId, answer } = body;

		// Validation des paramètres
		if (!questionId || typeof questionId !== 'string') {
			return json(
				{ error: 'Le paramètre "questionId" est requis' },
				{ status: 400 }
			);
		}

		if (!answer || typeof answer !== 'string' || answer.trim().length === 0) {
			return json(
				{ error: 'Le paramètre "answer" est requis et ne doit pas être vide' },
				{ status: 400 }
			);
		}

		// Récupérer la question depuis la base de données
		const { data: question, error: questionError } = await supabase
			.from('question')
			.select('content')
			.eq('id', questionId)
			.single();

		if (questionError || !question) {
			return json(
				{ error: 'Question introuvable' },
				{ status: 404 }
			);
		}

		// Vérifier avec l'IA si la réponse correspond à la question
		const prompt = `Tu es un juge pour un jeu de bluff/quiz. Tu dois évaluer si une réponse donnée par un joueur peut correspondre à une question, avec une certaine tolérance pour les variations de formulation et les approximations.

Question : "${question.content}"
Réponse du joueur : "${answer.trim()}"

Évalue si la réponse du joueur peut être considérée comme correcte ou proche de la bonne réponse. Sois tolérant avec :
- Les variations de formulation (par exemple "La capitale de la France" vs "Paris")
- Les approximations et réponses partielles
- Les réponses qui montrent une compréhension même si elles ne sont pas parfaitement précises
- Les variations linguistiques et synonymes

Réponds UNIQUEMENT avec un JSON valide au format suivant :
{
  "isValid": true ou false,
  "confidence": un nombre entre 0 et 1 indiquant le niveau de confiance (1 = très sûr, 0.5 = douteux mais acceptable, 0 = incorrect),
  "reason": "Une brève explication de ta décision"
}

Réponds UNIQUEMENT avec le JSON, sans texte supplémentaire avant ou après.`;

		const aiResponse = await generateText(prompt);
		
		// Nettoyer la réponse pour extraire le JSON
		const jsonMatch = aiResponse.match(/\{[\s\S]*\}/);
		if (!jsonMatch) {
			throw new Error('Réponse de Gemini ne contient pas de JSON valide');
		}

		const verification = JSON.parse(jsonMatch[0]);
		
		if (typeof verification.isValid !== 'boolean') {
			throw new Error('Format de réponse invalide : propriété "isValid" manquante ou invalide');
		}

		// Seuil de tolérance : accepter si isValid est true OU si confidence >= 0.5
		const isAccepted = verification.isValid || (verification.confidence >= 0.5);

		return json({
			success: true,
			isValid: isAccepted,
			confidence: verification.confidence || (isAccepted ? 0.7 : 0.3),
			reason: verification.reason || 'Évaluation effectuée'
		});
	} catch (error) {
		console.error('Erreur lors de la vérification de la réponse:', error);
		return json(
			{
				error: error instanceof Error ? error.message : 'Erreur lors de la vérification de la réponse'
			},
			{ status: 500 }
		);
	}
};

import { json } from '@sveltejs/kit';
import { supabase } from '$lib/supabaseClient';
import { generateText } from '$lib/geminiClient';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ request }) => {
	try {
		const { playerId, questionId, content } = await request.json();

		if (!playerId || !questionId || !content) {
			return json({ error: 'Données manquantes (playerId, questionId, content)' }, { status: 400 });
		}

		// 1. Vérifier si l'utilisateur n'a pas déjà soumis une réponse pour cette question
		const { data: existing, error: checkError } = await supabase
			.from('responses')
			.select('id')
			.eq('question_id', questionId)
			.eq('player_id', playerId)
			.maybeSingle();

		if (existing) {
			return json({ error: 'Tu as déjà soumis une réponse pour cette question' }, { status: 400 });
		}

		// 2. Récupérer la question pour vérifier la réponse
		const { data: question, error: questionError } = await supabase
			.from('question')
			.select('content')
			.eq('id', questionId)
			.single();

		if (questionError || !question) {
			return json({ error: 'Question introuvable' }, { status: 404 });
		}

		// 3. Vérifier si une bonne réponse existe déjà pour cette question
		const { data: existingCorrectResponse } = await supabase
			.from('responses')
			.select('content')
			.eq('question_id', questionId)
			.eq('is_right', true)
			.maybeSingle();

		// 4. Vérifier avec l'IA si la réponse est correcte
		const prompt = `Tu es un juge pour un jeu de bluff/quiz. Tu dois évaluer si une réponse donnée par un joueur peut correspondre à une question, avec une certaine tolérance pour les variations de formulation et les approximations.

Question : "${question.content}"
Réponse du joueur : "${content.trim()}"

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
		const isCorrect = verification.isValid || (verification.confidence >= 0.5);

		if (isCorrect) {
			// La réponse est correcte !
			// Vérifier si une bonne réponse existe déjà
			if (!existingCorrectResponse) {
				// Créer la bonne réponse si elle n'existe pas encore
				const { data: correctResponse, error: insertCorrectError } = await supabase
					.from('responses')
					.insert([{
						question_id: questionId,
						content: content.trim(),
						player_id: null, // La bonne réponse n'a pas de joueur associé
						is_right: true
					}])
					.select()
					.single();

				if (insertCorrectError) {
					console.error('Erreur insertion bonne réponse:', insertCorrectError);
					return json({ error: 'Erreur lors de l\'enregistrement de la bonne réponse' }, { status: 500 });
				}

				return json({ 
					success: true, 
					type: 'CORRECT',
					message: 'Bonne réponse ! Vous pouvez maintenant créer une fausse réponse pour piéger les autres.',
					response: correctResponse
				});
			} else {
				// La bonne réponse existe déjà, le joueur a trouvé la bonne réponse
				return json({ 
					success: true, 
					type: 'CORRECT',
					message: 'Bonne réponse ! Vous pouvez maintenant créer une fausse réponse pour piéger les autres.'
				});
			}
		} else {
			// C'est un bluff, on l'ajoute à la table responses pour que les autres puissent voter dessus
			const { data: newResponse, error: insertError } = await supabase
				.from('responses')
				.insert([{
					question_id: questionId,
					content: content.trim(),
					player_id: playerId,
					is_right: false
				}])
				.select()
				.single();

			if (insertError) {
				console.error('Erreur insertion bluff:', insertError);
				return json({ error: 'Erreur lors de l\'enregistrement de ton bluff' }, { status: 500 });
			}

			return json({ 
				success: true, 
				type: 'BLUFF',
				message: 'Mauvaise réponse. Ton bluff a été enregistré pour la phase de vote.',
				response: newResponse
			});
		}

	} catch (err) {
		console.error('API Respond Error:', err);
		return json({ error: 'Erreur interne du serveur' }, { status: 500 });
	}
};

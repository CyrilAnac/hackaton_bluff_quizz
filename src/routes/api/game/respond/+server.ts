import { json } from '@sveltejs/kit';
import { supabase } from '$lib/supabaseClient';
import type { RequestHandler } from './$types';

/**
 * Compare la réponse du joueur avec la bonne réponse.
 * TODO: Intégrer une vraie IA (OpenAI, Mistral...) pour une comparaison sémantique.
 */
async function checkWithAI(userAnswer: string, correctAnswer: string): Promise<boolean> {
	if (!userAnswer || !correctAnswer) return false;
	
	const normalize = (s: string) => 
		s.toLowerCase()
		 .trim()
		 .normalize("NFD")
		 .replace(/[\u0300-\u036f]/g, "") // Enlever les accents
		 .replace(/[.,/#!$%^&*;:{}=\-_`~()]/g,""); // Enlever la ponctuation
		 
	return normalize(userAnswer) === normalize(correctAnswer);
}

export const POST: RequestHandler = async ({ request }) => {
	try {
		const { playerId, questionId, content } = await request.json();

		if (!playerId || !questionId || !content) {
			return json({ error: 'Données manquantes (playerId, questionId, content)' }, { status: 400 });
		}

		// 1. Récupérer la bonne réponse officielle pour cette question
		const { data: correctResponse, error: qError } = await supabase
			.from('responses')
			.select('content_id')
			.eq('question_id', questionId)
			.eq('is_right', true)
			.single();

		if (qError || !correctResponse) {
			console.error('Erreur recup bonne reponse:', qError);
			return json({ error: 'Impossible de trouver la réponse correcte pour cette question' }, { status: 404 });
		}

		// 2. Vérifier si l'utilisateur n'a pas déjà soumis une réponse pour cette question
		const { data: existing, error: checkError } = await supabase
			.from('responses')
			.select('id')
			.eq('question_id', questionId)
			.eq('player_id', playerId)
			.maybeSingle();

		if (existing) {
			return json({ error: 'Tu as déjà soumis une réponse pour cette question' }, { status: 400 });
		}

		// 3. Comparaison avec la "vérité" (IA Placeholder)
		const isRightMatch = await checkWithAI(content, correctResponse.content_id);

		if (isRightMatch) {
			// Le joueur a trouvé la vérité !
			// On ne crée pas de nouvelle ligne dans 'responses' car la vérité existe déjà.
			// On pourrait ici mettre à jour une table 'player_round_stats' ou similaire.
			return json({ 
				success: true, 
				type: 'CORRECT',
				message: 'Incroyable ! Tu as trouvé la vraie réponse du premier coup.'
			});
		} else {
			// C'est un bluff, on l'ajoute à la table responses pour que les autres puissent voter dessus
			const { data: newResponse, error: insertError } = await supabase
				.from('responses')
				.insert([{
					question_id: questionId,
					content_id: content,
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
				message: 'Ton bluff a été enregistré. Bonne chance pour tromper les autres !',
				response: newResponse
			});
		}

	} catch (err) {
		console.error('API Respond Error:', err);
		return json({ error: 'Erreur interne du serveur' }, { status: 500 });
	}
};

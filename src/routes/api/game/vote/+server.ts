import { json } from '@sveltejs/kit';
import { supabase } from '$lib/supabaseClient';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ request }) => {
	try {
		const { playerId, responseId } = await request.json();

		if (!playerId || !responseId) {
			return json({ error: 'Données manquantes (playerId, responseId)' }, { status: 400 });
		}

		// 1. Vérifier si la réponse existe et récupérer son auteur
		const { data: responseData, error: respError } = await supabase
			.from('responses')
			.select('player_id, question_id')
			.eq('id', responseId)
			.single();

		if (respError || !responseData) {
			return json({ error: 'Réponse introuvable' }, { status: 404 });
		}

		// 2. Empêcher de voter pour sa propre réponse (bluff)
		if (responseData.player_id === playerId) {
			return json({ error: 'Tu ne peux pas voter pour ton propre bluff !' }, { status: 400 });
		}

		// 2.5. Vérifier si le joueur a trouvé la bonne réponse (il ne peut pas voter)
		// Méthode 1 : Vérifier via la table correct_answer_finders
		try {
			const { data: finderData } = await supabase
				.from('correct_answer_finders')
				.select('player_id')
				.eq('question_id', responseData.question_id)
				.eq('player_id', playerId)
				.maybeSingle();
			
			if (finderData) {
				return json({ error: 'Tu as trouvé la bonne réponse, tu ne peux pas voter !' }, { status: 400 });
			}
		} catch (err) {
			// Si la table n'existe pas, utiliser la méthode alternative
			// Méthode 2 : Vérifier si le joueur a une réponse qui correspond à la bonne réponse
			const { data: correctResponse } = await supabase
				.from('responses')
				.select('content')
				.eq('question_id', responseData.question_id)
				.eq('is_right', true)
				.maybeSingle();
			
			if (correctResponse) {
				const { data: playerResponse } = await supabase
					.from('responses')
					.select('content')
					.eq('question_id', responseData.question_id)
					.eq('player_id', playerId)
					.maybeSingle();
				
				if (playerResponse && 
					playerResponse.content.toLowerCase().trim() === correctResponse.content.toLowerCase().trim()) {
					return json({ error: 'Tu as trouvé la bonne réponse, tu ne peux pas voter !' }, { status: 400 });
				}
			}
		}

		// 4. Vérifier si le joueur a déjà voté pour cette question
		// Récupérer tous les votes du joueur
		const { data: playerVotes, error: voteCheckError } = await supabase
			.from('votes')
			.select('response_id')
			.eq('player_id', playerId);

		if (voteCheckError) {
			console.error('Erreur vérification votes:', voteCheckError);
		}

		// Vérifier si un des votes du joueur est pour une réponse de la même question
		if (playerVotes && playerVotes.length > 0) {
			const responseIds = playerVotes.map((v: any) => v.response_id);
			const { data: responsesForVotes } = await supabase
				.from('responses')
				.select('question_id')
				.in('id', responseIds);

			if (responsesForVotes) {
				const hasVotedForThisQuestion = responsesForVotes.some(
					(r: any) => r.question_id === responseData.question_id
				);

				if (hasVotedForThisQuestion) {
					return json({ error: 'Tu as déjà voté pour cette question !' }, { status: 400 });
				}
			}
		}

		// 5. Insérer le vote
		const { data: newVote, error: insertError } = await supabase
			.from('votes')
			.insert([{
				player_id: playerId,
				response_id: responseId
			}])
			.select()
			.single();

		if (insertError) {
			console.error('Erreur insertion vote:', insertError);
			return json({ error: 'Erreur lors de l\'enregistrement du vote' }, { status: 500 });
		}

		return json({
			success: true,
			vote: newVote
		});

	} catch (err) {
		console.error('API Vote Error:', err);
		return json({ error: 'Erreur interne du serveur' }, { status: 500 });
	}
};

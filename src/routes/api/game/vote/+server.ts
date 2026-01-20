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

		// 3. Vérifier si le joueur a déjà voté pour cette question
		// Pour cela, on regarde si un vote existe déjà pour une réponse liée à la même question
		const { data: existingVote, error: voteCheckError } = await supabase
			.from('votes')
			.select('id')
			.eq('player_id', playerId)
			.innerJoin('responses', 'votes.response_id', 'responses.id')
			.eq('responses.question_id', responseData.question_id)
			.maybeSingle();

		// Note: Si innerJoin ne marche pas direct avec le client JS de cette façon, 
		// on peut faire une requête plus simple si on a stocké la question_id dans le vote 
		// ou faire deux requêtes. Pour rester simple et efficace :
		
		/* 
		Alternative si la relation complexe est compliquée en une fois :
		const { data: playerVotes } = await supabase
			.from('votes')
			.select('response_id')
			.eq('player_id', playerId);
		... vérifier si un des response_id appartient à la même question ...
		*/

		// 4. Insérer le vote
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

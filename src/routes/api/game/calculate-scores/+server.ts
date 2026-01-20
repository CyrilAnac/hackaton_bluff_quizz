import { json } from '@sveltejs/kit';
import { supabase } from '$lib/supabaseClient';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ request }) => {
	try {
		const { questionId, roomId } = await request.json();

		if (!questionId || !roomId) {
			return json({ error: 'Données manquantes (questionId, roomId)' }, { status: 400 });
		}

		// 1. Récupérer toutes les réponses pour cette question
		const { data: responses, error: responsesError } = await supabase
			.from('responses')
			.select('id, content, player_id, is_right, question_id')
			.eq('question_id', questionId);

		if (responsesError || !responses) {
			return json({ error: 'Erreur lors de la récupération des réponses' }, { status: 500 });
		}

		// 2. Trouver la bonne réponse
		const correctResponse = responses.find((r: any) => r.is_right === true);
		if (!correctResponse) {
			return json({ error: 'Aucune bonne réponse trouvée' }, { status: 404 });
		}

		// 3. Récupérer tous les votes pour cette question
		const responseIds = responses.map((r: any) => r.id);
		const { data: votes, error: votesError } = await supabase
			.from('votes')
			.select('player_id, response_id')
			.in('response_id', responseIds);

		if (votesError) {
			return json({ error: 'Erreur lors de la récupération des votes' }, { status: 500 });
		}

		// 4. Récupérer tous les joueurs de la room
		const { data: roomPlayers, error: playersError } = await supabase
			.from('player_room')
			.select('player_id')
			.eq('room_id', roomId);

		if (playersError || !roomPlayers) {
			return json({ error: 'Erreur lors de la récupération des joueurs' }, { status: 500 });
		}

		const playerIds = roomPlayers.map((pr: any) => pr.player_id);

		// 5. Récupérer qui a trouvé la bonne réponse
		// Essayer d'abord via la table correct_answer_finders si elle existe
		let correctAnswerFinders: string[] = [];
		try {
			const { data: findersData } = await supabase
				.from('correct_answer_finders')
				.select('player_id')
				.eq('question_id', questionId);
			
			if (findersData) {
				correctAnswerFinders = findersData.map((f: any) => f.player_id);
			}
		} catch (err) {
			// La table n'existe peut-être pas, on utilise la méthode alternative
			console.log('Table correct_answer_finders non disponible, utilisation de la méthode alternative');
			
			// Méthode alternative : vérifier si un joueur a une réponse qui correspond à la bonne réponse
			const correctAnswerNormalized = correctResponse.content.toLowerCase().trim();
			responses.forEach((response: any) => {
				if (response.player_id && response.content.toLowerCase().trim() === correctAnswerNormalized) {
					correctAnswerFinders.push(response.player_id);
				}
			});
		}
		
		// 6. Calculer les scores pour chaque joueur
		const scores: Record<string, number> = {};
		const scoreDetails: Record<string, { foundCorrect: boolean; votesReceived: number; votedCorrect: boolean }> = {};

		// Initialiser les scores à 0
		playerIds.forEach((pid: string) => {
			scores[pid] = 0;
			scoreDetails[pid] = {
				foundCorrect: false,
				votesReceived: 0,
				votedCorrect: false
			};
		});

		// Attribuer 2 points à ceux qui ont trouvé la bonne réponse
		correctAnswerFinders.forEach((playerId: string) => {
			if (scores[playerId] !== undefined) {
				scoreDetails[playerId].foundCorrect = true;
				scores[playerId] += 2;
			}
		});

		// Compter les votes reçus pour chaque réponse de joueur
		responses.forEach((response: any) => {
			if (response.player_id) {
				const votesForThisResponse = votes?.filter((v: any) => v.response_id === response.id) || [];
				scoreDetails[response.player_id].votesReceived = votesForThisResponse.length;
				if (votesForThisResponse.length > 0) {
					scores[response.player_id] += votesForThisResponse.length; // 1 point par vote
				}
			}
		});

		// Vérifier qui a voté pour la bonne réponse
		const votesForCorrectResponse = votes?.filter((v: any) => v.response_id === correctResponse.id) || [];
		votesForCorrectResponse.forEach((vote: any) => {
			scoreDetails[vote.player_id].votedCorrect = true;
			scores[vote.player_id] += 1;
		});

		return json({
			success: true,
			scores,
			scoreDetails,
			correctResponseId: correctResponse.id
		});

	} catch (err) {
		console.error('API Calculate Scores Error:', err);
		return json({ error: 'Erreur interne du serveur' }, { status: 500 });
	}
};

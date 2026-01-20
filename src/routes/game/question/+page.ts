import { error } from '@sveltejs/kit';
import type { PageLoad } from './$types';
import { supabase } from '$lib/supabaseClient';
import { getRoomByCode } from '$lib/roomService';

export const load: PageLoad = async ({ params, url }) => {
	// Le code peut venir des params (si route /game/question/[code]) ou de l'URL
	const roomCode = params.code || url.searchParams.get('code');
	const playerId = url.searchParams.get('playerId') || null;

	if (!roomCode) {
		throw error(400, 'Code de salle manquant');
	}

	try {
		// 1. Récupérer la room avec les joueurs
		const room = await getRoomByCode(roomCode);

		if (!room) {
			throw error(404, 'Salle introuvable');
		}

		// 2. Récupérer la question actuelle pour ce round (prendre la première si plusieurs existent)
		const { data: questions, error: questionError } = await supabase
			.from('question')
			.select('*')
			.eq('room_id', room.id)
			.eq('round_number', room.current_round)
			.limit(1);

		if (questionError || !questions || questions.length === 0) {
			throw error(404, 'Question introuvable pour ce round');
		}

		const question = questions[0];

		// 3. Récupérer la bonne réponse pour cette question
		const { data: correctResponse, error: correctError } = await supabase
			.from('responses')
			.select('content')
			.eq('question_id', question.id)
			.eq('is_right', true)
			.single();

		// 4. Récupérer toutes les réponses pour cette question (pour la phase de vote)
		const { data: allResponses, error: responsesError } = await supabase
			.from('responses')
			.select('id, content, player_id, is_right, question_id')
			.eq('question_id', question.id);

		// Enrichir les réponses avec les infos des joueurs
		let enrichedResponses = [];
		if (allResponses && room.players) {
			enrichedResponses = allResponses.map((r: any) => {
				const player = room.players?.find((p: any) => p.id === r.player_id);
				return {
					...r,
					player: player || null
				};
			});
		}

		// 5. Récupérer les votes pour cette question
		let votes = [];
		if (allResponses && allResponses.length > 0) {
			const responseIds = allResponses.map((r: any) => r.id);
			const { data: votesData, error: votesError } = await supabase
				.from('votes')
				.select('id, player_id, response_id')
				.in('response_id', responseIds);

			if (votesData && room.players) {
				votes = votesData.map((v: any) => {
					const player = room.players?.find((p: any) => p.id === v.player_id);
					return {
						...v,
						player: player || null
					};
				});
			}
		}

		// 6. Identifier le joueur actuel si playerId est fourni
		let currentPlayer = null;
		if (playerId) {
			currentPlayer = room.players?.find((p: any) => p.id === playerId);
		}

		// 7. Vérifier si le joueur actuel a déjà répondu
		let playerResponse = null;
		if (playerId) {
			playerResponse = allResponses?.find((r: any) => r.player_id === playerId);
		}

		// 8. Vérifier si le joueur actuel a déjà voté
		let playerVote = null;
		if (playerId) {
			playerVote = votes?.find((v: any) => v.player_id === playerId);
		}

		return {
			room,
			question,
			correctResponse: correctResponse || null,
			allResponses: enrichedResponses || [],
			votes: votes || [],
			currentPlayer,
			playerResponse,
			playerVote
		};
	} catch (e: any) {
		console.error('Erreur lors du chargement de la page question:', e);
		if (e.status) {
			throw e;
		}
		throw error(500, 'Erreur lors du chargement de la page');
	}
};

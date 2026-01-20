import { json } from '@sveltejs/kit';
import { supabase } from '$lib/supabaseClient';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ request }) => {
	try {
		const { roomId, rounds } = await request.json();

		if (!roomId || !rounds) {
			return json({ error: 'Données manquantes (roomId, rounds)' }, { status: 400 });
		}

		// Préparation des questions pour chaque round
		// Note: Dans un vrai jeu, on piocherait des questions aléatoires d'une banque de questions ici.
		const questionsToInsert = [];
		for (let i = 1; i <= rounds; i++) {
			questionsToInsert.push({
				room_id: roomId,
				round_number: i,
				content: `Question pour le round ${i}` // Placeholder à remplacer par la vraie logique de quiz
			});
		}

		const { data, error } = await supabase
			.from('question')
			.insert(questionsToInsert)
			.select();

		if (error) {
			console.error('Erreur insertion questions:', error);
			return json({ error: 'Erreur lors de la création des questions' }, { status: 500 });
		}

		return json({
			success: true,
			questions: data
		});
	} catch (err) {
		console.error('API Question Create Error:', err);
		return json({ error: 'Erreur interne du serveur' }, { status: 500 });
	}
};

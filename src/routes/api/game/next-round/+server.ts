import { json } from '@sveltejs/kit';
import { supabase } from '$lib/supabaseClient';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ request }) => {
	try {
		const { roomCode, adminId } = await request.json();

		if (!roomCode || !adminId) {
			return json({ error: 'Données manquantes (roomCode, adminId)' }, { status: 400 });
		}

		// 1. Récupérer la salle et vérifier l'admin
		const { data: room, error: roomError } = await supabase
			.from('room')
			.select('id, admin_id, current_round, rounds')
			.eq('code', roomCode.toUpperCase())
			.single();

		if (roomError || !room) {
			return json({ error: 'Salle introuvable' }, { status: 404 });
		}

		if (room.admin_id !== adminId) {
			return json({ error: 'Action réservée à l\'administrateur' }, { status: 403 });
		}

		// 2. Vérifier s'il reste des rounds
		if (room.current_round >= room.rounds) {
			return json({ 
				success: true, 
				message: 'Partie terminée !', 
				finished: true 
			});
		}

		// 3. Passer au round suivant
		const { data: updatedRoom, error: updateError } = await supabase
			.from('room')
			.update({ 
				current_round: room.current_round + 1,
				status: 'PLAYING' // On repasse en mode jeu
			})
			.eq('id', room.id)
			.select()
			.single();

		if (updateError) {
			console.error('Erreur next round:', updateError);
			return json({ error: 'Erreur lors du passage au round suivant' }, { status: 500 });
		}

		return json({
			success: true,
			room: updatedRoom,
			finished: false
		});

	} catch (err) {
		console.error('API NextRound Error:', err);
		return json({ error: 'Erreur interne du serveur' }, { status: 500 });
	}
};

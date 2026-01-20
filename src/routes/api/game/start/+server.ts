import { json } from '@sveltejs/kit';
import { supabase } from '$lib/supabaseClient';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ request }) => {
	try {
		const { roomCode, adminId } = await request.json();

		if (!roomCode || !adminId) {
			return json({ error: 'Données manquantes (roomCode, adminId)' }, { status: 400 });
		}

		// 1. Vérifier que la salle existe et que l'utilisateur est bien l'admin
		const { data: room, error: roomError } = await supabase
			.from('room')
			.select('id, admin_id, status')
			.eq('code', roomCode.toUpperCase())
			.single();

		if (roomError || !room) {
			return json({ error: 'Salle introuvable' }, { status: 404 });
		}

		if (room.admin_id !== adminId) {
			return json({ error: 'Seul l\'administrateur peut lancer la partie' }, { status: 403 });
		}

		if (room.status !== 'LOBBY') {
			return json({ error: 'La partie est déjà lancée' }, { status: 400 });
		}

		// 2. Mettre à jour le statut de la salle
		// On pourrait aussi ici pré-charger les questions pour la partie
		const { data: updatedRoom, error: updateError } = await supabase
			.from('room')
			.update({ status: 'PLAYING' })
			.eq('id', room.id)
			.select()
			.single();

		if (updateError) {
			console.error('Erreur update room status:', updateError);
			return json({ error: 'Erreur lors du lancement de la partie' }, { status: 500 });
		}

		return json({
			success: true,
			room: updatedRoom
		});

	} catch (err) {
		console.error('API Start Error:', err);
		return json({ error: 'Erreur interne du serveur' }, { status: 500 });
	}
};

import { json } from '@sveltejs/kit';
import { supabase } from '$lib/supabaseClient';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ request }) => {
	try {
		const { roomCode, playerName, iconId } = await request.json();

		if (!roomCode || !playerName) {
			return json({ error: 'Le code de salle et le nom du joueur sont requis' }, { status: 400 });
		}

		// 1. Vérifier si la salle existe
		const { data: room, error: roomError } = await supabase
			.from('room')
			.select('id, status')
			.eq('code', roomCode.toUpperCase())
			.single();

		if (roomError || !room) {
			return json({ error: 'Salle introuvable' }, { status: 404 });
		}

		if (room.status !== 'LOBBY') {
			return json({ error: 'La partie a déjà commencé' }, { status: 400 });
		}

		// 2. Créer le joueur dans la table players
		const { data: player, error: playerError } = await supabase
			.from('players')
			.insert([{ name: playerName, icon_id: iconId?.toString() || '1' }])
			.select()
			.single();

		if (playerError) {
			console.error('Erreur creation player:', playerError);
			return json({ error: 'Erreur lors de la création du joueur' }, { status: 500 });
		}

		// 3. Lier le joueur à la salle dans player_room
		const { error: linkError } = await supabase
			.from('player_room')
			.insert([{ room_id: room.id, player_id: player.id }]);

		if (linkError) {
			console.error('Erreur link player_room:', linkError);
			return json({ error: 'Erreur lors de la liaison joueur-salle' }, { status: 500 });
		}

		return json({
			success: true,
			room,
			player
		});
	} catch (err) {
		console.error('API Error:', err);
		return json({ error: 'Erreur interne du serveur' }, { status: 500 });
	}
};

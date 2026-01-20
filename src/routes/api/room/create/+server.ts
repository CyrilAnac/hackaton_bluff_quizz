import { json } from '@sveltejs/kit';
import { supabase } from '$lib/supabaseClient';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ request }) => {
	try {
		const { playerName, iconId } = await request.json();

		if (!playerName) {
			return json({ error: 'Le nom du joueur est requis' }, { status: 400 });
		}

		// 1. Créer le joueur (Admin) dans la table players
		// Note: id est généré par défaut (uuid)
		const { data: player, error: playerError } = await supabase
			.from('players')
			.insert([{ name: playerName, icon_id: iconId?.toString() || '1' }])
			.select()
			.single();

		if (playerError) {
			console.error('Erreur creation player:', playerError);
			return json({ error: 'Erreur lors de la création du joueur' }, { status: 500 });
		}

		// 2. Générer un code de salle unique (5 caractères majuscules)
		const roomCode = Math.random().toString(36).substring(2, 7).toUpperCase();

		// 3. Créer la salle (room)
		const { data: room, error: roomError } = await supabase
			.from('room')
			.insert([
				{
					code: roomCode,
					admin_id: player.id,
					status: 'LOBBY',
					rounds: 5,
					current_round: 1
				}
			])
			.select()
			.single();

		if (roomError) {
			console.error('Erreur creation room:', roomError);
			return json({ error: 'Erreur lors de la création de la salle' }, { status: 500 });
		}

		// 4. Lier l'admin à la salle dans player_room
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

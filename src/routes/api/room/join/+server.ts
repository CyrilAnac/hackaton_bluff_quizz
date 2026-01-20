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

		// 2. Insérer directement dans la table player_room
		const { data: player, error: playerError } = await supabase
			.from('player_room')
			.insert([
				{
					room_id: room.id,
					name: playerName,
					icon_id: iconId?.toString() || '1'
				}
			])
			.select()
			.single();

		if (playerError) {
			console.error('Erreur join player_room:', playerError);
			return json({ error: 'Erreur lors de la connexion à la salle' }, { status: 500 });
		}

		return json({
			success: true,
			room,
			player
		});
	} catch (err) {
		console.error('API Room Join Error:', err);
		return json({ error: 'Erreur interne du serveur' }, { status: 500 });
	}
};

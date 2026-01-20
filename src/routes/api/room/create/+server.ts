import { json } from '@sveltejs/kit';
import { supabase } from '$lib/supabaseClient';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ request }) => {
	try {
		const { playerName, iconId, rounds } = await request.json();

		if (!playerName) {
			return json({ error: 'Le nom du joueur est requis' }, { status: 400 });
		}

		// 1. Créer la salle d'abord
		const roomCode = Math.random().toString(36).substring(2, 7).toUpperCase();
		const { data: room, error: roomError } = await supabase
			.from('room')
			.insert([
				{
					code: roomCode,
					status: 'LOBBY',
					rounds: rounds || 5,
					current_round: 1
				}
			])
			.select()
			.single();

		if (roomError) {
			console.error('Erreur creation room:', roomError);
			return json({ error: 'Erreur lors de la création de la salle' }, { status: 500 });
		}

		// 2. Créer l'admin dans player_room (lié à la room_id)
		const { data: admin, error: adminError } = await supabase
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

		if (adminError) {
			console.error('Erreur creation admin in player_room:', adminError);
			return json({ error: 'Erreur lors de la création du joueur' }, { status: 500 });
		}

		// 3. Mettre à jour la salle avec l'ID de l'admin (id de player_room)
		const { error: updateError } = await supabase
			.from('room')
			.update({ admin_id: admin.id.toString() }) // admin_id est varchar dans le schéma
			.eq('id', room.id);

		if (updateError) {
			console.error('Erreur update admin_id in room:', updateError);
			// On ne bloque pas tout car le joueur est créé, mais c'est mieux si ça marche
		}

		return json({
			success: true,
			room: { ...room, admin_id: admin.id },
			player: admin
		});
	} catch (err) {
		console.error('API Room Create Error:', err);
		return json({ error: 'Erreur interne du serveur' }, { status: 500 });
	}
};

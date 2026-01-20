import { json } from '@sveltejs/kit';
import { supabase } from '$lib/supabaseClient';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ request, getClientAddress }) => {
	try {
		const { playerName, iconId } = await request.json();
		const ip = getClientAddress();

		if (!playerName) {
			return json({ error: 'Le nom du joueur est requis' }, { status: 400 });
		}

		// Création du joueur dans player_room sans room_id pour l'instant
		const { data: player, error: playerError } = await supabase
			.from('player_room')
			.insert([{ 
				name: playerName, 
				icon_id: iconId?.toString() || '1'
			}])
			.select()
			.single();

		if (playerError) {
			console.error('Erreur creation player_room:', playerError);
			return json({ error: playerError.message }, { status: 500 });
		}

		return json({
			success: true,
			player
		});
	} catch (err) {
		console.error('API Player Create Error:', err);
		return json({ error: 'Erreur interne du serveur' }, { status: 500 });
	}
};

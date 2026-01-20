import { json } from '@sveltejs/kit';
import { supabase } from '$lib/supabaseClient';
import { generateAndInsertQuestions } from '$lib/questionGenerator';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ request }) => {
	try {
		const { playerName, iconId, rounds } = await request.json();

		if (!playerName) {
			return json({ error: 'Le nom du joueur est requis' }, { status: 400 });
		}

		// --- TRANSACTION SERVEUR ---
		
		// 1. Créer la salle (Room)
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
			throw new Error('Impossible de créer la salle : ' + roomError.message);
		}

		// 2. Créer l'admin dans player_room avec le room_id valide
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
			console.error('Erreur creation admin:', adminError);
			// Rollback manuel de la room
			await supabase.from('room').delete().eq('id', room.id);
			throw new Error('Impossible de créer le joueur admin : ' + adminError.message);
		}

		// 3. Mettre à jour la salle avec l'ID de l'admin
		const { error: updateError } = await supabase
			.from('room')
			.update({ admin_id: admin.id.toString() })
			.eq('id', room.id);

		if (updateError) {
			console.error('Erreur liaison admin_id:', updateError);
		}

		// 4. Générer les questions (Utilisation de la vraie logique avec Gemini)
		try {
			// On génère une question par round
			// Note : generateAndInsertQuestions peut échouer si Gemini ne répond pas un JSON valide ou timeout
			for (let i = 1; i <= (rounds || 5); i++) {
				await generateAndInsertQuestions(1, room.id, i);
			}
		} catch (qError: any) {
			console.error("Erreur génération questions Gemini (non bloquant):", qError.message);
			// Fallback sur des questions simples si Gemini échoue pour ne pas bloquer la création
			const questionsToInsert = Array.from({ length: rounds || 5 }, (_, i) => ({
				room_id: room.id,
				round_number: i + 1,
				content: `Question de secours pour le round ${i + 1}`,
				accepted_answers: ['Réponse de secours']
			}));
			await supabase.from('question').insert(questionsToInsert);
		}

		return json({
			success: true,
			room: { ...room, admin_id: admin.id },
			player: admin
		});

	} catch (err: any) {
		console.error('API Room Transaction Error:', err);
		return json({ error: err.message || 'Erreur interne du serveur' }, { status: 500 });
	}
};

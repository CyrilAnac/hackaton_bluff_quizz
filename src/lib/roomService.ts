import { supabase } from './supabaseClient';

/**
 * Génère un code de room unique (6 caractères alphanumériques)
 */
function generateRoomCode(): string {
	const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
	let code = '';
	for (let i = 0; i < 6; i++) {
		code += chars.charAt(Math.floor(Math.random() * chars.length));
	}
	return code;
}

/**
 * Crée un joueur dans la base de données
 * @param name Le nom du joueur
 * @param iconId L'ID de l'icône/avatar
 * @returns L'ID du joueur créé
 */
export async function createPlayer(name: string, iconId: string): Promise<string> {
	// Récupérer l'IP du client (approximation)
	const ip = typeof window !== 'undefined' ? 'client' : 'server';

	const { data, error } = await supabase
		.from('players')
		.insert({
			name,
			icon_id: iconId,
			ip
		})
		.select('id')
		.single();

	if (error) {
		throw new Error(`Erreur lors de la création du joueur: ${error.message}`);
	}

	return data.id;
}

/**
 * Crée une room dans la base de données
 * @param adminId L'ID du joueur administrateur
 * @param rounds Le nombre de rounds
 * @returns La room créée avec son code
 */
export async function createRoom(adminId: string, rounds: number): Promise<{ id: string; code: string }> {
	let code = generateRoomCode();
	let attempts = 0;
	const maxAttempts = 10;

	// Vérifier l'unicité du code
	while (attempts < maxAttempts) {
		const { data: existingRoom } = await supabase
			.from('room')
			.select('id')
			.eq('code', code)
			.maybeSingle();

		// Si aucune room n'existe avec ce code, on peut l'utiliser
		if (!existingRoom) {
			// Le code est unique, on peut créer la room
			break;
		}

		code = generateRoomCode();
		attempts++;
	}

	if (attempts >= maxAttempts) {
		throw new Error('Impossible de générer un code de room unique');
	}

	const { data, error } = await supabase
		.from('room')
		.insert({
			code,
			admin_id: adminId,
			status: 'waiting',
			rounds,
			current_round: 1
		})
		.select('id, code')
		.single();

	if (error) {
		throw new Error(`Erreur lors de la création de la room: ${error.message}`);
	}

	return { id: data.id, code: data.code };
}

/**
 * Ajoute un joueur à une room
 * @param roomId L'ID de la room
 * @param playerId L'ID du joueur
 */
export async function addPlayerToRoom(roomId: string, playerId: string): Promise<void> {
	const { error } = await supabase.from('player_room').insert({
		room_id: roomId,
		player_id: playerId
	});

	if (error) {
		throw new Error(`Erreur lors de l'ajout du joueur à la room: ${error.message}`);
	}
}

/**
 * Récupère les informations d'une room par son code
 * @param code Le code de la room
 */
export async function getRoomByCode(code: string) {
	// 1. Récupérer la room
	const { data: room, error: roomError } = await supabase
		.from('room')
		.select('*')
		.eq('code', code)
		.single();

	if (roomError) {
		throw new Error(`Erreur lors de la récupération de la room: ${roomError.message}`);
	}

	// 2. Récupérer les joueurs de la room directement depuis player_room
	const { data: players, error: playersError } = await supabase
		.from('player_room')
		.select('*')
		.eq('room_id', room.id);

	if (playersError) {
		console.error("Erreur lors de la récupération des joueurs:", playersError);
		return { ...room, players: [] };
	}

	// 3. Formater les joueurs
	const formattedPlayers = players.map((p: any) => ({
		id: p.id,
		name: p.name,
		icon_id: p.icon_id,
		// L'admin_id dans room correspond à un ID dans player_room
		isHost: p.id === room.admin_id
	}));

	return {
		...room,
		players: formattedPlayers
	};
}

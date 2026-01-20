<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import { goto, invalidateAll } from '$app/navigation';
	import { supabase } from '$lib/supabaseClient';
	import { getRoomByCode } from '$lib/roomService';
	import Button from '../../../components/Button.svelte';
	import Card from '../../../components/Card.svelte';
	import QRCode from '../../../components/QRCode.svelte';
	import PlayerList from '../../../components/PlayerList.svelte';
	import Question from '../../../components/Question.svelte';
	import type { PageData } from './$types';

	let { data } = $props<{ data: PageData }>();

	// État réactif des joueurs et du statut
	let players = $state(data.room.players || []);
	let roomStatus = $state(data.room.status);
	let isLoadingGame = $state(false);
	let gameError = $state<string | null>(null);

	// Synchroniser l'état local avec les données serveur si elles changent (ex: via invalidateAll)
	$effect(() => {
		if (data.room) {
			players = data.room.players || [];
			roomStatus = data.room.status;
		}
	});

	// On crée un objet room réactif qui combine les données initiales et les états mis à jour
	const room = $derived({
		...data.room,
		players,
		status: roomStatus
	});

	const roomCode = data.room.code;
	const joinUrl = `${typeof window !== 'undefined' ? window.location.origin : ''}/join?code=${roomCode}`;

	// Récupérer le playerId du joueur actuel
	const playerId = $derived.by(() => {
		if (typeof window !== 'undefined') {
			return localStorage.getItem(`playerId_${roomCode}`);
		}
		return null;
	});

	// Vérifier si le joueur actuel est l'admin
	const isAdmin = $derived.by(() => {
		if (!playerId || !data.room.admin_id) return false;
		// Comparaison robuste en convertissant les deux en string
		return String(playerId) === String(data.room.admin_id);
	});

	let playerChannel: any;
	let roomChannel: any;

	async function refreshPlayers() {
		try {
			const updatedRoom = await getRoomByCode(roomCode);
			players = updatedRoom.players || [];
			roomStatus = updatedRoom.status;
		} catch (err) {
			console.error('Erreur refresh players:', err);
		}
	}

	onMount(() => {
		// 1. S'abonner aux changements des joueurs (ajouts/suppressions)
		playerChannel = supabase
			.channel(`lobby-players-${data.room.id}`)
			.on(
				'postgres_changes',
				{
					event: '*', // Écoute INSERT et DELETE
					schema: 'public',
					table: 'player_room',
					filter: `room_id=eq.${data.room.id}`
				},
				() => {
					refreshPlayers();
				}
			)
			.subscribe();

		// 2. S'abonner aux changements de la room (ex: statut pour lancer le jeu)
		roomChannel = supabase
			.channel(`lobby-room-${data.room.id}`)
			.on(
				'postgres_changes',
				{
					event: 'UPDATE',
					schema: 'public',
					table: 'room',
					filter: `id=eq.${data.room.id}`
				},
				(payload) => {
					console.log('Room update received:', payload);
					// Mettre à jour l'état local immédiatement
					roomStatus = payload.new.status;
					// Et rafraîchir les données globales pour la cohérence
					invalidateAll();
				}
			)
			.subscribe((status) => {
				console.log('Subscription status:', status);
			});
	});

	onDestroy(() => {
		if (playerChannel) supabase.removeChannel(playerChannel);
		if (roomChannel) supabase.removeChannel(roomChannel);
	});

	function copyCode() {
		if (typeof navigator !== 'undefined') {
			navigator.clipboard.writeText(roomCode);
			alert("Code copié !");
		}
	}

	async function startGame() {
		if (!data.room.admin_id) {
			gameError = 'Erreur: administrateur introuvable';
			return;
		}

		if (isLoadingGame) return;

		isLoadingGame = true;
		gameError = null;

		try {
			const res = await fetch('/api/game/start', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ 
					roomCode, 
					adminId: data.room.admin_id 
				})
			});
			const result = await res.json();
			if (!result.success) {
				gameError = result.error || "Erreur lors du lancement de la partie";
			} else {
				// Mettre à jour immédiatement pour l'administrateur sans attendre le retour realtime
				roomStatus = 'PLAYING';
				invalidateAll();
			}
		} catch (err) {
			console.error(err);
			gameError = "Erreur lors du lancement de la partie";
		} finally {
			isLoadingGame = false;
		}
	}
</script>

<svelte:head>
	<title>Salon - Bluff Quiz</title>
</svelte:head>

<div class="flex min-h-screen flex-col items-center justify-center p-4">
	{#if roomStatus === 'PLAYING'}
		<!-- Afficher le composant Question quand la partie est en cours -->
		<Question {room} {playerId} />
	{:else}
		<!-- Afficher le lobby quand la partie n'a pas encore commencé -->
		<Card>
			<div class="flex flex-col gap-6 px-4 py-6 sm:px-8 sm:py-8">
				<h1 class="text-2xl font-bold text-white sm:text-3xl text-center">
					Lobby : {roomCode}
				</h1>

				<div class="flex flex-col gap-6 sm:flex-row sm:items-start sm:gap-8">
					<div class="flex-1 min-w-[200px]">
						<p class="text-white/70 mb-4 font-semibold">Joueurs ({players.length}) :</p>
						<PlayerList players={players.map((p: any) => ({
							name: p.name,
							avatar: p.icon_id,
							isHost: p.isHost
						}))} />
					</div>

					<div class="flex flex-col items-center justify-center gap-4 border-l border-white/10 pl-8">
						<div class="flex items-center gap-2">
							<span class="text-white/70 text-sm">Code :</span>
							<button
								onclick={copyCode}
								class="cursor-pointer rounded-lg bg-white/20 px-3 py-1 font-mono text-xl font-bold text-white transition-all hover:bg-white/30"
								title="Cliquer pour copier"
							>
								{roomCode}
							</button>
						</div>
						<QRCode value={joinUrl} size={150} />
						<p class="text-center text-[10px] text-white/50 max-w-[150px]">
							Partagez ce code ou scannez pour rejoindre
						</p>
					</div>
				</div>

				{#if gameError}
					<div class="mt-4 w-full rounded-lg bg-red-500/20 p-3 text-center text-sm text-red-300">
						{gameError}
					</div>
				{/if}

				<div class="mt-4 flex justify-center border-t border-white/10 pt-6">
					{#if isAdmin}
						<Button 
							variant="primary" 
							size="lg" 
							onclick={startGame}
							disabled={isLoadingGame || roomStatus === 'PLAYING'}
						>
							{isLoadingGame ? 'Lancement...' : 'Lancer la Partie'}
						</Button>
					{:else}
						<div class="text-center">
							<p class="text-white/70 italic">
								En attente que l'administrateur lance la partie...
							</p>
							{#if roomStatus !== 'LOBBY'}
								<p class="text-indigo-300 font-bold animate-pulse mt-2">La partie va commencer...</p>
							{/if}
						</div>
					{/if}
				</div>
			</div>
		</Card>
	{/if}
</div>

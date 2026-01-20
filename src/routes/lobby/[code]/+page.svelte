<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import { goto } from '$app/navigation';
	import { supabase } from '$lib/supabaseClient';
	import { getRoomByCode } from '$lib/roomService';
	import Button from '../../../components/Button.svelte';
	import Card from '../../../components/Card.svelte';
	import QRCode from '../../../components/QRCode.svelte';
	import PlayerList from '../../../components/PlayerList.svelte';
	import type { PageData } from './$types';

	let { data } = $props<{ data: PageData }>();

	// État réactif des joueurs
	let players = $state(data.room.players || []);
	let roomStatus = $state(data.room.status);

	const roomCode = data.room.code;
	const joinUrl = `${typeof window !== 'undefined' ? window.location.origin : ''}/join?code=${roomCode}`;

	let playerChannel: any;
	let roomChannel: any;

	async function refreshPlayers() {
		try {
			const updatedRoom = await getRoomByCode(roomCode);
			players = updatedRoom.players || [];
			roomStatus = updatedRoom.status;
		} catch (err) {
			// Erreur silencieuse en production
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
					roomStatus = payload.new.status;
					
					// Si le statut passe à 'PLAYING', on redirige vers le jeu
					if (payload.new.status === 'PLAYING') {
						goto(`/game/${roomCode}`);
					}
				}
			)
			.subscribe();
	});

	onDestroy(() => {
		if (playerChannel) supabase.removeChannel(playerChannel);
		if (roomChannel) supabase.removeChannel(roomChannel);
	});

	function copyCode() {
		navigator.clipboard.writeText(roomCode);
		alert("Code copié !");
	}

	async function startGame() {
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
			if (!result.success) alert(result.error);
		} catch (err) {
			console.error(err);
			alert("Erreur lors du lancement de la partie");
		}
	}
</script>

<svelte:head>
	<title>Salon - Bluff Quiz</title>
</svelte:head>

<div class="flex min-h-screen flex-col items-center justify-center p-4">
	<Card>
		<div class="flex flex-col gap-6 px-4 py-6 sm:px-8 sm:py-8">
			<h1 class="text-2xl font-bold text-white sm:text-3xl text-center">
				Lobby : {roomCode}
			</h1>

			<div class="flex flex-col gap-6 sm:flex-row sm:items-start sm:gap-8">
				<div class="flex-1 min-w-[200px]">
					<p class="text-white/70 mb-4 font-semibold">Joueurs ({players.length}) :</p>
					<PlayerList players={players.map(p => ({
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

			<div class="mt-4 flex justify-center border-t border-white/10 pt-6">
				{#if roomStatus === 'LOBBY'}
					<Button variant="primary" size="lg" onclick={startGame}>
						Lancer la Partie
					</Button>
				{:else}
					<p class="text-indigo-300 font-bold animate-pulse">La partie va commencer...</p>
				{/if}
			</div>
		</div>
	</Card>
</div>

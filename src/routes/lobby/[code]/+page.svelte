<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import { invalidateAll } from '$app/navigation';
	import { supabase } from '$lib/supabaseClient';
	import Button from '../../../components/Button.svelte';
	import Card from '../../../components/Card.svelte';
	import QRCode from '../../../components/QRCode.svelte';
	import PlayerList from '../../../components/PlayerList.svelte';
	import Question from '../../../components/Question.svelte';
	import type { PageData } from './$types';

	interface Props {
		data: PageData;
	}

	let { data }: Props = $props();

	// Réactivité locale
	let room = $derived(data.room);
	let players = $derived(room.players ? room.players.map((p: any) => ({
		name: p.name,
		avatar: p.icon_id,
		isHost: p.isHost
	})) : []);
	
	const roomCode = $derived(room.code);
	const joinUrl = $derived(`${typeof window !== 'undefined' ? window.location.origin : ''}/join?code=${roomCode}`);

	// Récupérer le playerId du joueur actuel
	const playerId = $derived.by(() => {
		if (typeof window !== 'undefined') {
			return localStorage.getItem(`playerId_${room.code}`);
		}
		return null;
	});

	// Vérifier si le joueur actuel est l'admin
	// Comparaison robuste en convertissant les deux en string pour éviter les problèmes de type
	const isAdmin = $derived.by(() => {
		if (!playerId || !room.admin_id) {
			console.log('Admin check failed:', { playerId, admin_id: room.admin_id });
			return false;
		}
		// Convertir les deux en string pour la comparaison
		const result = String(playerId) === String(room.admin_id);
		console.log('Admin check:', { playerId, admin_id: room.admin_id, result });
		return result;
	});

	let channel: any;

	onMount(() => {
		channel = supabase
			.channel(`room:${room.id}`)
			.on(
				'postgres_changes',
				{
					event: '*',
					schema: 'public',
					table: 'player_room',
					filter: `room_id=eq.${room.id}`
				},
				() => {
					invalidateAll();
				}
			)
			.on(
				'postgres_changes',
				{
					event: 'UPDATE',
					schema: 'public',
					table: 'room',
					filter: `id=eq.${room.id}`
				},
				(payload) => {
					console.log('Room update received:', payload);
					invalidateAll();
				}
			)
			.subscribe((status) => {
				console.log('Subscription status:', status);
			});
	});

	onDestroy(() => {
		if (channel) {
			supabase.removeChannel(channel);
		}
	});

	let isLoadingGame = $state(false);
	let gameError = $state<string | null>(null);

	function copyCode() {
		navigator.clipboard.writeText(roomCode);
	}

	async function startGame() {
		if (!room.admin_id) {
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
					roomCode: room.code,
					adminId: room.admin_id
				})
			});

			const data = await res.json();

			if (!data.success) {
				gameError = data.error || 'Erreur lors du lancement de la partie';
			} else {
				// Mettre à jour immédiatement pour l'administrateur sans attendre le retour realtime
				invalidateAll();
			}
			// Pas besoin de redirection, le composant Question s'affichera automatiquement
			// grâce à la réactivité de Supabase qui mettra à jour room.status (pour les autres joueurs)
		} catch (err) {
			console.error('Erreur lors du lancement:', err);
			gameError = 'Erreur réseau lors du lancement de la partie';
		} finally {
			isLoadingGame = false;
		}
	}
</script>

<svelte:head>
	<title>Salon - Bluff Quiz</title>
</svelte:head>

<div class="flex min-h-screen flex-col items-center justify-center p-4">
	{#if room.status === 'PLAYING'}
		<!-- Afficher le composant Question quand la partie est en cours -->
		<Question {room} {playerId} />
	{:else}
		<!-- Afficher le lobby quand la partie n'a pas encore commencé -->
		<Card>
			<div class="flex flex-col gap-6 px-4 py-6 sm:px-8 sm:py-8">
				<h1 class="text-2xl font-bold text-white sm:text-3xl">
					Votre Salle
				</h1>

				<div class="flex flex-col gap-6 sm:flex-row sm:items-center sm:gap-8">
					<div class="flex-1">
						<PlayerList {players} />
					</div>

					<div class="flex flex-col items-center justify-center gap-4">
						<div class="flex items-center gap-2">
							<span class="text-white/70">Code :</span>
							<button
								onclick={copyCode}
								class="cursor-pointer rounded-lg bg-white/20 px-3 py-1 font-mono text-xl font-bold text-white transition-all hover:bg-white/30"
								title="Cliquer pour copier"
							>
								{roomCode}
							</button>
						</div>
						<QRCode value={joinUrl} size={180} />
						<p class="text-center text-sm text-white/70">
							Scanner pour rejoindre
						</p>
					</div>
				</div>

				{#if gameError}
					<div class="mt-4 w-full rounded-lg bg-red-500/20 p-3 text-center text-sm text-red-300">
						{gameError}
					</div>
				{/if}

				{#if isAdmin}
					<div class="mt-4 flex justify-center">
						<Button 
							variant="primary" 
							size="lg" 
							onclick={startGame}
							disabled={isLoadingGame || room.status === 'PLAYING'}
						>
							{isLoadingGame ? 'Lancement en cours...' : 'Lancer la Partie'}
						</Button>
					</div>
				{:else}
					<div class="mt-4 flex justify-center">
						<p class="text-white/70 text-center">
							En attente que l'administrateur lance la partie...
						</p>
					</div>
				{/if}
			</div>
		</Card>
	{/if}
</div>

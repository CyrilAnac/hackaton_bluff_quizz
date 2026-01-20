<script lang="ts">
	import { goto } from '$app/navigation';
	import { gameSettings } from '$lib/gameSettings.svelte';
	import Button from '../../../components/Button.svelte';
	import Card from '../../../components/Card.svelte';
	import Input from '../../../components/Input.svelte';
	import AvatarSelector from '../../../components/AvatarSelector.svelte';
	import { createPlayer, createRoom, addPlayerToRoom } from '$lib/roomService';

	let playerName = $state('');
	let selectedAvatar = $state(0);
	let isLoading = $state(false);
	let error = $state<string | null>(null);

	const avatars = ['😀', '😎', '🤠', '🥳', '😺', '🐶'];

	async function createRoomAndGenerateQuestions() {
		if (!playerName.trim()) {
			error = 'Veuillez entrer votre nom';
			return;
		}

		isLoading = true;
		error = null;

		try {
			// Récupérer le nombre de questions depuis localStorage
			const questionCount = parseInt(
				typeof window !== 'undefined' ? localStorage.getItem('questionCount') || '5' : '5'
			);

			// Créer le joueur
			const playerId = await createPlayer(playerName.trim(), avatars[selectedAvatar]);

			// Créer la room (le nombre de rounds = nombre de questions pour simplifier)
			const room = await createRoom(playerId, questionCount);

			// Ajouter le joueur à la room
			await addPlayerToRoom(room.id, playerId);

			// Générer les questions pour le round 1 via l'API
			const response = await fetch('/api/generate-questions', {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json'
				},
				body: JSON.stringify({
					count: questionCount,
					roomId: room.id,
					roundNumber: 1
				})
			});

			if (!response.ok) {
				const errorData = await response.json();
				throw new Error(errorData.error || 'Erreur lors de la génération des questions');
			}

			// Stocker les informations de la room pour la page lobby
			if (typeof window !== 'undefined') {
				localStorage.setItem('roomId', room.id);
				localStorage.setItem('roomCode', room.code);
				localStorage.setItem('playerId', playerId);
			}

			// Rediriger vers le lobby
			await goto(`/lobby?code=${room.code}`);
		} catch (err) {
			console.error('Erreur lors de la création de la room:', err);
			error = err instanceof Error ? err.message : 'Une erreur est survenue';
			isLoading = false;
		}
	}
</script>

<svelte:head>
	<title>Votre Profil - Bluff Quiz</title>
</svelte:head>

<div class="flex min-h-screen flex-col items-center justify-center p-4">
	<Card>
		<div class="flex flex-col items-center gap-6 px-4 py-6 sm:px-8 sm:py-8">
			<a href="/create" class="self-start text-white/70 transition-colors hover:text-white">
				&larr; Retour
			</a>

			<h1 class="text-2xl font-bold text-white sm:text-3xl">Votre Profil</h1>

			<div class="w-full max-w-sm">
				<Input label="Quel est votre nom ?" placeholder="Entrez votre nom..." bind:value={gameSettings.playerName} />
			</div>

			<div class="flex flex-col items-center gap-2">
				<p class="text-lg font-semibold text-white">Choisissez votre avatar</p>
				<AvatarSelector bind:selected={gameSettings.iconId} />
			</div>

			{#if error}
				<div class="w-full max-w-sm rounded-lg bg-red-500/20 p-3 text-center text-sm text-red-300">
					{error}
				</div>
			{/if}

			<div class="mt-4 w-full max-w-sm">
				<Button
					variant="primary"
					size="lg"
					onclick={createRoomAndGenerateQuestions}
					disabled={isLoading}
				>
					{isLoading ? 'Création en cours...' : 'Créer la salle'}
				</Button>
			</div>
		</div>
	</Card>
</div>

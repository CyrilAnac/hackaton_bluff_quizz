<script lang="ts">
	import { goto } from '$app/navigation';
	import { gameSettings } from '$lib/gameSettings.svelte';
	import { AVATARS } from '$lib/constants';
	import Button from '../../../components/Button.svelte';
	import Card from '../../../components/Card.svelte';
	import Input from '../../../components/Input.svelte';
	import AvatarSelector from '../../../components/AvatarSelector.svelte';

	let isLoading = $state(false);
	let error = $state<string | null>(null);

	async function createRoomAndGenerateQuestions() {
		if (!gameSettings.playerName.trim()) {
			error = 'Veuillez entrer votre nom';
			return;
		}

		isLoading = true;
		error = null;

		try {
			// Appel unique transactionnel
			const res = await fetch('/api/room/create', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ 
					playerName: gameSettings.playerName, 
					iconId: AVATARS[gameSettings.iconId] || AVATARS[0],
					rounds: gameSettings.rounds
				})
			});

			const data = await res.json();
			
			if (data.success) {
				// Stocker le playerId dans localStorage
				if (data.player?.id && typeof window !== 'undefined') {
					localStorage.setItem(`playerId_${data.room.code}`, String(data.player.id));
				}
				goto(`/lobby/${data.room.code}`);
			} else {
				throw new Error(data.error || "Erreur lors de la création de la salle");
			}
		} catch (err: any) {
			console.error('Erreur lors du flux de création:', err);
			error = err.message;
		} finally {
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
					disabled={isLoading || !gameSettings.playerName.trim()}
				>
					{isLoading ? 'Création en cours...' : 'Créer la salle'}
				</Button>
			</div>
		</div>
	</Card>
</div>

<script lang="ts">
	import { goto } from '$app/navigation';
	import { gameSettings } from '$lib/gameSettings.svelte';
	import Button from '../../../components/Button.svelte';
	import Card from '../../../components/Card.svelte';
	import Input from '../../../components/Input.svelte';
	import AvatarSelector from '../../../components/AvatarSelector.svelte';

	let isLoading = $state(false);

	async function joinRoom() {
		if (!gameSettings.playerName || !gameSettings.roomCode || isLoading) return;
		isLoading = true;

		try {
			const res = await fetch('/api/room/join', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ 
					roomCode: gameSettings.roomCode,
					playerName: gameSettings.playerName, 
					iconId: gameSettings.iconId
				})
			});

			const data = await res.json();
			if (data.success) {
				// Redirection vers la salle de jeu
				goto(`/lobby/${gameSettings.roomCode.toUpperCase()}`);
			} else {
				alert(data.error || "Erreur lors de l'accès à la salle");
			}
		} catch (err) {
			console.error(err);
			alert("Erreur réseau");
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
			<a href="/join" class="self-start text-white/70 transition-colors hover:text-white">
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

			<div class="mt-4 w-full max-w-sm">
				<Button 
					variant="primary" 
					size="lg" 
					onclick={joinRoom}
					disabled={!gameSettings.playerName || isLoading}
				>
					{isLoading ? 'Connexion...' : 'Rejoindre'}
				</Button>
			</div>
		</div>
	</Card>
</div>

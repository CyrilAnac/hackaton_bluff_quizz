<script lang="ts">
	import { goto } from '$app/navigation';
	import { gameSettings } from '$lib/gameSettings.svelte';
	import Button from '../../../components/Button.svelte';
	import Card from '../../../components/Card.svelte';
	import Input from '../../../components/Input.svelte';
	import AvatarSelector from '../../../components/AvatarSelector.svelte';

	let isLoading = $state(false);

	async function createRoom() {
		if (!gameSettings.playerName || isLoading) return;
		isLoading = true;

		try {
			// 1. Créer le joueur (Admin) d'abord
			const playerRes = await fetch('/api/player/create', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ 
					playerName: gameSettings.playerName, 
					iconId: gameSettings.iconId
				})
			});

			const playerData = await playerRes.json();
			if (!playerData.success) {
				alert(playerData.error || "Erreur lors de la création du profil");
				isLoading = false;
				return;
			}

			// 2. Créer la salle avec l'ID du joueur comme adminId
			const roomRes = await fetch('/api/room/create', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ 
					adminId: playerData.player.id,
					rounds: gameSettings.rounds
				})
			});
            // 3. Créer les question de la room en fonction du nombre de rounds
			const questionsRes = await fetch('/api/question/create', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ 
					roomId: playerData.player.id,
					rounds: gameSettings.rounds
				})
			});
			
			console.log(roomRes);
			const roomData = await roomRes.json();


			if (roomData.success) {
				goto(`/room/${roomData.room.code}`);
			} else {
				alert(roomData.error || "Erreur lors de la création de la salle");
			}
		} catch (err) {
			console.error(err);
			alert("Erreur réseau lors de la création");
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

			<div class="mt-4 w-full max-w-sm">
				<Button 
					variant="primary" 
					size="lg" 
					onclick={createRoom}
					disabled={!gameSettings.playerName || isLoading}
				>
					{isLoading ? 'Création...' : 'Créer la Room'}
				</Button>
			</div>
		</div>
	</Card>
</div>

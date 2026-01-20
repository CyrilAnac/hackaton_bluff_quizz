<script lang="ts">
	import { gameSettings } from '$lib/gameSettings.svelte';
	import Button from '../../components/Button.svelte';
	import Card from '../../components/Card.svelte';
	import Input from '../../components/Input.svelte';
</script>

<svelte:head>
	<title>Rejoindre une Room - Bluff Quiz</title>
</svelte:head>

<div class="flex min-h-screen flex-col items-center justify-center p-4">
	<Card>
		<div class="flex flex-col items-center gap-8 px-4 py-6 sm:px-8 sm:py-8">
			<a href="/" class="self-start text-white/70 transition-colors hover:text-white">
				&larr; Retour
			</a>

			<h1 class="text-2xl font-bold text-white sm:text-3xl">Rejoindre une Room</h1>

			<div class="w-full max-w-sm">
				<Input
					label="Code de la room"
					placeholder="Entrez le code (ex: AZ342)"
					bind:value={gameSettings.roomCode}
				/>
			</div>

			<div class="mt-4 w-full max-w-sm">
				<a href="/join/player" class="block">
					<Button variant="primary" size="lg" disabled={!gameSettings.roomCode}>Suivant</Button>
				</a>
			</div>
		</div>
	</Card>
</div>

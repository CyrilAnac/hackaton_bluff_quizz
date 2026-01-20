<script lang="ts">
	import { gameSettings } from '$lib/gameSettings.svelte';
	import Button from '../../components/Button.svelte';
	import Card from '../../components/Card.svelte';
	import NumberSelector from '../../components/NumberSelector.svelte';
	import DifficultySelector from '../../components/DifficultySelector.svelte';

	let difficulty = $state<'easy' | 'medium' | 'hard'>('medium');
</script>

<svelte:head>
	<title>Créer une Salle - Bluff Quiz</title>
</svelte:head>

<div class="flex min-h-screen flex-col items-center justify-center p-4">
	<Card>
		<div class="flex flex-col items-center gap-8 px-4 py-6 sm:px-8 sm:py-8">
			<a href="/" class="self-start text-white/70 transition-colors hover:text-white">
				&larr; Retour
			</a>

			<h1 class="text-2xl font-bold text-white sm:text-3xl">Créer une Salle</h1>

			<div class="flex w-full flex-col items-center gap-2">
				<p class="text-lg font-semibold text-white">Nombre de questions</p>
				<NumberSelector min={1} max={15} bind:value={gameSettings.rounds} />
			</div>

			<!--
			<div class="flex w-full flex-col items-center gap-3">
				<p class="text-lg font-semibold text-white">Difficulté</p>
				<DifficultySelector bind:selected={difficulty} />
			</div>
			-->

			<div class="mt-4 w-full max-w-sm">
				<a href="/create/player" onclick={() => {
					if (typeof window !== 'undefined') {
						localStorage.setItem('questionCount', questionCount.toString());
					}
				}} class="block">
					<Button variant="primary" size="lg">Suivant</Button>
				</a>
			</div>
		</div>
	</Card>
</div>

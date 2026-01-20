<script lang="ts">
	import Button from '../../../components/Button.svelte';
	import Card from '../../../components/Card.svelte';
	import Input from '../../../components/Input.svelte';
	import AvatarSelector from '../../../components/AvatarSelector.svelte';

	let playerName = $state('');
	let selectedAvatar = $state(0);
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
				<Input label="Quel est votre nom ?" placeholder="Entrez votre nom..." bind:value={playerName} />
			</div>

			<div class="flex flex-col items-center gap-2">
				<p class="text-lg font-semibold text-white">Choisissez votre avatar</p>
				<AvatarSelector bind:selected={selectedAvatar} />
			</div>

			<div class="mt-4 w-full max-w-sm">
				<a href="/lobby" class="block">
					<Button variant="primary" size="lg">Rejoindre</Button>
				</a>
			</div>
		</div>
	</Card>
</div>

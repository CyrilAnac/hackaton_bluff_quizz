<script lang="ts">
	import Button from '../components/Button.svelte';
	import Card from '../components/Card.svelte';
	import logo from '$lib/assets/favicon.svg';
</script>

<svelte:head>
	<title>Bluff Quiz - Vends le faux ET achète le vrai</title>
</svelte:head>

<div class="flex min-h-screen flex-col items-center justify-center p-4">
	<Card>
		<div class="flex flex-col items-center gap-8 px-4 py-6 sm:px-12 sm:py-8">
			<div class="flex flex-col items-center gap-4">
				<img src={logo} alt="Bluff Quiz" class="h-20 w-auto sm:h-24" />
				<h1 class="text-4xl font-bold tracking-tight text-white sm:text-5xl md:text-6xl">
					BLUFF QUIZ
				</h1>
				<p class="text-lg text-white/80 sm:text-xl">
					VENDS LE FAUX ET ACHÈTE LE VRAI
				</p>
			</div>

			<div class="flex w-full flex-col gap-4 sm:flex-row sm:gap-6">
				<a href="/join" class="w-full sm:w-auto">
					<Button variant="primary" size="lg">
						Rejoindre une Salle
					</Button>
				</a>
				<a href="/create" class="w-full sm:w-auto">
					<Button variant="primary" size="lg">
						Créer une Salle
					</Button>
				</a>
			</div>
		</div>
	</Card>
</div>

<script lang="ts">
	import Button from '../components/Button.svelte';
	import Card from '../components/Card.svelte';
</script>

<svelte:head>
	<title>Bluff Quiz - Vends le faux ET achète le vrai</title>
</svelte:head>

<div class="flex min-h-screen flex-col items-center justify-center p-4">
	<Card>
		<div class="flex flex-col items-center gap-8 px-4 py-6 sm:px-12 sm:py-8">
			<div class="text-center">
				<h1 class="mb-2 text-4xl font-bold tracking-tight text-white sm:text-5xl md:text-6xl">
					Bluff QUIZ
				</h1>
				<p class="text-lg text-white/80 sm:text-xl">
					Vends le faux ET achète le vrai
				</p>
			</div>

			<div class="flex w-full flex-col gap-4 sm:flex-row sm:gap-6">
				<a href="/join" class="w-full sm:w-auto">
					<Button variant="primary" size="lg">
						Rejoindre
					</Button>
				</a>
				<a href="/create" class="w-full sm:w-auto">
					<Button variant="primary" size="lg">
						Créer une Room
					</Button>
				</a>
			</div>
		</div>
	</Card>
</div>

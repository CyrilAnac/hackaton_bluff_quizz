<script lang="ts">
	import Button from '../../components/Button.svelte';
	import Card from '../../components/Card.svelte';
	import QRCode from '../../components/QRCode.svelte';
	import PlayerList from '../../components/PlayerList.svelte';

	// Mock data - will be replaced with real data later
	const roomCode = 'AZ342';
	const joinUrl = `${typeof window !== 'undefined' ? window.location.origin : ''}/join?code=${roomCode}`;

	const players = [
		{ name: 'Alice', avatar: '😀', isHost: true },
		{ name: 'Bob', avatar: '😎' }
	];

	function copyCode() {
		navigator.clipboard.writeText(roomCode);
	}

	function startGame() {
		// TODO: Implement game start logic
		console.log('Starting game...');
	}
</script>

<svelte:head>
	<title>Salon - Bluff Quiz</title>
</svelte:head>

<div class="flex min-h-screen flex-col items-center justify-center p-4">
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

			<div class="mt-4 flex justify-center">
				<Button variant="primary" size="lg" onclick={startGame}>
					Lancer la Partie
				</Button>
			</div>
		</div>
	</Card>
</div>

<script lang="ts">
	import Button from '../../../components/Button.svelte';
	import Card from '../../../components/Card.svelte';
	import Timer from '../../../components/Timer.svelte';

	let phase = $state<'voting' | 'revealing'>('voting');
	let selectedVoteId = $state<string | null>(null);

	// Mock data for voting phase
	const players = [
		{ id: 'p1', name: 'Moi', avatar: '😀', score: 10, roundScore: 0 },
		{ id: 'p2', name: 'Alice', avatar: '🦊', score: 15, roundScore: 0 },
		{ id: 'p3', name: 'Bob', avatar: '🤖', score: 8, roundScore: 0 },
		{ id: 'p4', name: 'Charlie', avatar: '🦁', score: 12, roundScore: 0 }
	];

	let voteOptions = $state([
		{ id: 'v1', text: "plante herbacée dont le pollen est très allergisant", authorId: null, isCorrect: true, votes: [] as string[] }, // Vraie réponse
		{ id: 'v2', text: "Une technique de broderie médiévale utilisant du fil d'or", authorId: 'p2', isCorrect: false, votes: [] as string[] },
		{ id: 'v3', text: "Un plat traditionnel du sud-ouest à base de canard", authorId: 'p3', isCorrect: false, votes: [] as string[] },
		{ id: 'v4', text: "Une maladie des arbres fruitiers causée par un champignon", authorId: 'p4', isCorrect: false, votes: [] as string[] },
		{ id: 'v5', text: "Une danse folklorique bretonne oubliée", authorId: 'p1', isCorrect: false, votes: [] as string[] }
	]);
	
	function handleVote(optionId: string) {
		if (selectedVoteId) return; // Déjà voté
		
		const option = voteOptions.find(v => v.id === optionId);
		if (option?.authorId === 'p1') {
			alert("Vous ne pouvez pas voter pour votre propre réponse !");
			return;
		}

		selectedVoteId = optionId;
		
		// Simuler l'attente des autres
		setTimeout(() => {
			revealResults();
		}, 2000);
	}

	function revealResults() {
		phase = 'revealing';
		
		// Simuler les votes des autres (random)
		voteOptions = voteOptions.map(opt => {
			// Simuler quelques votes aléatoires des bots
			players.slice(1).forEach(p => {
				if (Math.random() > 0.5 && !opt.votes.includes(p.id)) {
					// Logic très simplifiée
				}
			});
			return opt;
		});
		
		// Assigner des votes aléatoires pour la démo
		const availablePlayers = players.slice(1); // Bots
		availablePlayers.forEach(p => {
			const randomOption = voteOptions[Math.floor(Math.random() * voteOptions.length)];
			if (randomOption.authorId !== p.id) {
				randomOption.votes.push(p.id);
			} else {
				const correct = voteOptions.find(v => v.isCorrect);
				correct?.votes.push(p.id);
			}
		});

		// Ajouter mon vote
		if (selectedVoteId) {
			const myVoteOption = voteOptions.find(v => v.id === selectedVoteId);
			myVoteOption?.votes.push('p1');
		}

		// Calculer les scores du round (Simplifié)
		const myVote = voteOptions.find(v => v.id === selectedVoteId);
		if (myVote?.isCorrect) {
			players[0].roundScore += 100;
		}

		const myBluff = voteOptions.find(v => v.authorId === 'p1');
		if (myBluff) {
			players[0].roundScore += myBluff.votes.length * 50;
		}
	}

	function handleTimeUp() {
		if (phase === 'voting') {
			revealResults();
		}
	}
</script>

<svelte:head>
	<title>Vote - Bluff Quiz</title>
</svelte:head>

<div class="flex min-h-screen flex-col items-center justify-center p-4">
	<Card>
		<div class="flex flex-col items-center gap-6 px-4 py-6 sm:px-8 sm:py-8">
			<div class="flex w-full items-start justify-between">
				<div class="flex h-16 w-16 items-center justify-center rounded-full bg-white text-3xl shadow-lg">
					{players[0].avatar}
				</div>
				<Timer seconds={20} onComplete={handleTimeUp} />
			</div>

			{#if phase === 'voting'}
				<h2 class="text-xl font-bold text-white mb-4">Trouvez la bonne réponse !</h2>
				
				<div class="grid grid-cols-1 gap-3 w-full sm:grid-cols-2">
					{#each voteOptions as option}
						<button
							class="relative flex flex-col items-center justify-center rounded-xl p-4 text-center transition-all
							{selectedVoteId === option.id 
								? 'bg-white text-primary ring-4 ring-white/50 scale-[1.02]' 
								: 'bg-white/20 text-white hover:bg-white/30'}
							{option.authorId === 'p1' ? 'opacity-50 cursor-not-allowed border-2 border-dashed border-white/50' : ''}"
							onclick={() => handleVote(option.id)}
							disabled={!!selectedVoteId || option.authorId === 'p1'}
						>
							<p class="font-medium text-lg">{option.text}</p>
							{#if option.authorId === 'p1'}
								<span class="text-xs uppercase mt-2 font-bold tracking-wider">(Votre bluff)</span>
							{/if}
						</button>
					{/each}
				</div>
				
				{#if selectedVoteId}
					<p class="text-white/80 animate-pulse mt-4">En attente des autres joueurs...</p>
				{/if}

			{:else if phase === 'revealing'}
				<h2 class="text-xl font-bold text-white mb-4">Résultats</h2>
				
				<div class="grid grid-cols-1 gap-4 w-full">
					{#each voteOptions as option}
						<div
							class="relative flex flex-col items-center justify-center rounded-xl p-4 text-center transition-all border-2
							{option.isCorrect 
								? 'bg-green-500/90 border-green-300 text-white scale-[1.02] shadow-[0_0_20px_rgba(34,197,94,0.5)]' 
								: option.votes.length > 0 
									? 'bg-red-500/80 border-red-300 text-white' 
									: 'bg-white/10 border-transparent text-white/60'}"
						>
							<p class="font-bold text-lg">{option.text}</p>
							
							{#if option.isCorrect}
								<div class="absolute -top-3 -right-3 bg-green-400 text-white rounded-full p-1 shadow-md">
									<svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
									  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
									</svg>
								</div>
							{/if}

							<!-- Avatars des votants -->
							{#if option.votes.length > 0}
								<div class="absolute -top-4 left-1/2 transform -translate-x-1/2 flex -space-x-2">
									{#each option.votes as voterId}
										{@const voter = players.find(p => p.id === voterId)}
										{#if voter}
											<div class="h-10 w-10 rounded-full bg-white flex items-center justify-center text-xl shadow-md border-2 border-white ring-1 ring-black/10" title={voter.name}>
												{voter.avatar}
											</div>
										{/if}
									{/each}
								</div>
							{/if}
							
							<!-- Auteur du bluff -->
							{#if !option.isCorrect && option.authorId}
								{@const author = players.find(p => p.id === option.authorId)}
								{#if author}
									<div class="mt-2 text-xs flex items-center gap-1 bg-black/20 px-2 py-1 rounded-full">
										<span>Bluff de</span>
										<span class="font-bold">{author.name}</span>
									</div>
								{/if}
							{/if}
						</div>
					{/each}
				</div>

				<div class="w-full mt-6 bg-black/20 rounded-xl p-4">
					<h3 class="text-white font-bold mb-3 text-center">Score du round</h3>
					<div class="flex justify-around items-end h-24 gap-2">
						{#each players as player}
							<div class="flex flex-col items-center gap-1 group">
								<div class="text-white font-bold text-sm bg-primary px-2 py-0.5 rounded-full mb-1 opacity-0 transition-all group-hover:opacity-100 transform translate-y-2 group-hover:translate-y-0">
									+{player.roundScore}
								</div>
								<div class="relative">
									<div class="h-12 w-12 rounded-full bg-white flex items-center justify-center text-2xl shadow-lg border-4 {player.id === 'p1' ? 'border-yellow-400' : 'border-transparent'}">
										{player.avatar}
									</div>
									<div class="absolute -bottom-2 -right-2 bg-black/60 text-white text-xs px-1.5 py-0.5 rounded-full font-mono">
										{player.score + player.roundScore}
									</div>
								</div>
								<span class="text-white text-xs font-medium truncate max-w-[60px]">{player.name}</span>
							</div>
						{/each}
					</div>
				</div>
				
				<div class="w-full mt-4">
					<Button variant="primary" size="lg" onclick={() => alert("Prochain round (Redirection vers /game/question) !")}>
						Round Suivant
					</Button>
				</div>
			{/if}
		</div>
	</Card>
</div>


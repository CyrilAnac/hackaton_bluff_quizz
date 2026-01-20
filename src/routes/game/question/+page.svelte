<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import { invalidateAll } from '$app/navigation';
	import { supabase } from '$lib/supabaseClient';
	import Button from '../../../components/Button.svelte';
	import Card from '../../../components/Card.svelte';
	import Input from '../../../components/Input.svelte';
	import Timer from '../../../components/Timer.svelte';
	import type { PageData } from './$types';

	interface Props {
		data: PageData;
	}

	let { data }: Props = $props();

	// Données réactives
	let room = $derived(data.room);
	let question = $derived(data.question);
	let currentPlayer = $derived(data.currentPlayer);
	let playerResponse = $derived(data.playerResponse);
	let playerVote = $derived(data.playerVote);
	let allResponses = $derived(data.allResponses || []);
	let votes = $derived(data.votes || []);

	// États locaux
	let answer = $state('');
	let fakeAnswer = $state('');
	let phase = $state<'answering' | 'correct' | 'wrong' | 'waiting' | 'voting' | 'revealing'>('answering');
	let isLoading = $state(false);
	let error = $state<string | null>(null);
	let voteOptions = $state<any[]>([]);
	let selectedVoteId = $state<string | null>(null);

	// Récupérer le playerId depuis localStorage ou les données de la page
	let playerId = $derived.by(() => {
		if (typeof window !== 'undefined') {
			const storedId = localStorage.getItem(`playerId_${room.code}`);
			if (storedId) return storedId;
		}
		return currentPlayer?.id || null;
	});

	// Formater les joueurs depuis la room
	const players = $derived(room.players?.map((p: any) => ({
		id: p.id,
		name: p.name,
		avatar: p.icon_id,
		score: 0, // TODO: Récupérer depuis la base de données
		roundScore: 0
	})) || []);

	const playerAvatar = $derived(currentPlayer?.icon_id || '😀');

	let channel: any;

	onMount(() => {
		// Déterminer la phase initiale
		if (playerResponse) {
			// Le joueur a déjà répondu
			if (playerResponse.is_right) {
				phase = 'waiting';
			} else {
				// C'est un bluff, vérifier si on est en phase de vote
				checkVotingPhase();
			}
		} else {
			phase = 'answering';
		}

		// S'abonner aux changements de réponses et votes
		if (question?.id) {
			channel = supabase
				.channel(`question:${question.id}`)
				.on(
					'postgres_changes',
					{
						event: '*',
						schema: 'public',
						table: 'responses',
						filter: `question_id=eq.${question.id}`
					},
					() => {
						invalidateAll();
					}
				)
				.on(
					'postgres_changes',
					{
						event: '*',
						schema: 'public',
						table: 'votes',
						filter: `response_id=in.(${allResponses.map(r => r.id).join(',')})`
					},
					() => {
						invalidateAll();
					}
				)
				.subscribe();
		}
	});

	onDestroy(() => {
		if (channel) {
			supabase.removeChannel(channel);
		}
	});

	// Fonction pour vérifier si on doit passer en phase de vote
	async function checkVotingPhase() {
		// Vérifier si tous les joueurs ont répondu
		const totalPlayers = players.length;
		const totalResponses = allResponses.length;

		if (totalResponses >= totalPlayers) {
			// Tous les joueurs ont répondu, passer à la phase de vote
			await loadVoteOptions();
			phase = 'voting';
		} else {
			phase = 'waiting';
		}
	}

	// Charger les options de vote
	async function loadVoteOptions() {
		if (!question?.id) return;

		// Utiliser les réponses déjà chargées depuis la page
		if (allResponses && allResponses.length > 0) {
			// Formater les options de vote
			voteOptions = allResponses.map((r: any) => ({
				id: r.id,
				text: r.content,
				authorId: r.player_id,
				isCorrect: r.is_right,
				votes: [] as string[]
			}));

			// Charger les votes existants
			const responseIds = voteOptions.map((v: any) => v.id);
			const { data: existingVotes } = await supabase
				.from('votes')
				.select('player_id, response_id')
				.in('response_id', responseIds);

			// Assigner les votes aux options
			if (existingVotes) {
				existingVotes.forEach((vote: any) => {
					const option = voteOptions.find((v: any) => v.id === vote.response_id);
					if (option) {
						option.votes.push(vote.player_id);
					}
				});
			}

			// Mélanger les options
			voteOptions = shuffleArray(voteOptions);
		}
	}

	function shuffleArray<T>(array: T[]): T[] {
		const newArray = [...array];
		for (let i = newArray.length - 1; i > 0; i--) {
			const j = Math.floor(Math.random() * (i + 1));
			[newArray[i], newArray[j]] = [newArray[j], newArray[i]];
		}
		return newArray;
	}

	async function checkAnswer() {
		if (!answer.trim() || !question?.id || !playerId) return;

		isLoading = true;
		error = null;

		try {
			// Vérifier la réponse avec l'API
			const verifyRes = await fetch('/api/verify-answer', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					questionId: question.id,
					answer: answer.trim()
				})
			});

			const verifyData = await verifyRes.json();

			if (!verifyData.success) {
				throw new Error(verifyData.error || 'Erreur lors de la vérification');
			}

			if (verifyData.isValid) {
				// Bonne réponse !
				phase = 'correct';
			} else {
				// Mauvaise réponse, soumettre comme bluff
				await submitBluff(answer.trim());
			}
		} catch (err: any) {
			console.error('Erreur lors de la vérification:', err);
			error = err.message || 'Erreur lors de la vérification de la réponse';
		} finally {
			isLoading = false;
		}
	}

	async function submitBluff(bluffText: string) {
		if (!question?.id || !playerId) return;

		try {
			const res = await fetch('/api/game/respond', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					playerId,
					questionId: question.id,
					content: bluffText
				})
			});

			const data = await res.json();

			if (!data.success) {
				throw new Error(data.error || 'Erreur lors de la soumission');
			}

			phase = 'wrong';
			setTimeout(async () => {
				await checkVotingPhase();
			}, 2000);
		} catch (err: any) {
			console.error('Erreur lors de la soumission du bluff:', err);
			error = err.message || 'Erreur lors de la soumission';
		}
	}

	async function submitFakeAnswer() {
		if (!fakeAnswer.trim() || !question?.id || !playerId) return;

		isLoading = true;
		error = null;

		try {
			// Soumettre la fausse réponse comme bluff
			await submitBluff(fakeAnswer.trim());
			phase = 'waiting';
			
			// Vérifier périodiquement si on peut passer au vote
			const checkInterval = setInterval(async () => {
				await checkVotingPhase();
				if (phase === 'voting') {
					clearInterval(checkInterval);
				}
			}, 2000);

			// Arrêter après 30 secondes max
			setTimeout(() => clearInterval(checkInterval), 30000);
		} catch (err: any) {
			console.error('Erreur lors de la soumission:', err);
			error = err.message || 'Erreur lors de la soumission';
		} finally {
			isLoading = false;
		}
	}

	async function handleVote(responseId: string) {
		if (selectedVoteId || !playerId) return;

		// Vérifier qu'on ne vote pas pour sa propre réponse
		const option = voteOptions.find((v: any) => v.id === responseId);
		if (option?.authorId === playerId) {
			alert("Vous ne pouvez pas voter pour votre propre réponse !");
			return;
		}

		isLoading = true;
		error = null;

		try {
			const res = await fetch('/api/game/vote', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					playerId,
					responseId
				})
			});

			const data = await res.json();

			if (!data.success) {
				throw new Error(data.error || 'Erreur lors du vote');
			}

			selectedVoteId = responseId;
			
			// Attendre que tous les joueurs aient voté avant de révéler
			setTimeout(async () => {
				await revealResults();
			}, 2000);
		} catch (err: any) {
			console.error('Erreur lors du vote:', err);
			error = err.message || 'Erreur lors du vote';
		} finally {
			isLoading = false;
		}
	}

	async function revealResults() {
		// Recharger les votes pour avoir les résultats complets
		await loadVoteOptions();
		phase = 'revealing';
	}

	function handleTimeUp() {
		if (phase === 'answering' && answer.trim()) {
			checkAnswer();
		} else if (phase === 'answering') {
			// Soumettre une réponse vide comme bluff
			if (answer.trim()) {
				submitBluff(answer.trim());
			}
		}
	}

	// Vérifier la phase de vote au chargement si nécessaire
	$effect(() => {
		if (playerResponse && !playerResponse.is_right && phase === 'waiting') {
			checkVotingPhase();
		}
		if (playerVote && phase !== 'revealing') {
			selectedVoteId = playerVote.response_id;
			revealResults();
		}
	});
</script>

<svelte:head>
	<title>Question - Bluff Quiz</title>
</svelte:head>

<div class="flex min-h-screen flex-col items-center justify-center p-4">
	<Card>
		<div class="flex flex-col items-center gap-6 px-4 py-6 sm:px-8 sm:py-8">
			<div class="flex w-full items-start justify-between">
				<div
					class="flex h-16 w-16 items-center justify-center rounded-full bg-white text-3xl shadow-lg"
				>
					{playerAvatar}
				</div>
				{#if phase === 'answering'}
					<Timer seconds={30} onComplete={handleTimeUp} />
				{/if}
			</div>

			{#if error}
				<div class="w-full rounded-lg bg-red-500/20 p-3 text-center text-sm text-red-300">
					{error}
				</div>
			{/if}

			{#if phase === 'answering'}
				<h1 class="text-center text-xl font-bold text-white sm:text-2xl">
					{question?.content || 'Chargement...'}
				</h1>

				<div class="w-full">
					<Input
						placeholder="Écrivez votre réponse..."
						bind:value={answer}
						disabled={isLoading}
					/>
				</div>

				<div class="w-full">
					<Button 
						variant="primary" 
						size="lg" 
						onclick={checkAnswer} 
						disabled={!answer.trim() || isLoading}
					>
						{isLoading ? 'Vérification...' : 'Valider'}
					</Button>
				</div>
			{:else if phase === 'correct'}
				<div class="flex flex-col items-center gap-4">
					<div class="flex h-16 w-16 items-center justify-center rounded-full bg-green-500 text-4xl shadow-lg">
						✓
					</div>
					<h2 class="text-2xl font-bold text-white">Bonne réponse !</h2>
					<p class="text-center text-white/80">
						Maintenant, écrivez une fausse réponse crédible pour piéger les autres joueurs.
					</p>
				</div>

				<div class="w-full">
					<Input
						label="Votre fausse réponse"
						placeholder="Inventez une réponse crédible..."
						bind:value={fakeAnswer}
						disabled={isLoading}
					/>
				</div>

				<div class="w-full">
					<Button 
						variant="primary" 
						size="lg" 
						onclick={submitFakeAnswer} 
						disabled={!fakeAnswer.trim() || isLoading}
					>
						{isLoading ? 'Envoi...' : 'Envoyer'}
					</Button>
				</div>
			{:else if phase === 'wrong'}
				<div class="flex flex-col items-center gap-4">
					<div class="flex h-16 w-16 items-center justify-center rounded-full bg-red-500 text-4xl shadow-lg">
						✗
					</div>
					<h2 class="text-2xl font-bold text-white">Mauvaise réponse !</h2>
					<p class="text-center text-white/80">
						Votre réponse a été envoyée pour la phase de vote.
					</p>
					<p class="text-center text-sm text-white/60">
						En attente des autres joueurs...
					</p>
				</div>

				<div class="flex items-center gap-2">
					<div class="h-3 w-3 animate-pulse rounded-full bg-white/60"></div>
					<div class="h-3 w-3 animate-pulse rounded-full bg-white/60" style="animation-delay: 0.2s"></div>
					<div class="h-3 w-3 animate-pulse rounded-full bg-white/60" style="animation-delay: 0.4s"></div>
				</div>
			{:else if phase === 'waiting'}
				<div class="flex flex-col items-center gap-4">
					<div class="flex h-16 w-16 items-center justify-center rounded-full bg-green-500 text-4xl shadow-lg">
						✓
					</div>
					<h2 class="text-2xl font-bold text-white">Réponse envoyée !</h2>
					<p class="text-center text-white/80">
						En attente des autres joueurs...
					</p>
					<p class="text-center text-sm text-white/60">
						{allResponses.length} / {players.length} joueurs ont répondu
					</p>
				</div>

				<div class="flex items-center gap-2">
					<div class="h-3 w-3 animate-pulse rounded-full bg-white/60"></div>
					<div class="h-3 w-3 animate-pulse rounded-full bg-white/60" style="animation-delay: 0.2s"></div>
					<div class="h-3 w-3 animate-pulse rounded-full bg-white/60" style="animation-delay: 0.4s"></div>
				</div>
			{:else if phase === 'voting'}
				<h2 class="text-xl font-bold text-white mb-4">Trouvez la bonne réponse !</h2>
				
				<div class="grid grid-cols-1 gap-3 w-full sm:grid-cols-2">
					{#each voteOptions as option}
						{@const isMyBluff = option.authorId === playerId}
						<button
							class="relative flex flex-col items-center justify-center rounded-xl p-4 text-center transition-all
							{selectedVoteId === option.id 
								? 'bg-white text-primary ring-4 ring-white/50 scale-[1.02]' 
								: 'bg-white/20 text-white hover:bg-white/30'}
							{isMyBluff ? 'opacity-50 cursor-not-allowed border-2 border-dashed border-white/50' : ''}"
							onclick={() => handleVote(option.id)}
							disabled={!!selectedVoteId || isMyBluff || isLoading}
						>
							<p class="font-medium text-lg">{option.text}</p>
							{#if isMyBluff}
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
						{@const author = players.find(p => p.id === option.authorId)}
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
							{#if !option.isCorrect && author}
								<div class="mt-2 text-xs flex items-center gap-1 bg-black/20 px-2 py-1 rounded-full">
									<span>Bluff de</span>
									<span class="font-bold">{author.name}</span>
								</div>
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
									<div class="h-12 w-12 rounded-full bg-white flex items-center justify-center text-2xl shadow-lg border-4 {player.id === playerId ? 'border-yellow-400' : 'border-transparent'}">
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
					<Button variant="primary" size="lg" onclick={() => alert("Prochain round !")}>
						Round Suivant
					</Button>
				</div>
			{/if}
		</div>
	</Card>
</div>

<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import { supabase } from '$lib/supabaseClient';
	import Button from './Button.svelte';
	import Card from './Card.svelte';

	interface Props {
		room: any;
		question: any;
		playerId: string | null;
	}

	let { room, question, playerId }: Props = $props();

	// États locaux
	let allResponses = $state<any[]>([]);
	let votes = $state<any[]>([]);
	let playerVote = $state<any>(null);
	let voteOptions = $state<any[]>([]);
	let selectedVoteId = $state<string | null>(null);
	let phase = $state<'voting' | 'waiting' | 'revealing'>('voting');
	let isLoading = $state(false);
	let error = $state<string | null>(null);
	let scores = $state<Record<string, number>>({});
	let scoreDetails = $state<Record<string, { foundCorrect: boolean; votesReceived: number; votedCorrect: boolean }>>({});
	let correctResponseId = $state<string | null>(null);
	let hasFoundCorrectAnswer = $state(false);
	let playersWhoCanVoteCount = $state<number>(0);

	// Formater les joueurs depuis la room
	const players = $derived(room.players?.map((p: any) => ({
		id: p.id,
		name: p.name,
		avatar: p.icon_id,
		score: scores[p.id] || 0,
		roundScore: scores[p.id] || 0,
		scoreDetails: scoreDetails[p.id] || { foundCorrect: false, votesReceived: 0, votedCorrect: false }
	})) || []);

	let channel: any;

	// Charger les données de vote
	async function loadVoteData() {
		if (!question?.id) return;

		try {
			// Récupérer toutes les réponses
			const { data: responses, error: responsesError } = await supabase
				.from('responses')
				.select('id, content, player_id, is_right, question_id')
				.eq('question_id', question.id);

			if (responsesError) {
				console.error('Erreur chargement réponses:', responsesError);
				return;
			}

			if (responses) {
				allResponses = responses.map((r: any) => {
					const player = room.players?.find((p: any) => p.id === r.player_id);
					return {
						...r,
						player: player || null
					};
				});

				// Vérifier si le joueur a trouvé la bonne réponse
				hasFoundCorrectAnswer = false;
				if (playerId) {
					// Méthode 1 : Vérifier via la table correct_answer_finders
					try {
						const { data: finderData } = await supabase
							.from('correct_answer_finders')
							.select('player_id')
							.eq('question_id', question.id)
							.eq('player_id', playerId)
							.maybeSingle();
						
						if (finderData) {
							hasFoundCorrectAnswer = true;
						}
					} catch (err) {
						// Si la table n'existe pas, utiliser la méthode alternative
						// Méthode 2 : Vérifier si le joueur a une réponse qui correspond à la bonne réponse
						const correctResponse = responses.find((r: any) => r.is_right === true);
						if (correctResponse) {
							const playerResponse = responses.find((r: any) => r.player_id === playerId);
							if (playerResponse && playerResponse.content.toLowerCase().trim() === correctResponse.content.toLowerCase().trim()) {
								hasFoundCorrectAnswer = true;
							}
						}
					}
				}

				// Préparer les options de vote (exclure la réponse du joueur actuel)
				voteOptions = allResponses
					.filter((r: any) => r.player_id !== playerId) // Exclure sa propre réponse
					.map((r: any) => ({
						id: r.id,
						text: r.content,
						authorId: r.player_id,
						isCorrect: r.is_right,
						votes: [] as string[]
					}));

				// Récupérer les votes existants
				const responseIds = allResponses.map((r: any) => r.id);
				const { data: votesData } = await supabase
					.from('votes')
					.select('id, player_id, response_id')
					.in('response_id', responseIds);

				if (votesData) {
					votes = votesData.map((v: any) => {
						const player = room.players?.find((p: any) => p.id === v.player_id);
						return {
							...v,
							player: player || null
						};
					});

					// Vérifier si le joueur a déjà voté
					if (playerId) {
						playerVote = votes.find((v: any) => v.player_id === playerId);
						if (playerVote) {
							selectedVoteId = playerVote.response_id;
						}
					}

					// Ajouter les votes aux options
					votesData.forEach((vote: any) => {
						const option = voteOptions.find((v: any) => v.id === vote.response_id);
						if (option) {
							option.votes.push(vote.player_id);
						}
					});
				}

				// Mélanger les options pour ne pas révéler la bonne réponse
				voteOptions = shuffleArray(voteOptions);

				// Vérifier si tous les joueurs éligibles ont voté
				// Les joueurs qui ont trouvé la bonne réponse ne votent pas
				playersWhoCanVoteCount = room.players?.length || 0;
				try {
					const { data: allFinders } = await supabase
						.from('correct_answer_finders')
						.select('player_id')
						.eq('question_id', question.id);
					
					if (allFinders) {
						playersWhoCanVoteCount -= allFinders.length;
					}
				} catch (err) {
					// Si la table n'existe pas, on compte tous les joueurs
				}
				
				const uniqueVoters = new Set(votes.map((v: any) => v.player_id));
				if (uniqueVoters.size >= playersWhoCanVoteCount && playersWhoCanVoteCount > 0 && phase === 'voting') {
					// Tous les joueurs éligibles ont voté, calculer les scores
					await calculateScores();
				}
			}
		} catch (err) {
			console.error('Erreur lors du chargement:', err);
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

	async function handleVote(responseId: string) {
		if (selectedVoteId || !playerId) return;

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
			phase = 'waiting';
			
			// Recharger les données et vérifier si tous ont voté
			await loadVoteData();
		} catch (err: any) {
			console.error('Erreur lors du vote:', err);
			error = err.message || 'Erreur lors du vote';
		} finally {
			isLoading = false;
		}
	}

	async function calculateScores() {
		if (!question?.id || !room?.id) return;

		try {
			const res = await fetch('/api/game/calculate-scores', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					questionId: question.id,
					roomId: room.id
				})
			});

			const data = await res.json();

			if (!data.success) {
				throw new Error(data.error || 'Erreur lors du calcul des scores');
			}

			scores = data.scores || {};
			scoreDetails = data.scoreDetails || {};
			correctResponseId = data.correctResponseId || null;
			phase = 'revealing';
		} catch (err: any) {
			console.error('Erreur lors du calcul des scores:', err);
			error = err.message || 'Erreur lors du calcul des scores';
		}
	}

	onMount(() => {
		loadVoteData();

		// S'abonner aux changements
		if (question?.id) {
			channel = supabase
				.channel(`vote:${question.id}`)
				.on(
					'postgres_changes',
					{
						event: '*',
						schema: 'public',
						table: 'votes'
					},
					() => {
						loadVoteData();
					}
				)
				.on(
					'postgres_changes',
					{
						event: '*',
						schema: 'public',
						table: 'responses',
						filter: `question_id=eq.${question.id}`
					},
					() => {
						loadVoteData();
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
</script>

<Card>
	<div class="flex flex-col items-center gap-6 px-4 py-6 sm:px-8 sm:py-8">
		{#if error}
			<div class="w-full rounded-lg bg-red-500/20 p-3 text-center text-sm text-red-300">
				{error}
			</div>
		{/if}

		{#if phase === 'voting'}
			{#if hasFoundCorrectAnswer}
				<div class="flex flex-col items-center gap-4">
					<div class="flex h-16 w-16 items-center justify-center rounded-full bg-green-500 text-4xl shadow-lg">
						✓
					</div>
					<h2 class="text-2xl font-bold text-white">Bonne réponse trouvée !</h2>
					<p class="text-center text-white/80">
						Vous avez trouvé la bonne réponse, vous ne pouvez pas participer à la phase de vote.
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
			{:else}
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
			{/if}

		{:else if phase === 'waiting'}
			<div class="flex flex-col items-center gap-4">
				<div class="flex h-16 w-16 items-center justify-center rounded-full bg-green-500 text-4xl shadow-lg">
					✓
				</div>
				<h2 class="text-2xl font-bold text-white">Vote enregistré !</h2>
				<p class="text-center text-white/80">
					En attente des autres joueurs...
				</p>
				<p class="text-center text-sm text-white/60">
					{votes.length} / {playersWhoCanVoteCount} joueur{playersWhoCanVoteCount > 1 ? 's' : ''} {playersWhoCanVoteCount > 1 ? 'ont' : 'a'} voté
				</p>
			</div>

			<div class="flex items-center gap-2">
				<div class="h-3 w-3 animate-pulse rounded-full bg-white/60"></div>
				<div class="h-3 w-3 animate-pulse rounded-full bg-white/60" style="animation-delay: 0.2s"></div>
				<div class="h-3 w-3 animate-pulse rounded-full bg-white/60" style="animation-delay: 0.4s"></div>
			</div>

		{:else if phase === 'revealing'}
			<h2 class="text-xl font-bold text-white mb-4">Résultats</h2>
			
			<div class="grid grid-cols-1 gap-4 w-full">
				{#each voteOptions as option}
					{@const author = players.find((p: any) => p.id === option.authorId)}
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
									{@const voter = players.find((p: any) => p.id === voterId)}
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
				<div class="flex flex-col gap-3">
					{#each players as player: any}
						<div class="flex items-center justify-between bg-white/10 rounded-lg p-3">
							<div class="flex items-center gap-3">
								<div class="h-12 w-12 rounded-full bg-white flex items-center justify-center text-2xl shadow-lg border-4 {player.id === playerId ? 'border-yellow-400' : 'border-transparent'}">
									{player.avatar}
								</div>
								<div>
									<p class="text-white font-bold">{player.name}</p>
									<div class="flex gap-2 text-xs text-white/70">
										{#if player.scoreDetails.foundCorrect}
											<span class="bg-green-500/30 px-2 py-0.5 rounded">Bonne réponse trouvée (+2)</span>
										{/if}
										{#if player.scoreDetails.votesReceived > 0}
											<span class="bg-blue-500/30 px-2 py-0.5 rounded">{player.scoreDetails.votesReceived} vote{player.scoreDetails.votesReceived > 1 ? 's' : ''} reçu{player.scoreDetails.votesReceived > 1 ? 's' : ''} (+{player.scoreDetails.votesReceived})</span>
										{/if}
										{#if player.scoreDetails.votedCorrect}
											<span class="bg-purple-500/30 px-2 py-0.5 rounded">Voté pour la bonne réponse (+1)</span>
										{/if}
									</div>
								</div>
							</div>
							<div class="text-white font-bold text-xl">
								+{player.roundScore}
							</div>
						</div>
					{/each}
				</div>
			</div>
		{/if}
	</div>
</Card>

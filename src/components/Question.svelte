<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import { invalidateAll } from '$app/navigation';
	import { supabase } from '$lib/supabaseClient';
	import Button from './Button.svelte';
	import Card from './Card.svelte';
	import Input from './Input.svelte';
	import Timer from './Timer.svelte';
	import Vote from './Vote.svelte';

	interface Props {
		room: any;
		playerId: string | null;
	}

	let { room, playerId }: Props = $props();

	// États locaux
	let question = $state<any>(null);
	let currentPlayer = $state<any>(null);
	let playerResponse = $state<any>(null);
	let playerVote = $state<any>(null);
	let allResponses = $state<any[]>([]);
	let votes = $state<any[]>([]);
	let answer = $state('');
	let fakeAnswer = $state('');
	let phase = $state<'answering' | 'correct' | 'wrong' | 'waiting' | 'voting' | 'revealing'>('answering');
	let isLoading = $state(false);
	let error = $state<string | null>(null);

	// Formater les joueurs depuis la room
	const players = $derived(room.players?.map((p: any) => ({
		id: p.id,
		name: p.name,
		avatar: p.icon_id,
		score: 0,
		roundScore: 0
	})) || []);

	const playerAvatar = $derived(currentPlayer?.icon_id || '😀');

	let channel: any;

	// Charger les données de la question
	async function loadQuestionData() {
		if (!room?.id || !room?.current_round) return;

		try {
			// Récupérer la question actuelle (prendre la première si plusieurs existent)
			const { data: questionsData, error: questionError } = await supabase
				.from('question')
				.select('*')
				.eq('room_id', room.id)
				.eq('round_number', room.current_round)
				.limit(1);

			if (questionError || !questionsData || questionsData.length === 0) {
				console.error('Erreur chargement question:', questionError);
				return;
			}

			// Prendre la première question
			question = questionsData[0];

			// Identifier le joueur actuel
			if (playerId) {
				currentPlayer = room.players?.find((p: any) => p.id === playerId);
			}

			// Récupérer toutes les réponses
			const { data: responses, error: responsesError } = await supabase
				.from('responses')
				.select('id, content, player_id, is_right, question_id')
				.eq('question_id', question.id);

			if (responses) {
				allResponses = responses.map((r: any) => {
					const player = room.players?.find((p: any) => p.id === r.player_id);
					return {
						...r,
						player: player || null
					};
				});

				// Vérifier si le joueur a déjà répondu
				if (playerId) {
					playerResponse = allResponses.find((r: any) => r.player_id === playerId);
				}
			}

			// Récupérer les votes
			if (allResponses.length > 0) {
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
					}
				}
			}

			// Déterminer la phase initiale
			if (playerResponse) {
				if (playerResponse.is_right) {
					phase = 'waiting';
				} else {
					await checkVotingPhase();
				}
			} else {
				phase = 'answering';
			}
		} catch (err) {
			console.error('Erreur lors du chargement:', err);
		}
	}

	onMount(() => {
		loadQuestionData();

		// S'abonner aux changements
		if (room?.id) {
			channel = supabase
				.channel(`room:${room.id}`)
				.on(
					'postgres_changes',
					{
						event: 'INSERT',
						schema: 'public',
						table: 'question',
						filter: `room_id=eq.${room.id}`
					},
					() => {
						console.log("Nouvelle question détectée !");
						loadQuestionData();
					}
				)
				.on(
					'postgres_changes',
					{
						event: '*',
						schema: 'public',
						table: 'responses',
						filter: `question_id=eq.${question?.id || ''}`
					},
					() => {
						loadQuestionData();
					}
				)
				.on(
					'postgres_changes',
					{
						event: '*',
						schema: 'public',
						table: 'votes'
					},
					() => {
						loadQuestionData();
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
		const totalPlayers = players.length;
		const totalResponses = allResponses.length;

		if (totalResponses >= totalPlayers) {
			// Tous les joueurs ont répondu, générer la bonne réponse si elle n'existe pas
			await generateCorrectAnswerIfNeeded();
			phase = 'voting';
		} else {
			phase = 'waiting';
		}
	}

	// Générer la bonne réponse avec l'IA si elle n'existe pas
	async function generateCorrectAnswerIfNeeded() {
		if (!question?.id || !room?.id) return;

		try {
			// Vérifier si une bonne réponse existe déjà
			const { data: existingCorrectResponse } = await supabase
				.from('responses')
				.select('id')
				.eq('question_id', question.id)
				.eq('is_right', true)
				.maybeSingle();

			if (!existingCorrectResponse) {
				// Générer la bonne réponse avec l'IA
				const res = await fetch('/api/game/generate-correct-answer', {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({
						questionId: question.id,
						roomId: room.id
					})
				});

				const data = await res.json();
				if (!data.success && !data.alreadyExists) {
					console.error('Erreur génération bonne réponse:', data.error);
				}

				// Recharger les données pour avoir la nouvelle réponse
				await loadQuestionData();
			}
		} catch (err) {
			console.error('Erreur lors de la génération de la bonne réponse:', err);
		}
	}


	async function checkAnswer() {
		if (!answer.trim() || !question?.id || !playerId) return;

		isLoading = true;
		error = null;

		try {
			// Appeler directement /api/game/respond qui vérifie ET enregistre la réponse
			const res = await fetch('/api/game/respond', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					playerId,
					questionId: question.id,
					content: answer.trim()
				})
			});

			const data = await res.json();

			if (!data.success) {
				throw new Error(data.error || 'Erreur lors de la vérification');
			}

			if (data.type === 'CORRECT') {
				// Bonne réponse !
				phase = 'correct';
			} else if (data.type === 'BLUFF') {
				// Mauvaise réponse, bluff enregistré
				phase = 'wrong';
				setTimeout(async () => {
					await checkVotingPhase();
				}, 2000);
			}
		} catch (err: any) {
			console.error('Erreur lors de la vérification:', err);
			error = err.message || 'Erreur lors de la vérification de la réponse';
		} finally {
			isLoading = false;
		}
	}

	async function submitFakeAnswer() {
		if (!fakeAnswer.trim() || !question?.id || !playerId) return;

		isLoading = true;
		error = null;

		try {
			// Quand on est en phase 'correct', on a déjà trouvé la bonne réponse
			// On crée directement un bluff sans vérification
			const { data: bluffResponse, error: insertError } = await supabase
				.from('responses')
				.insert([{
					question_id: question.id,
					content: fakeAnswer.trim(),
					player_id: playerId,
					is_right: false
				}])
				.select()
				.single();

			if (insertError) {
				// Si erreur (peut-être déjà une réponse), vérifier
				if (insertError.code === '23505') { // Violation de contrainte unique
					throw new Error('Vous avez déjà soumis une réponse pour cette question');
				}
				throw new Error('Erreur lors de l\'enregistrement de votre fausse réponse');
			}

			phase = 'waiting';
			
			// Recharger les données pour avoir la nouvelle réponse
			await loadQuestionData();
			
			const checkInterval = setInterval(async () => {
				await checkVotingPhase();
				if (phase === 'voting') {
					clearInterval(checkInterval);
				}
			}, 2000);

			setTimeout(() => clearInterval(checkInterval), 30000);
		} catch (err: any) {
			console.error('Erreur lors de la soumission:', err);
			error = err.message || 'Erreur lors de la soumission';
		} finally {
			isLoading = false;
		}
	}


	function handleTimeUp() {
		if (phase === 'answering' && answer.trim()) {
			checkAnswer();
		}
	}

	// Réagir aux changements de room
	$effect(() => {
		if (room?.status === 'PLAYING' && room?.current_round) {
			loadQuestionData();
		}
	});
</script>

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

		{#if !question}
			<p class="text-white/80">Chargement de la question...</p>
		{:else if phase === 'answering'}
			<h1 class="text-center text-xl font-bold text-white sm:text-2xl">
				{question.content}
			</h1>

			<div class="w-full">
				<Input
					placeholder="Écrivez votre réponse..."
					bind:value={answer}
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
		{:else if phase === 'voting' || phase === 'revealing'}
			<!-- Utiliser le composant Vote pour gérer la phase de vote -->
			<Vote {room} {question} {playerId} />
		{/if}
	</div>
</Card>

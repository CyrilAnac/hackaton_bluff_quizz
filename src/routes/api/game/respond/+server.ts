import { json } from '@sveltejs/kit';
import { supabase } from '$lib/supabaseClient';
import { generateText } from '$lib/geminiClient';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ request }) => {
	try {
		const { playerId, questionId, content } = await request.json();

		if (!playerId || !questionId || !content) {
			return json({ error: 'Données manquantes (playerId, questionId, content)' }, { status: 400 });
		}

		// 1. Vérifier si l'utilisateur n'a pas déjà soumis une réponse pour cette question
		const { data: existing, error: checkError } = await supabase
			.from('responses')
			.select('id')
			.eq('question_id', questionId)
			.eq('player_id', playerId)
			.maybeSingle();

		if (existing) {
			return json({ error: 'Tu as déjà soumis une réponse pour cette question' }, { status: 400 });
		}

		// 2. Récupérer la question pour vérifier la réponse
		const { data: question, error: questionError } = await supabase
			.from('question')
			.select('content')
			.eq('id', questionId)
			.single();

		if (questionError || !question) {
			return json({ error: 'Question introuvable' }, { status: 404 });
		}

		// 3. Vérifier si une bonne réponse existe déjà pour cette question
		// Utiliser .limit(1) pour éviter les problèmes si plusieurs existent
		const { data: existingCorrectResponses, count } = await supabase
			.from('responses')
			.select('id', { count: 'exact' })
			.eq('question_id', questionId)
			.eq('is_right', true)
			.eq('player_id', null)
			.limit(1);
		
		let existingCorrectResponse = existingCorrectResponses && existingCorrectResponses.length > 0 
			? existingCorrectResponses[0] 
			: null;
		
		// Si plusieurs bonnes réponses existent, on en garde une seule et on supprime les autres
		if (count && count > 1) {
			console.warn(`Plusieurs bonnes réponses trouvées pour la question ${questionId}, nettoyage en cours...`);
			const { data: allCorrectResponses } = await supabase
				.from('responses')
				.select('id')
				.eq('question_id', questionId)
				.eq('is_right', true)
				.eq('player_id', null);
			
			if (allCorrectResponses && allCorrectResponses.length > 1) {
				// Garder la première et supprimer les autres
				const idsToDelete = allCorrectResponses.slice(1).map((r: any) => r.id);
				await supabase
					.from('responses')
					.delete()
					.in('id', idsToDelete);
			}
		}

		// 4. Vérifier avec l'IA si la réponse est correcte
		const prompt = `Tu es un juge impartial pour un jeu de questions-réponses.
Ta tâche est de déterminer si la réponse proposée par un joueur est correcte pour la question donnée.

Question : "${question.content}"
Réponse proposée : "${content.trim()}"

Instructions :
1. Identifie d'abord la bonne réponse factuelle à la question en utilisant tes connaissances.
2. Compare la réponse du joueur avec cette bonne réponse.
3. Sois souple sur la forme (orthographe, synonymes, tournures de phrase) mais strict sur le fond (le fait doit être exact).

Réponds UNIQUEMENT avec un JSON valide au format suivant :
{
  "isValid": true ou false,
  "confidence": un nombre entre 0 et 1 (1 = certain, 0 = certain que c'est faux),
  "reason": "Une brève explication de ta décision"
}

Réponds UNIQUEMENT avec le JSON, sans texte supplémentaire avant ou après.`;

		const aiResponse = await generateText(prompt);
		
		// Nettoyer la réponse pour extraire le JSON
		const jsonMatch = aiResponse.match(/\{[\s\S]*\}/);
		if (!jsonMatch) {
			throw new Error('Réponse de Gemini ne contient pas de JSON valide');
		}

		const verification = JSON.parse(jsonMatch[0]);
		
		if (typeof verification.isValid !== 'boolean') {
			throw new Error('Format de réponse invalide : propriété "isValid" manquante ou invalide');
		}

		// Seuil de tolérance : accepter si isValid est true OU si confidence >= 0.5
		const isCorrect = verification.isValid || (verification.confidence >= 0.5);

		if (isCorrect) {
			// La réponse est correcte !
			// Vérifier si une bonne réponse existe déjà
			if (!existingCorrectResponse) {
				// Vérifier une dernière fois avant d'insérer (pour éviter les race conditions)
				const { data: finalCheck } = await supabase
					.from('responses')
					.select('id')
					.eq('question_id', questionId)
					.eq('is_right', true)
					.eq('player_id', null)
					.limit(1);

				if (finalCheck && finalCheck.length > 0) {
					// Une bonne réponse a été créée entre-temps, on continue comme si elle existait déjà
					existingCorrectResponse = finalCheck[0];
				} else {
					// Créer la bonne réponse si elle n'existe pas encore
					const { data: correctResponse, error: insertCorrectError } = await supabase
						.from('responses')
						.insert([{
							question_id: questionId,
							content: content.trim(),
							player_id: null, // La bonne réponse n'a pas de joueur associé
							is_right: true
						}])
						.select()
						.single();

					if (insertCorrectError) {
						console.error('Erreur insertion bonne réponse:', insertCorrectError);
						// Si l'erreur est due à un doublon créé entre-temps, vérifier à nouveau
						if (insertCorrectError.code === '23505' || insertCorrectError.message?.includes('duplicate')) {
							const { data: existing } = await supabase
								.from('responses')
								.select('id')
								.eq('question_id', questionId)
								.eq('is_right', true)
								.eq('player_id', null)
								.limit(1)
								.single();
							
							if (existing) {
								existingCorrectResponse = existing;
							} else {
								return json({ error: 'Erreur lors de l\'enregistrement de la bonne réponse' }, { status: 500 });
							}
						} else {
							return json({ error: 'Erreur lors de l\'enregistrement de la bonne réponse' }, { status: 500 });
						}
					} else {
						// Stocker qui a trouvé la bonne réponse dans une table dédiée (si elle existe)
						try {
							await supabase
								.from('correct_answer_finders')
								.insert([{
									question_id: questionId,
									player_id: playerId,
									found_at: new Date().toISOString()
								}]);
						} catch (err) {
							// La table n'existe peut-être pas, on continue
							console.log('Table correct_answer_finders non disponible, utilisation de la méthode alternative');
						}

						return json({ 
							success: true, 
							type: 'CORRECT',
							message: 'Bonne réponse ! Vous pouvez maintenant créer une fausse réponse pour piéger les autres.',
							response: correctResponse
						});
					}
				}
			}
			
			// Si on arrive ici, une bonne réponse existe déjà (soit elle existait, soit elle a été créée entre-temps)
			// Stocker qui a trouvé la bonne réponse dans une table dédiée (si elle existe)
			try {
				await supabase
					.from('correct_answer_finders')
					.insert([{
						question_id: questionId,
						player_id: playerId,
						found_at: new Date().toISOString()
					}]);
			} catch (err) {
				// La table n'existe peut-être pas, on continue
				console.log('Table correct_answer_finders non disponible, utilisation de la méthode alternative');
			}

			return json({ 
				success: true, 
				type: 'CORRECT',
				message: 'Bonne réponse ! Vous pouvez maintenant créer une fausse réponse pour piéger les autres.'
			});
		} else {
			// C'est un bluff, on l'ajoute à la table responses pour que les autres puissent voter dessus
			const { data: newResponse, error: insertError } = await supabase
				.from('responses')
				.insert([{
					question_id: questionId,
					content: content.trim(),
					player_id: playerId,
					is_right: false
				}])
				.select()
				.single();

			if (insertError) {
				console.error('Erreur insertion bluff:', insertError);
				return json({ error: 'Erreur lors de l\'enregistrement de ton bluff' }, { status: 500 });
			}

			return json({ 
				success: true, 
				type: 'BLUFF',
				message: 'Mauvaise réponse. Ton bluff a été enregistré pour la phase de vote.',
				response: newResponse
			});
		}

	} catch (err) {
		console.error('API Respond Error:', err);
		return json({ error: 'Erreur interne du serveur' }, { status: 500 });
	}
};

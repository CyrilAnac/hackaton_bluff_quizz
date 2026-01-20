import { json } from '@sveltejs/kit';
import { supabase } from '$lib/supabaseClient';
import { generateText } from '$lib/geminiClient';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ request }) => {
	try {
		const { questionId, roomId } = await request.json();

		if (!questionId || !roomId) {
			return json({ error: 'Données manquantes (questionId, roomId)' }, { status: 400 });
		}

		// 1. Vérifier si une bonne réponse existe déjà
		const { data: existingCorrectResponse } = await supabase
			.from('responses')
			.select('id')
			.eq('question_id', questionId)
			.eq('is_right', true)
			.maybeSingle();

		if (existingCorrectResponse) {
			return json({ 
				success: true, 
				message: 'Une bonne réponse existe déjà',
				alreadyExists: true
			});
		}

		// 2. Récupérer la question
		const { data: question, error: questionError } = await supabase
			.from('question')
			.select('content')
			.eq('id', questionId)
			.single();

		if (questionError || !question) {
			return json({ error: 'Question introuvable' }, { status: 404 });
		}

		// 3. Récupérer toutes les réponses existantes pour cette question
		const { data: existingResponses } = await supabase
			.from('responses')
			.select('content')
			.eq('question_id', questionId);

		// 4. Générer une bonne réponse avec l'IA
		const prompt = `Tu es un assistant pour un jeu de quiz. Tu dois générer une bonne réponse crédible et correcte pour la question suivante.

Question : "${question.content}"

${existingResponses && existingResponses.length > 0 
	? `Réponses déjà proposées par les joueurs (pour éviter les doublons) :\n${existingResponses.map((r: any) => `- ${r.content}`).join('\n')}`
	: ''}

Génère une réponse correcte, claire et concise. La réponse doit être crédible et bien formulée.

Réponds UNIQUEMENT avec la réponse, sans texte supplémentaire avant ou après.`;

		const aiResponse = await generateText(prompt);
		const correctAnswer = aiResponse.trim();

		if (!correctAnswer) {
			throw new Error('L\'IA n\'a pas pu générer de réponse');
		}

		// 5. Créer la bonne réponse dans la base de données
		const { data: correctResponse, error: insertError } = await supabase
			.from('responses')
			.insert([{
				question_id: questionId,
				content: correctAnswer,
				player_id: null, // La bonne réponse n'a pas de joueur associé
				is_right: true
			}])
			.select()
			.single();

		if (insertError) {
			console.error('Erreur insertion bonne réponse:', insertError);
			return json({ error: 'Erreur lors de l\'enregistrement de la bonne réponse' }, { status: 500 });
		}

		return json({
			success: true,
			response: correctResponse,
			message: 'Bonne réponse générée avec succès'
		});

	} catch (err) {
		console.error('API Generate Correct Answer Error:', err);
		return json({ error: 'Erreur interne du serveur' }, { status: 500 });
	}
};

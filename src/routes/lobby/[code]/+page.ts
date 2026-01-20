import { error } from '@sveltejs/kit';
import type { PageLoad } from './$types';
import { getRoomByCode } from '$lib/roomService';

export const load: PageLoad = async ({ params }) => {
	const { code } = params;

	try {
		const room = await getRoomByCode(code);
		return {
			room
		};
	} catch (e) {
		console.error(e);
		throw error(404, 'Room not found');
	}
};


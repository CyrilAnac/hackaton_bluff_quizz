<script lang="ts">
	interface Props {
		selected?: 'easy' | 'medium' | 'hard';
		onselect?: (difficulty: 'easy' | 'medium' | 'hard') => void;
	}

	let { selected = $bindable<'easy' | 'medium' | 'hard'>('medium'), onselect }: Props = $props();

	const difficulties = [
		{ id: 'easy' as const, label: 'Facile', color: 'bg-green-500 hover:bg-green-600' },
		{ id: 'medium' as const, label: 'Moyen', color: 'bg-yellow-500 hover:bg-yellow-600' },
		{ id: 'hard' as const, label: 'Difficile', color: 'bg-red-500 hover:bg-red-600' }
	];

	function select(difficulty: 'easy' | 'medium' | 'hard') {
		selected = difficulty;
		onselect?.(difficulty);
	}
</script>

<div class="flex flex-col gap-3 sm:flex-row sm:gap-4">
	{#each difficulties as diff}
		<button
			onclick={() => select(diff.id)}
			class="flex-1 cursor-pointer rounded-xl px-6 py-4 text-lg font-bold text-white shadow-md transition-all active:scale-95 {diff.color} {selected === diff.id
				? 'ring-4 ring-white shadow-lg scale-105'
				: 'opacity-70 hover:opacity-100'}"
		>
			{diff.label}
		</button>
	{/each}
</div>

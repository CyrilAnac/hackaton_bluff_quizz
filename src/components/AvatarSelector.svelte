<script lang="ts">
	interface Props {
		selected?: number;
		onselect?: (index: number) => void;
	}

	let { selected = $bindable(1), onselect }: Props = $props();

	const avatars = ['😀', '😎', '🤠', '🥳', '😺', '🐶'];

	function selectAvatar(index: number) {
		selected = index;
		onselect?.(index);
	}

	function prev() {
		selected = selected > 0 ? selected - 1 : avatars.length - 1;
		onselect?.(selected);
	}

	function next() {
		selected = selected < avatars.length - 1 ? selected + 1 : 0;
		onselect?.(selected);
	}
</script>

<div class="flex flex-col items-center gap-4">
	<div class="flex items-center gap-4">
		<button
			onclick={prev}
			class="flex h-12 w-12 cursor-pointer items-center justify-center rounded-lg bg-white/90 text-warm-dark shadow-md transition-all hover:bg-white hover:shadow-lg active:scale-95"
		>
			<svg
				xmlns="http://www.w3.org/2000/svg"
				viewBox="0 0 24 24"
				fill="none"
				stroke="currentColor"
				stroke-width="3"
				stroke-linecap="round"
				stroke-linejoin="round"
				class="h-6 w-6"
			>
				<polyline points="15 18 9 12 15 6"></polyline>
			</svg>
		</button>

		<div
			class="flex h-20 w-20 items-center justify-center rounded-xl bg-white text-5xl shadow-lg"
		>
			{avatars[selected]}
		</div>

		<button
			onclick={next}
			class="flex h-12 w-12 cursor-pointer items-center justify-center rounded-lg bg-white/90 text-warm-dark shadow-md transition-all hover:bg-white hover:shadow-lg active:scale-95"
		>
			<svg
				xmlns="http://www.w3.org/2000/svg"
				viewBox="0 0 24 24"
				fill="none"
				stroke="currentColor"
				stroke-width="3"
				stroke-linecap="round"
				stroke-linejoin="round"
				class="h-6 w-6"
			>
				<polyline points="9 18 15 12 9 6"></polyline>
			</svg>
		</button>
	</div>

	<div class="mt-2 grid grid-cols-3 gap-2">
		{#each avatars as avatar, index}
			<button
				onclick={() => selectAvatar(index)}
				class="flex h-12 w-12 cursor-pointer items-center justify-center rounded-lg text-2xl transition-all {selected === index
					? 'bg-white shadow-lg ring-4 ring-accent'
					: 'bg-white/70 hover:bg-white/90'}"
			>
				{avatar}
			</button>
		{/each}
	</div>
</div>

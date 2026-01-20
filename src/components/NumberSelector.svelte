<script lang="ts">
	interface Props {
		min?: number;
		max?: number;
		value?: number;
		onchange?: (value: number) => void;
	}

	let { min = 1, max = 15, value = $bindable(5), onchange }: Props = $props();

	function decrement() {
		if (value > min) {
			value--;
			onchange?.(value);
		}
	}

	function increment() {
		if (value < max) {
			value++;
			onchange?.(value);
		}
	}
</script>

<div class="flex items-center justify-center gap-4">
	<button
		onclick={decrement}
		disabled={value <= min}
		class="flex h-14 w-14 cursor-pointer items-center justify-center rounded-xl bg-white/90 text-warm-dark shadow-md transition-all hover:bg-white hover:shadow-lg active:scale-95 disabled:cursor-not-allowed disabled:opacity-50"
	>
		<svg
			xmlns="http://www.w3.org/2000/svg"
			viewBox="0 0 24 24"
			fill="none"
			stroke="currentColor"
			stroke-width="3"
			stroke-linecap="round"
			stroke-linejoin="round"
			class="h-8 w-8"
		>
			<polyline points="15 18 9 12 15 6"></polyline>
		</svg>
	</button>

	<div
		class="flex h-16 min-w-20 items-center justify-center rounded-xl bg-white px-6 text-3xl font-bold text-warm-dark shadow-lg"
	>
		{value}
	</div>

	<button
		onclick={increment}
		disabled={value >= max}
		class="flex h-14 w-14 cursor-pointer items-center justify-center rounded-xl bg-white/90 text-warm-dark shadow-md transition-all hover:bg-white hover:shadow-lg active:scale-95 disabled:cursor-not-allowed disabled:opacity-50"
	>
		<svg
			xmlns="http://www.w3.org/2000/svg"
			viewBox="0 0 24 24"
			fill="none"
			stroke="currentColor"
			stroke-width="3"
			stroke-linecap="round"
			stroke-linejoin="round"
			class="h-8 w-8"
		>
			<polyline points="9 18 15 12 9 6"></polyline>
		</svg>
	</button>
</div>

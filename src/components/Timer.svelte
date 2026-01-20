<script lang="ts">
	import { onMount } from 'svelte';

	interface Props {
		seconds: number;
		onComplete?: () => void;
	}

	let { seconds, onComplete }: Props = $props();

	let remaining = $state(0);
	let interval: ReturnType<typeof setInterval> | null = null;

	onMount(() => {
		remaining = seconds;
		interval = setInterval(() => {
			remaining--;
			if (remaining <= 0) {
				if (interval) clearInterval(interval);
				onComplete?.();
			}
		}, 1000);

		return () => {
			if (interval) clearInterval(interval);
		};
	});
</script>

<div
	class="flex h-16 w-16 items-center justify-center rounded-full border-4 border-dashed border-white/50 text-2xl font-bold text-white"
>
	{remaining}
</div>

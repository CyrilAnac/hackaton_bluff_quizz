<script lang="ts">
	import type { Snippet } from 'svelte';

	interface Props {
		padding?: 'sm' | 'md' | 'lg';
		children: Snippet;
	}

	let { padding = 'lg', children }: Props = $props();

	const paddingClasses = {
		sm: 'p-4',
		md: 'p-6',
		lg: 'p-8'
	};
</script>

<div
	class="rounded-3xl bg-white/10 shadow-2xl backdrop-blur-sm {paddingClasses[padding]}"
>
	{@render children()}
</div>

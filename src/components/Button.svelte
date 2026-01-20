<script lang="ts">
	import type { Snippet } from 'svelte';

	interface Props {
		variant?: 'primary' | 'secondary' | 'outline';
		size?: 'sm' | 'md' | 'lg';
		disabled?: boolean;
		onclick?: () => void;
		children: Snippet;
	}

	let { variant = 'primary', size = 'md', disabled = false, onclick, children }: Props = $props();

	const baseClasses =
		'w-full font-bold rounded-xl transition-all duration-200 cursor-pointer shadow-lg hover:shadow-xl active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed';

	const variantClasses = {
		primary: 'bg-white text-warm-dark hover:bg-gray-100',
		secondary: 'bg-primary text-white hover:bg-primary-dark',
		outline: 'bg-transparent border-3 border-white text-white hover:bg-white/10'
	};

	const sizeClasses = {
		sm: 'px-4 py-2 text-sm',
		md: 'px-8 py-4 text-lg',
		lg: 'px-12 py-5 text-xl'
	};
</script>

<button
	class="{baseClasses} {variantClasses[variant]} {sizeClasses[size]}"
	{disabled}
	{onclick}
>
	{@render children()}
</button>

<script lang="ts">
	interface Props {
		type?: 'text' | 'email' | 'password' | 'number';
		placeholder?: string;
		value?: string;
		label?: string;
		oninput?: (e: Event) => void;
		disabled?: boolean;
	}

	let { type = 'text', placeholder = '', value = $bindable(''), label, disabled = false }: Props = $props();
</script>

<label class="block w-full">
	{#if label}
		<span class="mb-2 block text-lg font-semibold text-white">{label}</span>
	{/if}
	<input
		{type}
		{placeholder}
		bind:value
		{disabled}
		class="w-full rounded-xl border-0 bg-white/95 px-6 py-4 text-lg text-gray-800 shadow-lg ring-2 ring-transparent transition-all duration-200 placeholder:text-gray-400 focus:bg-white focus:ring-4 focus:ring-accent focus:outline-none"
	/>
</label>

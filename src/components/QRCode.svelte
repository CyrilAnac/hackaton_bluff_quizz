<script lang="ts">
	interface Props {
		value: string;
		size?: number;
	}

	let { value, size = 150 }: Props = $props();

	// Generate QR code URL using a free API
	$effect(() => {
		// This uses the QR code API from goqr.me
	});

	const qrUrl = $derived(
		`https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&data=${encodeURIComponent(value)}`
	);
</script>

<div class="rounded-xl bg-white p-2 shadow-lg">
	<img
		src={qrUrl}
		alt="QR Code for {value}"
		width={size}
		height={size}
		class="block"
	/>
</div>

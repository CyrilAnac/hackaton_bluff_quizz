<script lang="ts">
	interface Player {
		name: string;
		avatar: string;
		isHost?: boolean;
	}

	interface Props {
		players: Player[];
	}

	let { players }: Props = $props();
</script>

<div class="w-full">
	<h2 class="mb-4 text-xl font-bold text-white">
		Joueurs ({players.length})
	</h2>
	<div class="grid grid-cols-2 gap-3">
		{#each players as player}
			<div
				class="flex items-center gap-3 rounded-xl bg-white/20 px-4 py-3 backdrop-blur-sm {player.isHost
					? 'ring-2 ring-accent'
					: ''}"
			>
				<span class="text-2xl">{player.avatar}</span>
				<span class="truncate font-medium text-white">
					{player.name}
					{#if player.isHost}
						<span class="ml-1 text-xs text-accent">(Hôte)</span>
					{/if}
				</span>
			</div>
		{/each}
	</div>
</div>

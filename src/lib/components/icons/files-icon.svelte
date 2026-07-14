<script lang="ts">
	let { size = 16, color = '#888' }: { size?: number; color?: string } = $props();
</script>

<svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
	<path d="M4 4h6l2 2h8a1 1 0 0 1 1 1v11a2 2 0 0 1-2 2H5a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1Z" />
	<path d="M4 9h16" />
</svg>

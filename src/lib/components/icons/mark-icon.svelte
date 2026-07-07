<script lang="ts">
	let { size = 16, color = '#888' }: { size?: number; color?: string } = $props();
</script>

<svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
	<path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z" />
	<path d="M14 2v6h6" />
	<path d="M9 13h6" />
	<path d="M9 17h6" />
</svg>

<script lang="ts">
	let { size = 24, color = "currentColor", strokeWidth = 1, class: className = "" } = $props();
</script>

<svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} stroke-width={strokeWidth} stroke-linecap="round" stroke-linejoin="round" class={className}>
	<path stroke="none" d="M0 0h24v24H0z" fill="none" />
	<line x1="18" y1="6" x2="6" y2="18" />
	<line x1="6" y1="6" x2="18" y2="18" />
</svg>

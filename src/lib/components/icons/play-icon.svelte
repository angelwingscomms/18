<script lang="ts">
	let { size = 16, color = "currentColor", strokeWidth = 1.5, class: className = "" } = $props();
	let hovering = $state(false);
</script>

<svg
	role="img"
	aria-label="Play"
	onmouseenter={() => hovering = true}
	onmouseleave={() => hovering = false}
	xmlns="http://www.w3.org/2000/svg"
	width={size}
	height={size}
	viewBox="0 0 24 24"
	fill="none"
	stroke={color}
	stroke-width={strokeWidth}
	stroke-linecap="round"
	stroke-linejoin="round"
	class={className}
>
	<path stroke="none" d="M0 0h24v24H0z" fill="none" />
	<polygon points="5 4 5 20 15 12 5 4" />
</svg>
<script lang="ts">
	let { size = 24, color = "currentColor", strokeWidth = 1, class: className = "" } = $props();
	let hovering = $state(false);
</script>

<svg
	role="img"
	aria-label="Speaker"
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
	<g style="transform-origin: center; transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1); transform: {hovering ? 'scale(1.1)' : 'scale(1)'}">
		<path d="M11 5L6 9H2v6h4l5 4V5z" />
		<path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
		<path d="M19.07 4.93a10 10 0 0 1 0 14.14" />
	</g>
</svg>

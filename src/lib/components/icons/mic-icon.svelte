<script lang="ts">
	let { size = 24, color = "currentColor", strokeWidth = 1, class: className = "" } = $props();
	let hovering = $state(false);
</script>

<svg
	role="img"
	aria-label="Mic"
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
		<rect x="9" y="2" width="6" height="11" rx="3" />
		<path d="M5 10a7 7 0 0 0 14 0" />
		<path d="M8 21h8" />
		<path d="M12 17v4" />
	</g>
</svg>

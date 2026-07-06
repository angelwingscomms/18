<script lang="ts">
	import favicon from '$lib/assets/favicon.svg';

	let { children } = $props();
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
</svelte:head>

{@render children()}

<style>
	:global(*) { margin: 0; padding: 0; box-sizing: border-box; }
	:global(body) {
		font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
		background: #0a0a0a;
		color: #ccc;
		-webkit-font-smoothing: antialiased;
		-moz-osx-font-smoothing: grayscale;
	}
	:global(::-webkit-scrollbar) { width: 6px; }
	:global(::-webkit-scrollbar-track) { background: transparent; }
	:global(::-webkit-scrollbar-thumb) { background: #333; border-radius: 3px; }
	:global(::-webkit-scrollbar-thumb:hover) { background: #555; }
</style>

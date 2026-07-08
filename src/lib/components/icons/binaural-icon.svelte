<script lang="ts">
  let { size = 24, color = "currentColor", strokeWidth = 1, class: className = "", playing = false } = $props();
</script>
<svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24"
     fill="none" stroke={color} stroke-width={strokeWidth}
     stroke-linecap="round" stroke-linejoin="round" class={className}>
  <path stroke="none" d="M0 0h24v24H0z" fill="none" />
  <!-- head outline -->
  <path d="M8 6c0-1.5 1.5-4 4-4s4 2.5 4 4" />
  <path d="M5 14c-1 1.5-1 4 0 5.5" />
  <path d="M19 14c1 1.5 1 4 0 5.5" />
  <path d="M6 19.5c1.5 1 4.5 1.5 6 1.5s4.5-.5 6-1.5" />
  <!-- brain waves -->
  <path d="M9 11c.5 1 1.5 1 2 0" opacity={playing ? 1 : 0.3} />
  <path d="M13 11c.5 1 1.5 1 2 0" opacity={playing ? 1 : 0.3} />
  <path d="M7 9c1 1.5 3 1.5 4 0" opacity={playing ? 1 : 0.3} />
  <path d="M13 9c1 1.5 3 1.5 4 0" opacity={playing ? 1 : 0.3} />
</svg>

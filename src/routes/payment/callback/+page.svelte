<script lang="ts">
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  let { data } = $props();
  let countdown = $state(10);

  onMount(() => {
    const t = setInterval(() => {
      countdown--;
      if (countdown <= 0) { clearInterval(t); goto('/', { replaceState: true }); }
    }, 1000);
  });
</script>

<div class="page">
  <div class="card">
    {#if data.success}
      <div class="icon success">
        <svg class="check" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M4.5 12.75l6 6 9-13.5"/></svg>
      </div>
      <h1>Payment Successful</h1>
      <p class="amount">₦{(data.balance / 100).toFixed(2)} added to your account.</p>
      <p class="bal">New balance: ₦{(data.balance / 100).toFixed(2)}</p>
    {:else}
      <div class="icon fail">
        <svg class="x" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12"/></svg>
      </div>
      <h1>Payment {data.message}</h1>
      <p class="bal">{data.message}</p>
    {/if}
    <p class="redirect">Redirecting in {countdown}s...</p>
  </div>
</div>

<style>
  .page { position: fixed; inset: 0; display: grid; place-items: center; background: #0a0a0a; padding: 1rem; }
  .card { max-width: 20rem; text-align: center; }
  .icon { margin: 0 auto 1rem; width: 4rem; height: 4rem; border-radius: 50%; display: grid; place-items: center; }
  .icon.success { background: rgba(74, 222, 128, 0.1); }
  .icon.fail { background: rgba(255, 68, 68, 0.1); }
  .check { width: 2rem; height: 2rem; color: #4ade80; }
  .x { width: 2rem; height: 2rem; color: #f44; }
  h1 { font-size: 1.25rem; font-weight: 500; color: #eee; margin-bottom: 0.5rem; }
  .amount { font-size: 0.875rem; color: #aaa; }
  .bal { font-size: 0.75rem; color: #666; margin-top: 0.25rem; }
  .redirect { font-size: 0.75rem; color: #444; margin-top: 1rem; }
</style>

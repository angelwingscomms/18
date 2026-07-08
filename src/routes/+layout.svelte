<script lang="ts">
  import favicon from '$lib/assets/favicon.svg';
  import { browser } from '$app/environment';
  import type { LayoutProps } from './$types';
  let { data, children }: LayoutProps = $props();
  let user = $state<{ id: string; name: string; picture?: string; email?: string } | null>(data.user);
  let token_balance = $state(data.balance);
  let date_joined = $state(data.date_joined);
  let open = $state(false);
  let img_err = $state(false);
  let show_profile = $state(false);
  let buy_input = $state('');
  let buy_loading = $state(false);
  let wrap: HTMLDivElement | undefined = $state();
  const MIN_KOBO = 10_000;

  $effect(() => {
    if (!browser) return;
    function handler(e: Event) { token_balance = (e as CustomEvent).detail; user = data.user; }
    window.addEventListener('balance-update', handler);
    return () => window.removeEventListener('balance-update', handler);
  });

  $effect(() => {
    if (!open) return;
    function listener(e: MouseEvent) {
      if (wrap && !wrap.contains(e.target as Node)) open = false;
    }
    window.addEventListener('click', listener);
    return () => window.removeEventListener('click', listener);
  });

  function toggle() { open = !open; }

  async function deposit(amount_kobo: number) {
    buy_loading = true;
    let auth_url = '';
    try {
      const r = await fetch('/api/buy-tokens', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount_kobo })
      });
      const d = await r.json();
      if (!d.access_code) {
        alert(d.error || 'Failed to initialize payment');
        buy_loading = false;
        return;
      }
      auth_url = d.authorization_url;
      const PaystackPop = (await import('@paystack/inline-js')).default;
      const popup = new PaystackPop();
      const fb = setTimeout(() => { window.location.href = auth_url; }, 15000);
      popup.resumeTransaction(d.access_code, {
        onLoad: () => clearTimeout(fb),
        onSuccess: (tx: { reference: string }) => {
          clearTimeout(fb);
          fetch('/api/verify-payment', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ reference: tx.reference }) })
            .then(r => r.json()).then(d => {
              if (d.success) { token_balance = d.balance; window.dispatchEvent(new CustomEvent('balance-update', { detail: d.balance })); }
              else fetch('/api/balance').then(r => r.json()).then(d => { token_balance = d.balance; window.dispatchEvent(new CustomEvent('balance-update', { detail: d.balance })); }).catch(() => {});
            })
            .catch(() => fetch('/api/balance').then(r => r.json()).then(d => { token_balance = d.balance; window.dispatchEvent(new CustomEvent('balance-update', { detail: d.balance })); }).catch(() => {}));
          buy_loading = false;
        },
        onCancel: () => { clearTimeout(fb); buy_loading = false; },
        onError: () => { clearTimeout(fb); window.location.href = auth_url; },
      });
    } catch {
      if (auth_url) window.location.href = auth_url;
      else { alert('Network error'); buy_loading = false; }
    }
  }

  async function logout() {
    await fetch('/logout', { method: 'POST' });
    user = null;
    open = false;
  }
</script>

<svelte:head>
  <link rel="icon" href={favicon} />
</svelte:head>

<nav class="top-nav">
  <div class="nav-inner">
    <div></div>
    <div class="nav-end">
      {#if user}
        <div class="user-menu-wrap" bind:this={wrap}>
          <button onclick={toggle} class="user-btn" aria-label="User menu">
            {#if user.picture && !img_err}
              <img src={user.picture} alt={user.name} class="user-avatar" onerror={() => img_err = true} />
            {:else}
              <span class="user-fallback">{(user.name || '')[0] || 'u'}</span>
            {/if}
          </button>
          {#if open}
            <div class="user-menu" role="menu">
              <button onclick={() => { show_profile = true; open = false; }} class="menu-btn">Profile</button>
              <button onclick={logout} class="menu-btn">Logout</button>
            </div>
          {/if}
        </div>
      {:else}
        <a href="/login/google" class="login-btn">Login</a>
      {/if}
    </div>
  </div>
</nav>

{#if show_profile}
  <div class="overlay" role="presentation" onkeydown={(e) => e.key === 'Escape' && (show_profile = false)} onclick={() => show_profile = false}>
    <div class="modal" role="dialog" aria-modal="true" onclick={(e) => e.stopPropagation()}>
      <div class="modal-header">
        <h2>Profile</h2>
      </div>
      <div class="modal-body">
        <div class="info-card">
          {#if user?.email}
            <div class="info-row">
              <span class="info-label">Email</span>
              <span class="info-value">{user.email}</span>
            </div>
          {/if}
          {#if date_joined}
            <div class="info-row">
              <span class="info-label">Joined</span>
              <span class="info-value">{new Date(date_joined).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })}</span>
            </div>
          {/if}
          <div class="info-row">
            <span class="info-label">Balance</span>
            <span class="info-value">₦{(token_balance / 100).toFixed(2)}</span>
          </div>
        </div>
        <div class="deposit-section">
          <p class="deposit-label">Deposit</p>
          <div class="input-wrap">
            <span class="currency">₦</span>
            <input type="number" min={MIN_KOBO / 100} bind:value={buy_input} placeholder="100" class="deposit-input" />
          </div>
          <p class="min-note">Min: ₦100</p>
          <button class="deposit-btn {buy_loading || !buy_input || parseInt(buy_input) <= 0 ? 'disabled' : ''}" onclick={() => deposit(parseInt(buy_input) * 100 || MIN_KOBO)} disabled={buy_loading || !buy_input || parseInt(buy_input) <= 0}>
            {buy_loading ? 'Processing…' : `Deposit ₦${(parseInt(buy_input) * 100 || MIN_KOBO) / 100}`}
          </button>
        </div>
      </div>
      <div class="modal-footer">
        <button class="close-btn" onclick={() => show_profile = false}>Close</button>
      </div>
    </div>
  </div>
{/if}

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

  .top-nav {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    z-index: 50;
    padding: 0.75rem 1rem;
  }
  .nav-inner {
    max-width: 80rem;
    margin: 0 auto;
    display: flex;
    align-items: center;
    justify-content: space-between;
  }
  .nav-end { display: flex; align-items: center; gap: 0.75rem; }

  .login-btn {
    color: #aaa;
    text-decoration: none;
    font-size: 0.8125rem;
    padding: 0.375rem 0.875rem;
    border-radius: 8px;
    border: 1px solid rgba(255,255,255,0.1);
    transition: all 0.2s;
  }
  .login-btn:hover { border-color: rgba(255,255,255,0.2); color: #eee; }

  .user-menu-wrap { position: relative; }
  .user-btn {
    width: 32px; height: 32px;
    border-radius: 50%;
    border: 1px solid rgba(255,255,255,0.1);
    background: rgba(255,255,255,0.05);
    cursor: pointer;
    display: grid;
    place-items: center;
    overflow: hidden;
    padding: 0;
  }
  .user-avatar { width: 100%; height: 100%; object-fit: cover; }
  .user-fallback { font-size: 12px; font-weight: 600; color: #ccc; }
  .user-menu {
    position: absolute;
    right: 0;
    top: calc(100% + 6px);
    width: 180px;
    border-radius: 10px;
    border: 1px solid rgba(255,255,255,0.08);
    background: #141414;
    padding: 0.5rem;
    display: grid;
    gap: 0.25rem;
    z-index: 70;
  }
  .menu-btn {
    width: 100%;
    padding: 0.5rem 0.75rem;
    text-align: left;
    background: none;
    border: none;
    color: #aaa;
    font-size: 0.8125rem;
    border-radius: 6px;
    cursor: pointer;
    transition: all 0.15s;
  }
  .menu-btn:hover { background: rgba(255,255,255,0.05); color: #eee; }

  .overlay {
    position: fixed;
    inset: 0;
    z-index: 60;
    display: grid;
    place-items: center;
    background: rgba(0,0,0,0.7);
    backdrop-filter: blur(16px);
    padding: 1rem;
  }
  .modal {
    max-height: calc(100dvh - 2rem);
    width: 100%;
    max-width: 26rem;
    border-radius: 16px;
    border: 1px solid rgba(255,255,255,0.08);
    background: #141414;
    color: #ccc;
    display: flex;
    flex-direction: column;
  }
  .modal-header {
    flex-shrink: 0;
    border-bottom: 1px solid rgba(255,255,255,0.05);
    padding: 1.25rem 1.5rem;
  }
  .modal-header h2 { font-size: 1.15rem; font-weight: 500; color: #eee; margin: 0; }
  .modal-body {
    display: grid;
    gap: 1rem;
    overflow-y: auto;
    padding: 1.5rem;
  }
  .modal-footer {
    flex-shrink: 0;
    display: flex;
    justify-content: flex-end;
    border-top: 1px solid rgba(255,255,255,0.05);
    padding: 1rem 1.5rem;
  }

  .info-card {
    border-radius: 10px;
    background: rgba(255,255,255,0.03);
    padding: 1rem;
    display: grid;
    gap: 0.75rem;
  }
  .info-row { display: flex; justify-content: space-between; align-items: center; font-size: 0.8125rem; }
  .info-label { color: #666; }
  .info-value { color: #ccc; font-weight: 500; }

  .deposit-section { }
  .deposit-label { font-size: 0.7rem; font-weight: 500; text-transform: uppercase; letter-spacing: 0.12em; color: #4a9eff; margin-bottom: 0.75rem; }
  .input-wrap { position: relative; }
  .currency { position: absolute; left: 0.75rem; top: 50%; transform: translateY(-50%); font-size: 0.875rem; color: #666; }
  .deposit-input {
    width: 100%;
    padding: 0.625rem 0.75rem 0.625rem 1.75rem;
    border-radius: 10px;
    border: 1px solid rgba(255,255,255,0.06);
    background: rgba(0,0,0,0.3);
    color: #ddd;
    font-size: 0.875rem;
    outline: none;
    box-sizing: border-box;
  }
  .deposit-input:focus { border-color: rgba(74,158,255,0.4); }
  .deposit-input::placeholder { color: #555; }
  .min-note { font-size: 0.7rem; color: #555; margin-top: 0.375rem; }
  .deposit-btn {
    width: 100%;
    margin-top: 0.75rem;
    padding: 0.625rem 1rem;
    border: none;
    background: #4a9eff;
    color: #fff;
    border-radius: 10px;
    font-size: 0.875rem;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.15s;
  }
  .deposit-btn:hover { background: #3a8eef; }
  .deposit-btn.disabled { opacity: 0.4; pointer-events: none; }

  .close-btn {
    border: 1px solid rgba(255,255,255,0.08);
    background: transparent;
    color: #aaa;
    padding: 0.5rem 1rem;
    border-radius: 8px;
    font-size: 0.8125rem;
    cursor: pointer;
    transition: all 0.15s;
  }
  .close-btn:hover { background: rgba(255,255,255,0.04); border-color: rgba(255,255,255,0.15); }
</style>

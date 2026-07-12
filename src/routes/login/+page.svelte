<script lang="ts">
  import { browser } from '$app/environment';
  import { goto } from '$app/navigation';
  import { page } from '$app/stores';

  let { data } = $props();

  let em = $state(data.email || '');
  let pw = $state('');
  let eme = $state('');
  let pwe = $state('');
  let apiError = $state('');
  let isProcessing = $state(false);

  let next = $derived(data.next || '/');

  let allValid = $derived(
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(em.trim()) && pw.length >= 8
  );

  function validate(): boolean {
    eme = ''; pwe = ''; apiError = '';
    let v = true;
    if (!em.trim()) { eme = 'Required'; v = false; }
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(em.trim())) { eme = 'Invalid email'; v = false; }
    if (!pw) { pwe = 'Required'; v = false; }
    return v;
  }

  async function handleSubmit(e: Event) {
    e.preventDefault();
    if (!validate() || isProcessing) return;
    isProcessing = true;
    try {
      const r = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: em.trim(), password: pw })
      });
      const d: Record<string, unknown> = await r.json();
      if (!r.ok) {
        apiError = (d.error as string) || 'Login failed';
        isProcessing = false;
        return;
      }
      goto(next);
    } catch {
      apiError = 'Network error. Please try again.';
      isProcessing = false;
    }
  }
</script>

<svelte:head>
  <title>Login</title>
</svelte:head>

<div class="shell">
  <div class="card">
    <h1 class="title">Welcome back</h1>
    <p class="sub">Sign in to your account</p>

    <form onsubmit={handleSubmit} novalidate>
      <div class="field">
        <label for="em" class="label">Email</label>
        <input id="em" type="email" bind:value={em} class="input" class:error={eme} oninput={() => eme = ''} placeholder="your@email.com" />
        {#if eme}<span class="err">{eme}</span>{/if}
      </div>
      <div class="field">
        <label for="pw" class="label">Password</label>
        <input id="pw" type="password" bind:value={pw} class="input" class:error={pwe} oninput={() => pwe = ''} placeholder="Min 8 characters" />
        {#if pwe}<span class="err">{pwe}</span>{/if}
      </div>

      {#if apiError}
        <div class="api-error" role="alert">{apiError}</div>
      {/if}

      <button class="btn" disabled={!allValid || isProcessing}>
        {isProcessing ? 'Signing in…' : 'Sign In'}
      </button>
    </form>

    <div class="divider"><span>or</span></div>

    <a href="/login/google?next={encodeURIComponent(next)}" class="google-btn">
      <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/></svg>
      Sign in with Google
    </a>
  </div>
</div>

<style>
  .shell {
    min-height: 100vh;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 2rem;
    background: #0a0a0a;
  }
  .card {
    width: 100%;
    max-width: 400px;
    border-radius: 16px;
    padding: 2.5rem 2rem;
    border: 1px solid rgba(255,255,255,0.08);
    background: #141414;
  }
  .title {
    font-size: 1.6rem;
    font-weight: 600;
    margin: 0 0 4px;
    color: #eee;
  }
  .sub {
    font-size: 14px;
    color: #666;
    margin: 0 0 24px;
  }
  form {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }
  .field {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }
  .label {
    font-size: 0.75rem;
    font-weight: 500;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    color: #888;
  }
  .input {
    padding: 10px 14px;
    border-radius: 10px;
    border: 1px solid rgba(255,255,255,0.06);
    background: rgba(0,0,0,0.3);
    color: #ddd;
    font-size: 0.875rem;
    outline: none;
    transition: border-color 0.15s;
  }
  .input:focus { border-color: rgba(74,158,255,0.4); }
  .input::placeholder { color: #555; }
  .input.error { border-color: rgba(255,70,60,0.5); }
  .err { font-size: 0.75rem; color: #ff463c; }
  .api-error {
    padding: 10px 14px;
    border-radius: 8px;
    background: rgba(255,55,45,0.08);
    color: #ff463c;
    font-size: 13px;
    line-height: 1.4;
  }
  .btn {
    width: 100%;
    padding: 12px 24px;
    border: none;
    border-radius: 10px;
    background: #eee;
    color: #0a0a0a;
    font-size: 15px;
    font-weight: 600;
    cursor: pointer;
    transition: opacity 0.2s;
  }
  .btn:disabled {
    background: rgba(255,255,255,0.05);
    color: #555;
    cursor: not-allowed;
  }
  .btn:not(:disabled):hover { opacity: 0.85; }
  .divider {
    display: flex;
    align-items: center;
    gap: 12px;
    margin: 20px 0;
    color: #555;
    font-size: 13px;
  }
  .divider::before,
  .divider::after {
    content: '';
    flex: 1;
    height: 1px;
    background: rgba(255,255,255,0.06);
  }
  .google-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 10px;
    width: 100%;
    padding: 12px 24px;
    border: 1px solid rgba(255,255,255,0.1);
    border-radius: 10px;
    background: transparent;
    color: #ccc;
    font-size: 14px;
    font-weight: 500;
    text-decoration: none;
    transition: background 0.2s;
  }
  .google-btn:hover { background: rgba(255,255,255,0.04); }
</style>

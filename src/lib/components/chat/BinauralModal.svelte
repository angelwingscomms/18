<script lang="ts">
  import { get_voice_state } from '$lib/voice/voice-state.svelte.ts';

  const v = get_voice_state();
</script>

{#if v.show_binaural_settings}
  <div class="overlay" role="presentation" onclick={() => v.show_binaural_settings = false}>
    <div class="modal" role="dialog" aria-modal="true" onclick={(e) => e.stopPropagation()} onkeydown={(e) => e.key === 'Escape' && (v.show_binaural_settings = false)}>
      <div class="modal-header">
        <span class="modal-label">Binaural Beats</span>
        <h2 class="modal-title">Entrainment</h2>
      </div>
      <div class="modal-body">
        <section class="setting-section">
          <h3 class="setting-label">Volume</h3>
          <span class="toggle-desc" style="margin-top:-4px">432 Hz left ear / 439 Hz right ear (7 Hz delta)</span>
          <div class="slider-row">
            <span class="slider-label">0%</span>
            <input
              type="range"
              class="volume-slider"
              bind:value={v.binaural_volume}
              min="0"
              max="1"
              step="0.01"
            />
            <span class="slider-label">100%</span>
          </div>
        </section>
      </div>
      <div class="modal-footer">
        <button class="btn-secondary" onclick={() => v.show_binaural_settings = false}>Close</button>
      </div>
    </div>
  </div>
{/if}

<style>
  .overlay {
    position: fixed;
    inset: 0;
    z-index: 60;
    display: grid;
    place-items: center;
    overflow-y: auto;
    background: rgba(0,0,0,0.7);
    backdrop-filter: blur(16px);
    padding: 1rem;
    animation: fade-in 0.2s ease;
  }

  @keyframes fade-in {
    from { opacity: 0; }
    to { opacity: 1; }
  }

  .modal {
    display: flex;
    flex-direction: column;
    max-height: calc(100dvh - 2rem);
    width: 100%;
    max-width: 28rem;
    border-radius: 20px;
    border: 1px solid rgba(255,255,255,0.08);
    background: #141414;
    color: #ccc;
    box-shadow: 0 32px 80px rgba(0,0,0,0.5);
  }

  .modal-header {
    flex-shrink: 0;
    border-bottom: 1px solid rgba(255,255,255,0.05);
    padding: 1.25rem 1.5rem;
  }

  .modal-label {
    display: block;
    margin-bottom: 0.25rem;
    font-size: 0.7rem;
    font-weight: 500;
    text-transform: uppercase;
    letter-spacing: 0.15em;
    color: #666;
  }

  .modal-title {
    font-size: 1.35rem;
    font-weight: 500;
    color: #eee;
    margin: 0;
  }

  .modal-body {
    display: grid;
    gap: 0.75rem;
    overflow-y: auto;
    padding: 1.5rem;
  }

  .modal-footer {
    flex-shrink: 0;
    display: flex;
    justify-content: flex-end;
    gap: 0.75rem;
    border-top: 1px solid rgba(255,255,255,0.05);
    padding: 1rem 1.5rem;
  }

  .setting-section {
    display: grid;
    gap: 0.5rem;
    background: rgba(255,255,255,0.03);
    border-radius: 12px;
    padding: 1rem;
  }

  .setting-label {
    margin: 0;
    font-size: 0.8125rem;
    font-weight: 500;
    color: #aaa;
  }

  .toggle-desc {
    display: block;
    margin-top: 0.25rem;
    font-size: 0.75rem;
    color: #666;
  }

  .slider-row {
    display: flex;
    align-items: center;
    gap: 0.75rem;
  }

  .slider-label {
    font-size: 0.75rem;
    color: #666;
    min-width: 2.5rem;
    text-align: center;
  }

  .volume-slider {
    flex: 1;
    appearance: none;
    height: 4px;
    border-radius: 2px;
    background: rgba(255,255,255,0.1);
    outline: none;
    cursor: pointer;
  }

  .volume-slider::-webkit-slider-thumb {
    appearance: none;
    width: 16px;
    height: 16px;
    border-radius: 50%;
    background: #4a9eff;
    border: none;
    cursor: pointer;
  }

  .volume-slider::-moz-range-thumb {
    width: 16px;
    height: 16px;
    border-radius: 50%;
    background: #4a9eff;
    border: none;
    cursor: pointer;
  }

  .btn-secondary {
    padding: 0.625rem 1.25rem;
    border-radius: 10px;
    border: 1px solid rgba(255,255,255,0.08);
    background: transparent;
    color: #ccc;
    font-size: 0.875rem;
    cursor: pointer;
    transition: all 0.15s;
  }

  .btn-secondary:hover {
    background: rgba(255,255,255,0.05);
    border-color: rgba(255,255,255,0.12);
  }
</style>

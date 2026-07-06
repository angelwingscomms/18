<script lang="ts">
	import { model_options, voice_options } from '$lib/voice/types';
	import { get_voice_state } from '$lib/voice/voice-state.svelte.ts';

	const v = get_voice_state();
</script>

{#if v.show_settings}
	<div class="overlay" role="presentation" onclick={() => v.show_settings = false}>
		<div class="modal" role="dialog" aria-modal="true" onclick={(e) => e.stopPropagation()} onkeydown={(e) => e.key === 'Escape' && (v.show_settings = false)}>
			<div class="modal-header">
				<span class="modal-label">Preferences</span>
				<h2 class="modal-title">Settings</h2>
			</div>
			<div class="modal-body">
				<section class="setting-section">
					<h3 class="setting-label">Model</h3>
					<button
						type="button"
						class="select-btn"
						role="combobox"
						aria-expanded={v.show_model_menu}
						onclick={() => v.show_model_menu = !v.show_model_menu}
					>
						<span>
							<span class="select-value">{model_options.find((o) => o.v === v.model)?.l ?? v.model}</span>
							<span class="select-desc">{model_options.find((o) => o.v === v.model)?.d ?? ''}</span>
						</span>
						<span class="select-arrow">⌄</span>
					</button>
					{#if v.show_model_menu}
						<div class="voice-list" role="listbox">
							{#each model_options as option (option.v)}
								<button
									type="button"
									class="voice-option {option.v === v.model ? 'selected' : ''}"
									role="option"
									aria-selected={option.v === v.model}
									onclick={() => { v.model = option.v; v.show_model_menu = false; }}
								>
									<span class="option-name">{option.l}</span>
									<span class="option-desc">{option.d}</span>
								</button>
							{/each}
						</div>
					{/if}
				</section>

				<section class="setting-section">
					<h3 class="setting-label">Gemini Live voice</h3>
					<button
						type="button"
						class="select-btn"
						role="combobox"
						aria-expanded={v.show_voice_menu}
						onclick={() => v.show_voice_menu = !v.show_voice_menu}
					>
						<span>
							<span class="select-value">{voice_options.find((o) => o.v === v.voice_name)?.l ?? v.voice_name}</span>
							<span class="select-desc">{voice_options.find((o) => o.v === v.voice_name)?.d ?? ''}</span>
						</span>
						<span class="select-arrow">⌄</span>
					</button>
					{#if v.show_voice_menu}
						<div class="voice-list" role="listbox">
							{#each voice_options as option (option.v)}
								<button
									type="button"
									class="voice-option {option.v === v.voice_name ? 'selected' : ''}"
									role="option"
									aria-selected={option.v === v.voice_name}
									onclick={() => { v.voice_name = option.v; v.show_voice_menu = false; }}
								>
									<span class="option-name">{option.l}</span>
									<span class="option-desc">{option.d}</span>
								</button>
							{/each}
						</div>
					{/if}
				</section>

				<section class="toggle-section">
					<label class="toggle-row">
						<span>
							<span class="toggle-label">Quiet voice</span>
							<span class="toggle-desc">Only speak when spoken to.</span>
						</span>
						<input type="checkbox" bind:checked={v.quiet} class="toggle-input" />
						<span class="toggle-switch {v.quiet ? 'on' : ''}"></span>
					</label>
				</section>

			<section class="toggle-section">
				<label class="toggle-row">
					<span>
						<span class="toggle-label">Noise suppression</span>
						<span class="toggle-desc">Filter background noise with RNNoise WASM.</span>
					</span>
					<input type="checkbox" bind:checked={v.noise_suppression} class="toggle-input" />
					<span class="toggle-switch {v.noise_suppression ? 'on' : ''}"></span>
				</label>
			</section>
			</div>
			<div class="modal-footer">
				<button class="btn-secondary" onclick={() => v.show_settings = false}>Cancel</button>
				<button class="btn-primary" onclick={() => v.show_settings = false}>Done</button>
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
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 0.75rem;
		border-top: 1px solid rgba(255,255,255,0.05);
		padding: 1rem 1.5rem;
	}

	.setting-section {
		position: relative;
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

	.select-btn {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 0.75rem;
		min-height: 40px;
		width: 100%;
		border-radius: 10px;
		border: 1px solid rgba(255,255,255,0.06);
		background: rgba(0,0,0,0.3);
		padding: 0.625rem 0.875rem;
		text-align: left;
		color: #ddd;
		font-size: 0.875rem;
		cursor: pointer;
		outline: none;
		transition: border-color 0.2s;
	}

	.select-btn:focus {
		border-color: rgba(74, 158, 255, 0.4);
	}

	.select-value {
		display: block;
		font-weight: 500;
	}

	.select-desc {
		display: block;
		margin-top: 0.125rem;
		font-size: 0.7rem;
		color: #666;
	}

	.select-arrow {
		color: #4a9eff;
		font-size: 0.875rem;
	}

	.voice-list {
		position: absolute;
		left: 1rem;
		right: 1rem;
		top: calc(100% - 6px);
		z-index: 10;
		max-height: 15rem;
		overflow-y: auto;
		border-radius: 12px;
		border: 1px solid rgba(255,255,255,0.08);
		background: #181818;
		box-shadow: 0 20px 60px rgba(0,0,0,0.4);
	}

	.voice-option {
		display: grid;
		width: 100%;
		gap: 0.125rem;
		padding: 0.625rem 0.875rem;
		text-align: left;
		background: none;
		border: none;
		cursor: pointer;
		color: #666;
		font-size: 0.875rem;
		transition: all 0.15s;
	}

	.voice-option:hover {
		background: rgba(255,255,255,0.04);
		color: #ccc;
	}

	.voice-option.selected {
		background: rgba(74, 158, 255, 0.08);
		color: #ddd;
	}

	.option-name {
		font-weight: 500;
	}

	.option-desc {
		font-size: 0.7rem;
		color: #666;
	}

	.toggle-section {
		border-radius: 12px;
		border: 1px solid rgba(255,255,255,0.04);
		background: rgba(0,0,0,0.2);
		padding: 1rem;
	}

	.toggle-row {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 1rem;
		cursor: pointer;
		position: relative;
	}

	.toggle-label {
		display: block;
		font-size: 0.875rem;
		font-weight: 500;
		color: #ccc;
	}

	.toggle-desc {
		display: block;
		margin-top: 0.25rem;
		font-size: 0.75rem;
		line-height: 1.4;
		color: #555;
	}

	.toggle-input {
		position: absolute;
		right: 0;
		top: 50%;
		transform: translateY(-50%);
		opacity: 0;
		width: 0;
		height: 0;
	}

	.toggle-switch {
		width: 40px;
		height: 22px;
		border-radius: 11px;
		background: #2a2a2a;
		position: relative;
		transition: background 0.25s cubic-bezier(0.4, 0, 0.2, 1);
		flex-shrink: 0;
	}

	.toggle-switch::after {
		content: '';
		position: absolute;
		top: 3px;
		left: 3px;
		width: 16px;
		height: 16px;
		border-radius: 50%;
		background: #555;
		transition: transform 0.25s cubic-bezier(0.4, 0, 0.2, 1), background 0.25s;
	}

	.toggle-switch.on {
		background: rgba(74, 158, 255, 0.3);
	}

	.toggle-switch.on::after {
		transform: translateX(18px);
		background: #4a9eff;
	}

	.btn-primary {
		border: none;
		background: #4a9eff;
		color: #fff;
		padding: 0.625rem 1rem;
		border-radius: 10px;
		font-size: 0.875rem;
		font-weight: 500;
		cursor: pointer;
		transition: all 0.15s;
	}

	.btn-primary:hover {
		background: #3a8eef;
	}

	.btn-secondary {
		border: 1px solid rgba(255,255,255,0.08);
		background: transparent;
		color: #aaa;
		padding: 0.625rem 1rem;
		border-radius: 10px;
		font-size: 0.875rem;
		cursor: pointer;
		transition: all 0.15s;
	}

	.btn-secondary:hover {
		background: rgba(255,255,255,0.04);
		border-color: rgba(255,255,255,0.15);
	}
</style>

<script lang="ts">
	import { browser } from '$app/environment';
	import { VoiceState, set_voice_state } from '$lib/voice/voice-state.svelte.ts';
	import MicIcon from '$lib/components/icons/mic-icon.svelte';
	import MicMuteIcon from '$lib/components/icons/mic-mute-icon.svelte';
	import SpeakerIcon from '$lib/components/icons/speaker-icon.svelte';
	import SpeakerOffIcon from '$lib/components/icons/speaker-off-icon.svelte';
	import XIcon from '$lib/components/icons/x-icon.svelte';
	import ChatPanel from '$lib/components/chat/ChatPanel.svelte';
	import NotePanel from '$lib/components/chat/NotePanel.svelte';
	import SettingsModal from '$lib/components/chat/SettingsModal.svelte';

	let voice: VoiceState | undefined = $state();
	if (browser) {
		voice = new VoiceState();
		set_voice_state(voice);
	}

	let recording = $derived(voice?.recording ?? false);
	let voice_muted = $derived(voice?.voice_muted ?? false);
	let audio_muted = $derived(voice?.audio_muted ?? false);
	let toasts = $derived(voice?.toasts ?? []);
	let confirming_clear = $state(false);

	function handle_clear() {
		if (!voice) return;
		if (voice.chat_messages.length === 0) return;
		if (confirming_clear) {
			voice.clearChat();
			confirming_clear = false;
		} else {
			confirming_clear = true;
			setTimeout(() => confirming_clear = false, 3000);
		}
	}
</script>

{#if voice}
	<div class="app">
		<header class="header">
			<div class="header-top">
				<h1 class="title">voice</h1>
				<button class="settings-btn" onclick={() => voice.show_settings = true} title="Settings">
					<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
						<circle cx="12" cy="12" r="3" />
						<path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
					</svg>
				</button>
			</div>
			<div class="controls">
				<button
					class="record-btn {recording ? 'recording' : ''}"
					onclick={() => voice.toggleVoiceChat()}
					title={recording ? 'Stop' : 'Start'}
				>
					<MicIcon size={24} color={recording ? '#0a0a0a' : '#888'} />
				</button>

				<div class="sub-controls">
					<button
						class="control-dot {voice_muted ? 'muted' : ''}"
						onclick={() => voice.toggleMicMute()}
						disabled={!recording}
						title={voice_muted ? 'Unmute mic' : 'Mute mic'}
					>
						{#if voice_muted}
							<MicMuteIcon size={16} color="#f44" />
						{:else}
							<MicIcon size={16} color={recording ? '#aaa' : '#555'} />
						{/if}
					</button>

					<button
						class="control-dot {audio_muted ? 'muted' : ''}"
						onclick={() => voice.toggleSpeakerMute()}
						disabled={!recording}
						title={audio_muted ? 'Unmute speaker' : 'Mute speaker'}
					>
						{#if audio_muted}
							<SpeakerOffIcon size={16} color="#f44" />
						{:else}
							<SpeakerIcon size={16} color={recording ? '#aaa' : '#555'} />
						{/if}
					</button>

					{#if recording}
						<button class="control-dot {confirming_clear ? 'confirm' : ''}" onclick={handle_clear} title={confirming_clear ? 'Click again to confirm' : 'Clear'}>
							{#if confirming_clear}
								<span class="confirm-text">?</span>
							{:else}
								<XIcon size={14} color="#666" />
							{/if}
						</button>
					{/if}
				</div>
			</div>
		</header>

		<main class="main">
			<ChatPanel />
			<NotePanel />
		</main>
	</div>

	<SettingsModal />

	{#if toasts.length > 0}
		<div class="toast-container">
			{#each toasts as toast (toast.id)}
				<div class="toast {toast.t === 'e' ? 'error' : 'info'}">{toast.msg}</div>
			{/each}
		</div>
	{/if}
{/if}

<style>
	.app {
		min-height: 100dvh;
		display: flex;
		flex-direction: column;
		padding: 2rem 1rem;
		max-width: 48rem;
		margin: 0 auto;
		width: 100%;
	}

	.header {
		text-align: center;
		margin-bottom: 2rem;
	}

	.header-top {
		display: flex;
		align-items: center;
		justify-content: center;
		position: relative;
		margin-bottom: 2rem;
	}

	.title {
		font-size: 1rem;
		font-weight: 400;
		color: #666;
		letter-spacing: 0.4em;
		text-transform: uppercase;
		margin: 0;
	}

	.settings-btn {
		position: absolute;
		right: 0;
		top: 50%;
		transform: translateY(-50%);
		background: none;
		border: none;
		color: #555;
		cursor: pointer;
		padding: 0.5rem;
		border-radius: 8px;
		transition: all 0.2s;
	}

	.settings-btn:hover {
		color: #aaa;
		background: rgba(255,255,255,0.05);
	}

	.controls {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 1rem;
	}

	.record-btn {
		width: 72px;
		height: 72px;
		border-radius: 50%;
		border: 2px solid #333;
		background: #1a1a1a;
		cursor: pointer;
		display: flex;
		align-items: center;
		justify-content: center;
		transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
		position: relative;
	}

	.record-btn:hover {
		border-color: #555;
		background: #222;
		transform: scale(1.05);
	}

	.record-btn:active {
		transform: scale(0.95);
	}

	.record-btn.recording {
		border-color: #4ade80;
		background: #4ade80;
		box-shadow: 0 0 0 0 rgba(74, 222, 128, 0.5);
		animation: pulse-ring 2s cubic-bezier(0.4, 0, 0.2, 1) infinite;
	}

	.record-btn.recording:hover {
		background: #3bce73;
		transform: scale(1.05);
	}

	@keyframes pulse-ring {
		0% { box-shadow: 0 0 0 0 rgba(74, 222, 128, 0.5); }
		70% { box-shadow: 0 0 0 20px rgba(74, 222, 128, 0); }
		100% { box-shadow: 0 0 0 0 rgba(74, 222, 128, 0); }
	}

	.sub-controls {
		display: flex;
		align-items: center;
		gap: 0.75rem;
	}

	.control-dot {
		width: 36px;
		height: 36px;
		border-radius: 50%;
		border: 1px solid #333;
		background: #151515;
		cursor: pointer;
		display: flex;
		align-items: center;
		justify-content: center;
		transition: all 0.2s;
	}

	.control-dot:hover:not(:disabled) {
		border-color: #555;
		background: #1e1e1e;
	}

	.control-dot:disabled {
		opacity: 0.3;
		cursor: not-allowed;
	}

	.control-dot.muted {
		border-color: rgba(255, 68, 68, 0.4);
		background: rgba(255, 68, 68, 0.1);
	}

	.control-dot.confirm {
		border-color: rgba(255, 200, 50, 0.6);
		background: rgba(255, 200, 50, 0.12);
	}

	.confirm-text {
		color: #ffc832;
		font-size: 14px;
		font-weight: 700;
	}

	.main {
		flex: 1;
		display: flex;
		flex-direction: column;
	}

	.toast-container {
		position: fixed;
		bottom: 1.5rem;
		left: 50%;
		transform: translateX(-50%);
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
		z-index: 100;
		pointer-events: none;
	}

	.toast {
		padding: 0.625rem 1.25rem;
		border-radius: 100px;
		font-size: 0.8125rem;
		white-space: nowrap;
		pointer-events: auto;
		animation: toast-in 0.35s cubic-bezier(0.4, 0, 0.2, 1);
		backdrop-filter: blur(12px);
	}

	.toast.info {
		background: rgba(74, 222, 128, 0.12);
		color: #4ade80;
		border: 1px solid rgba(74, 222, 128, 0.2);
	}

	.toast.error {
		background: rgba(255, 68, 68, 0.12);
		color: #f44;
		border: 1px solid rgba(255, 68, 68, 0.2);
	}

	@keyframes toast-in {
		from { opacity: 0; transform: translateY(10px) scale(0.95); }
		to { opacity: 1; transform: translateY(0) scale(1); }
	}
</style>

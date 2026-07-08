# Implementation Plan: "Play Active Note Aloud" with Piper TTS

## Overview
This document outlines the implementation of offline text-to-speech functionality using Piper TTS with ONNX Runtime Web for the SvelteKit application.

## Architecture
- **Framework**: Svelte 5 (runes mode) + SvelteKit 2
- **Build**: Vite 8, pnpm, TypeScript
- **Deploy target**: Cloudflare Workers
- **Approach**: Browser-only ONNX WASM (no server)

## Files Created

### 1. `src/lib/voice/text-splitter.ts`
Sentence splitter for streaming TTS synthesis.
- Splits text on sentence boundaries (`.`, `!`, `?`)
- Max chunk size: 200 characters
- Handles oversized sentences by splitting at last space before limit

### 2. `src/lib/voice/audio-queue.ts`
Gapless audio playback queue.
- Uses Web Audio API for PCM playback
- Schedules audio buffers for seamless transitions
- Supports play/pause/stop controls

### 3. `src/lib/voice/piper-tts.ts`
Piper TTS engine wrapper.
- ONNX Runtime Web inference session
- Phoneme generation via espeak-ng
- Streaming synthesis with chunk callbacks

### 4. `src/lib/voice/tts-state.svelte.ts`
Reactive TTS state for Svelte runes mode.
- Manages TTS session lifecycle
- Tracks playback state (playing, paused, progress)
- Voice selection and model loading

### 5. `src/lib/components/icons/play-icon.svelte`
Play button icon (triangle).

### 6. `src/lib/components/icons/pause-icon.svelte`
Pause button icon (two bars).

## Files Modified

### 1. `src/lib/voice/voice-state.svelte.ts`
- Added `tts` property (TTSState instance)
- Added `init_tts()` method
- Added `play_note(noteId)` method
- Added `stop_playback()` method

### 2. `src/lib/components/chat/NotePanel.svelte`
- Added play/pause buttons to each note
- Added progress bar for playing notes
- Added `toggle_play()` function

### 3. `vite.config.ts`
- Added COOP/COEP headers for SharedArrayBuffer
- Excluded `onnxruntime-web` from optimizeDeps

## Dependencies Installed
- `onnxruntime-web@^1.20.1`

## Voice Models
Default voice: `en_US-hfc_female-medium` (20 MB)
- `en_US-hfc_female-medium` - HFC Female (20 MB)
- `en_US-lessac-medium` - Lessac Male (20 MB)
- `en_US-ryan-medium` - Ryan Male (40 MB)
- `en_US-libritts_r-medium` - LibriTTS R (75 MB)

## Model Files Location
- `static/models/{voice-id}.onnx` - ONNX model
- `static/models/espeak-ng-data/` - Phonemizer data

## Usage
Click the play button on any note to hear it read aloud. The pause button toggles pause/resume. The progress bar shows synthesis progress.

## Future Enhancements
- Voice speed control
- Word-level highlighting
- Download as WAV/MP3
- Background playback
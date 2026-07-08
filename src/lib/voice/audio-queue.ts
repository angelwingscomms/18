export class AudioQueue {
	private ctx: AudioContext;
	private nextTime: number = 0;
	private _isPlaying = false;
	private _isPaused = false;
	private stopped = false;

	get isPlaying() { return this._isPlaying; }
	get isPaused() { return this._isPaused; }

	constructor() {
		this.ctx = new AudioContext();
	}

	enqueue(pcm: Float32Array, onEnd?: () => void): void {
		if (this.stopped) return;
		if (!this._isPlaying) {
			this.nextTime = this.ctx.currentTime + 0.05;
			this._isPlaying = true;
			this._isPaused = false;
			this.stopped = false;
		}
		const buffer = this.ctx.createBuffer(1, pcm.length, 22050);
		buffer.getChannelData(0).set(pcm);
		const source = this.ctx.createBufferSource();
		source.buffer = buffer;
		source.connect(this.ctx.destination);
		source.onended = () => {
			if (!this._isPaused && !this.stopped) {
				onEnd?.();
			}
		};
		source.start(this.nextTime);
		this.nextTime += buffer.duration;
	}

	play(): void {
		if (this._isPaused && this.ctx.state === 'suspended') {
			this.ctx.resume();
			this._isPaused = false;
		}
	}

	pause(): void {
		if (this._isPlaying && this.ctx.state === 'running') {
			this.ctx.suspend();
			this._isPaused = true;
		}
	}

	stop(): void {
		this.stopped = true;
		this._isPlaying = false;
		this._isPaused = false;
		this.nextTime = 0;
		if (this.ctx.state === 'running') {
			this.ctx.suspend();
		}
	}

	dispose(): void {
		this.stopped = true;
		this._isPlaying = false;
		this._isPaused = false;
		if (this.ctx.state === 'running') {
			this.ctx.close();
		}
	}
}
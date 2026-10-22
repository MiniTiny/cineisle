import audio from '@ohos.multimedia.audio';

// AudioSessionManager belongs to the process. Serialize ownership so a late close
// from an old engine cannot deactivate the next engine's focus.
export class MpvAudioFocus {
  private static owner: MpvAudioFocus | undefined;
  private static operations: Promise<void> = Promise.resolve();
  private manager: audio.AudioSessionManager | undefined;
  private registered: boolean = false;
  private closed: boolean = false;
  private revoked: boolean = false;
  private lost: () => void;
  private callback = (_event: audio.AudioSessionDeactivatedEvent): void => {
    if (this.closed || MpvAudioFocus.owner !== this || this.revoked) { return; }
    this.revoked = true; this.lost();
  };
  constructor(lost: () => void) { this.lost = lost; }
  private static enqueue(operation: () => Promise<void>): Promise<void> {
    const result = MpvAudioFocus.operations.then(operation);
    MpvAudioFocus.operations = result.catch(() => {}); return result;
  }
  activate(): Promise<void> {
    return MpvAudioFocus.enqueue(async () => {
      if (this.closed) { throw new Error('mpv_closed'); }
      if (MpvAudioFocus.owner && MpvAudioFocus.owner !== this) { throw new Error('mpv_audio_busy'); }
      if (!this.manager) { this.manager = audio.getAudioManager().getSessionManager(); }
      const manager = this.manager;
      if (!this.registered) { manager.on('audioSessionDeactivated', this.callback); this.registered = true; }
      MpvAudioFocus.owner = this; this.revoked = false;
      try {
        await manager.activateAudioSession({ concurrencyMode: audio.AudioConcurrencyMode.CONCURRENCY_DEFAULT });
        if (this.closed || this.revoked) { throw new Error('mpv_audio_interrupted'); }
      } catch (e) {
        // Activation can complete after close or focus loss. Undo it before a new owner is admitted.
        this.revoked = true;
        try {
          if (manager.isAudioSessionActivated()) { await manager.deactivateAudioSession(); }
          MpvAudioFocus.owner = undefined;
        } catch (_) { /* Retain ownership so release can retry cleanup before another engine acquires focus. */ }
        throw new Error('mpv_audio_unavailable');
      }
    });
  }
  deactivate(): Promise<void> {
    return MpvAudioFocus.enqueue(async () => {
      if (MpvAudioFocus.owner !== this) { return; }
      this.revoked = true;
      if (this.manager?.isAudioSessionActivated()) { await this.manager.deactivateAudioSession(); }
      MpvAudioFocus.owner = undefined;
    });
  }
  async release(): Promise<void> {
    this.closed = true;
    try { await this.deactivate(); }
    finally {
      if (this.registered && this.manager) { this.registered = false; this.manager.off('audioSessionDeactivated', this.callback); }
    }
  }
}

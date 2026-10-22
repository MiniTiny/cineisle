// SurfaceRect dimensions are physical pixels on API12, including PiP transfers.
// ArkUI layout dimensions alone do not notify the optional native video output.
export class PlaybackSurface extends XComponentController {
  private identity: string = '';
  private retired: string = '';
  private width: number = 0;
  private height: number = 0;
  private changed: (identity: string, width: number, height: number) => void;
  constructor(changed: (identity: string, width: number, height: number) => void) { super(); this.changed = changed; }
  onSurfaceCreated(identity: string): void { this.identity = identity; this.retired = ''; this.width = 0; this.height = 0; }
  onSurfaceChanged(identity: string, rect: SurfaceRect): void {
    if (!identity || identity === this.retired || (this.identity && identity !== this.identity) ||
      ![rect.surfaceWidth, rect.surfaceHeight].every((value: number): boolean => Number.isSafeInteger(value) && value > 0 && value <= 8192)) { return; }
    this.identity = identity;
    if (rect.surfaceWidth === this.width && rect.surfaceHeight === this.height) { return; }
    this.width = rect.surfaceWidth; this.height = rect.surfaceHeight; this.publish();
  }
  publish(): void { if (this.identity && this.width > 0 && this.height > 0) { this.changed(this.identity, this.width, this.height); } }
  onSurfaceDestroyed(identity: string): void { if (identity === this.identity) { this.retired = identity; this.identity = ''; this.width = 0; this.height = 0; } }
}

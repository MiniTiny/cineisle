// Wire/file bytes and decoded JavaScript string length protect different stages.
export class SubtitleTransferLimits { static readonly maxBytes: number = 4 * 1024 * 1024; }
export class SubtitleDocumentLimits { static readonly maxCodeUnits: number = 1024 * 1024; }

export class CaptionRenderLimits {
  static readonly maxRunsPerCue: number = 4096;
  static readonly maxSimultaneousRunWeight: number = 4096;
  static readonly maxPositionedCues: number = 256;
  static readonly maxLines: number = 1000;
  static readonly maximumExplicitFontScale: number = 3;
  static readonly maxRasterPixels: number = 1920 * 1080;
}

export class AssRenderLimits {
  static readonly targetWidthPx: number = 1920;
  static readonly targetHeightPx: number = 1080;
  static readonly maxSourceDimensionPx: number = 32768;
}

export interface MpvHandle { readonly mpv: boolean }
export interface MpvCapability { supported: boolean; loaded: boolean; apiVersion: number; active: number }
export interface MpvOpen { api: number; source: string; surface: string; fontConfiguration?: string; hardwareDecoder?: string; videoOutput?: string }
export interface MpvTrack { index: number; id: number; kind: string; language: string; title: string; codec: string; selected: boolean }
export interface MpvState {
  loaded: boolean; rendered: boolean; paused: boolean; ended: boolean; seeking: boolean; error: number;
  duration: number; position: number; width: number; height: number; speed: number; volume: number;
  seekRevision: number; seekDone: number; tracks: MpvTrack[];
  subtitleText: string; subtitleAss: string; subtitleStart: number; subtitleEnd: number;
  subtitleEvents: string; subtitleFontSize: number; subtitleOverflow: boolean;
  surfaceWidth: number; surfaceHeight: number;
  hardwareDecoder: string; videoOutput: string; audioOutput: string;
}
export interface MpvCommand { type: string; value: number; height?: number }
export const capability: (api: number) => Promise<MpvCapability>;
export const create: (request: MpvOpen) => Promise<MpvHandle>;
export const snapshot: (handle: MpvHandle) => Promise<MpvState>;
export const command: (handle: MpvHandle, command: MpvCommand) => Promise<void>;
export const release: (handle: MpvHandle) => Promise<void>;

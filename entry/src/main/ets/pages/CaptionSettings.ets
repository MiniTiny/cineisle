import { UiPalette } from '../utils/UiPalette';
import { UiLayout } from '../utils/UiLayout';
import { BrandHeader } from '../components/BrandHeader';
import { BrandHeading } from '../components/BrandHeading';
import { BrandButton } from '../components/BrandButton';
import { PinGate } from '../components/PinGate';
import router from '@ohos.router';
import { AppLock } from '../service/AppLock';
import { SystemCaptions } from '../service/SystemCaptions';
import { CaptionConfig, CaptionSnapshot, CaptionRenderStyle, CAPTION_FAMILIES, CAPTION_EDGES, copyCaptionConfig, captionRenderStyle, validCaptionConfig, sameCaptionConfig } from '../utils/CaptionStyle';
import { captionShadows } from '../utils/CaptionUI';
import { errorText, text } from '../utils/Strings';
const FAMILY_LABELS: string[] = ['caption_family_default', 'caption_family_mono_serif', 'caption_family_serif', 'caption_family_mono_sans', 'caption_family_sans', 'caption_family_casual', 'caption_family_cursive', 'caption_family_small_caps'];
const EDGE_LABELS: string[] = ['caption_edge_none', 'caption_edge_raised', 'caption_edge_depressed', 'caption_edge_uniform', 'caption_edge_shadow'];
@Entry
@Component
struct CaptionSettings {
  @StorageLink('cineIslePalette') palette: UiPalette = new UiPalette();
  @StorageLink('cineIsleAmoled') amoled: boolean = false;
  @StorageLink('cineIsleFontScale') fontScale: number = 1;
  @StorageLink('cineIsleLocked') @Watch('lockChanged') locked: boolean = true;
  @State state: CaptionSnapshot = new CaptionSnapshot();
  @State captionEnabled: boolean = false;
  @State scaleDraft: string = '100';
  @State family: number = 0;
  @State edge: number = 0;
  @State foreground: string = '#FFFFFFFF';
  @State backgroundDraft: string = '#99000000';
  @State windowColor: string = '#00000000';
  @State preview: CaptionRenderStyle = new CaptionRenderStyle();
  @State dirty: boolean = false;
  @State busy: boolean = false;
  @State valid: boolean = true;
  @State message: string = '';
  private base: CaptionConfig = new CaptionConfig();
  private visible: boolean = false;
  private revision: number = 0;
  private stop: (() => void) | undefined = undefined;
  onPageShow(): void { this.visible = true; this.start(); }
  onPageHide(): void { this.visible = false; ++this.revision; this.busy = false; this.stop?.(); this.stop = undefined; }
  aboutToDisappear(): void { this.onPageHide(); }
  private lockChanged(): void { this.stop?.(); this.stop = undefined; ++this.revision; this.busy = false; if (this.visible && !this.locked && AppLock.permit()) { this.start(); } }
  private start(): void {
    this.stop?.(); this.stop = undefined; if (!this.visible || this.locked || !AppLock.permit()) { return; }
    this.stop = SystemCaptions.observe((state: CaptionSnapshot) => {
      if (!this.visible || this.locked || !AppLock.permit()) { return; }
      this.state = state;
      if (!state.available) { this.message = text(state.issue); }
      else if (!this.dirty && !this.busy) { this.load(state.config); }
      else if (!this.busy && !sameCaptionConfig(this.base, state.config)) { this.message = text('caption_changed'); }
    });
  }
  private load(config: CaptionConfig): void {
    this.base = copyCaptionConfig(config); this.captionEnabled = config.enabled; this.scaleDraft = config.fontScale.toString();
    this.family = CAPTION_FAMILIES.indexOf(config.family); this.edge = CAPTION_EDGES.indexOf(config.edge);
    this.foreground = String(config.foreground); this.backgroundDraft = String(config.background); this.windowColor = String(config.window);
    this.preview = captionRenderStyle(config); this.dirty = false; this.valid = true; this.message = '';
  }
  private draft(): CaptionConfig {
    const config = new CaptionConfig(); config.enabled = this.captionEnabled; config.fontScale = Number(this.scaleDraft);
    config.family = CAPTION_FAMILIES[this.family]; config.edge = CAPTION_EDGES[this.edge];
    config.foreground = this.foreground.trim(); config.background = this.backgroundDraft.trim(); config.window = this.windowColor.trim(); return config;
  }
  private edit(field: string, value: string | boolean | number): void {
    if (!this.visible || !this.state.available || this.busy || this.locked || !AppLock.permit()) { return; }
    if (field === 'enabled' && typeof value === 'boolean' && value !== this.captionEnabled) { this.captionEnabled = value; }
    else if (field === 'scale' && typeof value === 'string' && value !== this.scaleDraft) { this.scaleDraft = value; }
    else if (field === 'family' && typeof value === 'number' && Number.isInteger(value) && value >= 0 && value < CAPTION_FAMILIES.length && value !== this.family) { this.family = value; }
    else if (field === 'edge' && typeof value === 'number' && Number.isInteger(value) && value >= 0 && value < CAPTION_EDGES.length && value !== this.edge) { this.edge = value; }
    else if (field === 'foreground' && typeof value === 'string' && value !== this.foreground) { this.foreground = value; }
    else if (field === 'background' && typeof value === 'string' && value !== this.backgroundDraft) { this.backgroundDraft = value; }
    else if (field === 'window' && typeof value === 'string' && value !== this.windowColor) { this.windowColor = value; }
    else { return; }
    this.changed();
  }
  private changed(): void { if (!this.visible || !this.state.available || this.busy || this.locked || !AppLock.permit()) { return; } const config = this.draft(); this.dirty = true; this.valid = validCaptionConfig(config); this.preview = captionRenderStyle(config); this.message = this.valid ? '' : text('caption_invalid'); }
  private preset(yellow: boolean): void {
    if (!this.visible || !this.state.available || this.busy || this.locked || !AppLock.permit()) { return; }
    this.captionEnabled = true; this.scaleDraft = '100'; this.family = 0; this.edge = 0; this.foreground = yellow ? '#FFFFFF00' : '#FFFFFFFF';
    this.backgroundDraft = '#99000000'; this.windowColor = '#00000000'; this.changed();
  }
  private reload(): void { if (!this.visible || this.busy || this.locked || !AppLock.permit()) { return; } const state = SystemCaptions.read(); this.state = state; if (state.available) { this.load(state.config); } else { this.message = text(state.issue); } }
  private async apply(): Promise<void> {
    if (!this.visible || this.busy || this.locked || !AppLock.permit() || !this.state.available) { return; }
    const config = this.draft(); if (!validCaptionConfig(config)) { this.valid = false; this.message = text('caption_invalid'); return; }
    const revision = ++this.revision; this.busy = true; this.message = '';
    try { const state = await SystemCaptions.save(this.base, config); if (revision === this.revision && this.visible && !this.locked && AppLock.permit()) { this.state = state; this.load(state.config); this.message = text('caption_saved'); } }
    catch (e) { if (revision === this.revision && this.visible && !this.locked && AppLock.permit()) { this.message = errorText(e as Error); } }
    finally { if (revision === this.revision) { this.busy = false; } }
  }
  @Builder
  private label(value: ResourceStr) { Text(value).fontSize(14).fontColor(this.palette.foreground).width('100%') }
  build() {
    Stack() {
      if (this.locked) { PinGate() }
      else {
        Scroll() {
          Column({ space: 16 }) {
            BrandHeader({ label: $r('app.string.caption_settings_title'), refreshable: true, available: !this.busy, onRefresh: () => this.reload(), onBack: () => { router.back(); } })
            Text($r('app.string.caption_scope')).fontColor(this.palette.muted).fontSize(14).width('100%')
            Column({ space: 12 }) {
              BrandHeading({ label: $r('app.string.caption_preview'), icon: $r('app.media.player_subtitle') })
              Row({ space: 12 }) {
                Text($r('app.string.caption_enabled')).fontColor(this.palette.foreground).fontSize(14).layoutWeight(1)
                Checkbox().select(this.captionEnabled).selectedColor(this.palette.action).enabled(this.state.available && !this.busy)
                  .accessibilityText($r('app.string.caption_enabled')).onChange((value: boolean) => this.edit('enabled', value))
              }.width('100%')
              Text(this.state.available ? (this.state.config.enabled ? $r('app.string.caption_active') : $r('app.string.caption_default')) : text(this.state.issue)).fontColor(this.palette.muted).fontSize(12).width('100%')
              Column() {
                Column() {
                  Text($r('app.string.caption_preview_text')).id('systemCaptionPreview').fontSize(this.preview.system ? `${20 * this.preview.scale}vp` : 20).fontFamily(this.preview.family)
                    .fontColor(this.preview.foreground).textShadow(captionShadows(this.preview.edge)).textAlign(TextAlign.Center)
                    .backgroundColor(this.preview.background).padding(8).width('100%')
                }.width('94%').padding(4).backgroundColor(this.preview.window)
              }.width('100%').constraintSize({ minHeight: 100 }).justifyContent(FlexAlign.Center).backgroundColor('#000000').borderRadius(12).padding(8)
              BrandButton({ label: $r('app.string.caption_preset_light'), icon: $r('app.media.player_subtitle'), available: this.state.available && !this.busy, onSelect: () => this.preset(false) })
              BrandButton({ label: $r('app.string.caption_preset_yellow'), icon: $r('app.media.player_subtitle'), available: this.state.available && !this.busy, onSelect: () => this.preset(true) })
            }.width('100%').padding(16).backgroundColor(this.amoled ? this.palette.amoledBackground : this.palette.raised).borderRadius(20)
            Column({ space: 12 }) {
              this.label($r('app.string.caption_scale'))
              TextInput({ text: this.scaleDraft, placeholder: '100' }).type(InputType.Number).maxLength(6).height(UiLayout.buttonHeight(this.fontScale)).fontColor(this.palette.foreground).backgroundColor(this.amoled ? this.palette.amoledBackground : this.palette.surface)
                .enabled(this.state.available && !this.busy).accessibilityText($r('app.string.caption_scale')).onChange((value: string) => this.edit('scale', value))
              this.label($r('app.string.caption_family'))
              Select(FAMILY_LABELS.map((key: string): SelectOption => ({ value: text(key) }))).selected(this.family).value(text(FAMILY_LABELS[this.family])).fontColor(this.palette.foreground).backgroundColor(this.amoled ? this.palette.amoledBackground : this.palette.surface).width('100%')
                .enabled(this.state.available && !this.busy).accessibilityText($r('app.string.caption_family')).onSelect((index: number) => this.edit('family', index))
              this.label($r('app.string.caption_edge'))
              Select(EDGE_LABELS.map((key: string): SelectOption => ({ value: text(key) }))).selected(this.edge).value(text(EDGE_LABELS[this.edge])).fontColor(this.palette.foreground).backgroundColor(this.amoled ? this.palette.amoledBackground : this.palette.surface).width('100%')
                .enabled(this.state.available && !this.busy).accessibilityText($r('app.string.caption_edge')).onSelect((index: number) => this.edit('edge', index))
              this.label($r('app.string.caption_foreground'))
              TextInput({ text: this.foreground }).height(UiLayout.buttonHeight(this.fontScale)).maxLength(9).fontColor(this.palette.foreground).backgroundColor(this.amoled ? this.palette.amoledBackground : this.palette.surface).enabled(this.state.available && !this.busy)
                .accessibilityText($r('app.string.caption_foreground')).onChange((value: string) => this.edit('foreground', value))
              this.label($r('app.string.caption_background'))
              TextInput({ text: this.backgroundDraft }).height(UiLayout.buttonHeight(this.fontScale)).maxLength(9).fontColor(this.palette.foreground).backgroundColor(this.amoled ? this.palette.amoledBackground : this.palette.surface).enabled(this.state.available && !this.busy)
                .accessibilityText($r('app.string.caption_background')).onChange((value: string) => this.edit('background', value))
              this.label($r('app.string.caption_window'))
              TextInput({ text: this.windowColor }).height(UiLayout.buttonHeight(this.fontScale)).maxLength(9).fontColor(this.palette.foreground).backgroundColor(this.amoled ? this.palette.amoledBackground : this.palette.surface).enabled(this.state.available && !this.busy)
                .accessibilityText($r('app.string.caption_window')).onChange((value: string) => this.edit('window', value))
              Text($r('app.string.caption_color_hint')).fontColor(this.palette.muted).fontSize(12).width('100%')
            }.width('100%').padding(16).backgroundColor(this.amoled ? this.palette.amoledBackground : this.palette.raised).borderRadius(20)
            if (this.dirty) { Text($r('app.string.caption_unsaved')).fontColor(this.palette.muted).fontSize(12).width('100%') }
            BrandButton({ label: $r('app.string.caption_apply'), icon: $r('app.media.menu_save'), primary: true, available: this.state.available && this.dirty && this.valid && !this.busy, onSelect: () => { this.apply(); } })
            BrandButton({ label: $r('app.string.caption_reload'), icon: $r('app.media.menu_sync'), available: !this.busy, onSelect: () => this.reload() })
            if (this.message) { Text(this.message).fontColor(this.palette.warm).fontSize(14).width('100%') }
          }.width('100%').padding(20).constraintSize({ maxWidth: 760 })
        }.width('100%').height('100%')
      }
    }.width('100%').height('100%').backgroundColor(this.amoled ? this.palette.amoledBackground : this.palette.background)
  }
}

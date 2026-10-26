import { UiPalette } from '../utils/UiPalette';

// Standard settings switch row. Saving and draft semantics remain with the owning page.
@Component
export struct SettingsToggle {
  @StorageLink('cineIslePalette') palette: UiPalette = new UiPalette();
  @Prop label: Resource;
  @Prop selected: boolean = false;
  @Prop available: boolean = true;
  onChange: (value: boolean) => void = () => {};
  build() {
    Row({ space: 12 }) {
      Text(this.label).fontSize(14).fontColor(this.palette.foreground).layoutWeight(1)
      Checkbox().select(this.selected).enabled(this.available).selectedColor(this.palette.action)
        .accessibilityText(this.label).onChange((value: boolean) => this.onChange(value))
    }.width('100%')
  }
}

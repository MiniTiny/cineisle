import { UiPalette } from '../utils/UiPalette';
@Component
export struct BrandChoice {
  @StorageLink('cineIslePalette') palette: UiPalette = new UiPalette();
  @StorageLink('cineIsleAmoled') amoled: boolean = false;
  @StorageLink('cineIsleFontScale') fontScale: number = 1;
  @Prop label: Resource;
  @Prop icon: Resource;
  @Prop choices: SelectOption[] = [];
  @Prop selected: number = 0;
  @Prop available: boolean = true;
  onSelect: (index: number) => void = () => {};
  build() {
    Column({ space: 8 }) {
      Row({ space: 8 }) {
        Image(this.icon).colorFilter(this.palette.filter(this.palette.dynamic ? this.palette.accent : undefined)).width(20).height(20).flexShrink(0).accessibilityLevel('no')
        Text(this.label).fontSize(14).fontColor(this.palette.muted).layoutWeight(1)
      }.width('100%')
      Select(this.choices).selected(this.selected).value(this.choices[this.selected]?.value ?? '')
        .width('100%').constraintSize({ minHeight: 40 * this.fontScale }).font({ size: 14 })
        .fontColor('#F2F3FA').backgroundColor((this.amoled ? '#000000' : this.palette.surface)).borderRadius(14)
        .optionBgColor((this.amoled ? '#000000' : this.palette.surface)).optionFontColor('#F2F3FA')
        .selectedOptionBgColor(this.palette.selected).selectedOptionFontColor(this.palette.accent)
        .enabled(this.available).accessibilityText(this.label).onSelect((index: number) => {
          if (this.available && Number.isInteger(index) && index >= 0 && index < this.choices.length) { this.onSelect(index); }
        })
    }.width('100%').alignItems(HorizontalAlign.Start)
  }
}

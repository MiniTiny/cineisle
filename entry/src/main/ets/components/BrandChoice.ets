@Component
export struct BrandChoice {
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
        Image(this.icon).width(20).height(20).flexShrink(0).accessibilityLevel('no')
        Text(this.label).fontSize(14).fontColor($r('app.color.brand_muted')).layoutWeight(1)
      }.width('100%')
      Select(this.choices).selected(this.selected).value(this.choices[this.selected]?.value ?? '')
        .width('100%').constraintSize({ minHeight: 40 * this.fontScale }).font({ size: 14 })
        .fontColor('#F2F3FA').backgroundColor($r('app.color.brand_surface')).borderRadius(14)
        .optionBgColor($r('app.color.brand_surface')).optionFontColor('#F2F3FA')
        .selectedOptionBgColor($r('app.color.brand_selected')).selectedOptionFontColor($r('app.color.brand_accent'))
        .enabled(this.available).accessibilityText(this.label).onSelect((index: number) => {
          if (this.available && Number.isInteger(index) && index >= 0 && index < this.choices.length) { this.onSelect(index); }
        })
    }.width('100%').alignItems(HorizontalAlign.Start)
  }
}

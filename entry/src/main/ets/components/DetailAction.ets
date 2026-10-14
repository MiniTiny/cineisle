import { BrandButton } from './BrandButton';
@Component
export struct DetailAction {
  @Prop label: Resource;
  @Prop icon: Resource;
  @Prop available: boolean = true;
  @Prop destructive: boolean = false;
  @Prop primary: boolean = false;
  onSelect: () => void = () => {};
  build() {
    BrandButton({ label: this.label, icon: this.icon, available: this.available, destructive: this.destructive, primary: this.primary, onSelect: this.onSelect })
  }
}

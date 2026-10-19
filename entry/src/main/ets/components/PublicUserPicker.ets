import { UiPalette } from '../utils/UiPalette';
import { BrandButton } from './BrandButton';
import { BrandState } from './BrandState';
import { PublicUser } from '../service/JellyfinClient';
import { loadPublicUsers } from '../service/PublicUsers';
import { errorText } from '../utils/Strings';

@Component
export struct PublicUserPicker {
  @StorageLink('cineIslePalette') palette: UiPalette = new UiPalette();
  @Prop @Watch('serverChanged') server: string = '';
  @Prop available: boolean = true;
  @State users: PublicUser[] = [];
  @State busy: boolean = false;
  @State loaded: boolean = false;
  @State message: string = '';
  onSelect: (name: string) => void = () => {};
  private revision: number = 0;
  private alive: boolean = false;
  aboutToAppear(): void { this.alive = true; }
  aboutToDisappear(): void { this.alive = false; this.serverChanged(); }
  serverChanged(): void { ++this.revision; this.users = []; this.busy = false; this.loaded = false; this.message = ''; }
  private async load(): Promise<void> {
    if (!this.available || this.busy || !this.server.trim() || !this.alive) { return; }
    const revision = ++this.revision; const address = this.server;
    this.busy = true; this.loaded = false; this.message = ''; this.users = [];
    try {
      const users = await loadPublicUsers(address);
      if (this.alive && revision === this.revision && address === this.server) { this.users = users; this.loaded = true; }
    } catch (e) { if (this.alive && revision === this.revision) { this.message = errorText(e as Error); } }
    finally { if (revision === this.revision) { this.busy = false; } }
  }
  @Builder
  private userButtons() {
    ForEach(this.users, (user: PublicUser) => {
      BrandButton({ label: user.name, icon: $r('app.media.nav_user_active'), available: this.available && !this.busy,
        onSelect: () => { if (this.alive && this.available && this.loaded && this.users.some((value: PublicUser) => value.id === user.id && value.name === user.name)) { this.onSelect(user.name); } } })
    }, (user: PublicUser) => user.id)
  }
  build() {
    Column({ space: 8 }) {
      BrandButton({ label: $r('app.string.public_users_load'), icon: $r('app.media.nav_user_active'),
        available: this.available && !this.busy && !!this.server.trim(), onSelect: () => this.load() })
      if (this.busy) { BrandState({ label: $r('app.string.loading'), loading: true }) }
      if (this.message) { Text(this.message).fontSize(12).fontColor(this.palette.warm).width('100%') }
      if (this.loaded && !this.users.length) { Text($r('app.string.public_users_empty')).fontSize(12).fontColor(this.palette.muted).width('100%') }
      this.userButtons()
    }.width('100%')
  }
}

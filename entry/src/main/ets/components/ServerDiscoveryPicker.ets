import { BrandButton } from './BrandButton';
import { BrandState } from './BrandState';
import { ServerDiscovery } from '../service/ServerDiscovery';
import { DiscoveredServer } from '../utils/ServerDiscovery';
import { AppService } from '../service/AppService';
import { AppLock } from '../service/AppLock';
import { JellyfinClient } from '../service/JellyfinClient';
import { errorText, text } from '../utils/Strings';

@Component
export struct ServerDiscoveryPicker {
  @Prop @Watch('availabilityChanged') available: boolean = true;
  @Prop @Watch('visibilityChanged') active: boolean = false;
  @Prop @Watch('addressChanged') address: string = '';
  @StorageLink('cineIsleLocked') @Watch('lockChanged') locked: boolean = true;
  @State servers: DiscoveredServer[] = [];
  @State scanning: boolean = false;
  @State verifying: boolean = false;
  @State loaded: boolean = false;
  @State message: string = '';
  onSelect: (server: DiscoveredServer) => void = () => {};
  private finder: ServerDiscovery = new ServerDiscovery();
  private owner: JellyfinClient | undefined;
  private alive: boolean = false;
  private started: boolean = false;
  private revision: number = 0;
  aboutToAppear(): void { this.owner = AppService.client; this.alive = true; this.maybeStart(); }
  aboutToDisappear(): void { this.alive = false; this.reset(); }
  private permitted(): boolean {
    return this.alive && this.active && this.available && !this.locked && AppLock.permit() && this.owner === AppService.client && !(AppService.experience?.snapshot().offline ?? false);
  }
  private reset(): void { ++this.revision; this.finder.cancel(); this.scanning = false; this.verifying = false; this.loaded = false; this.servers = []; this.message = ''; }
  private maybeStart(): void { if (!this.started && this.permitted()) { this.start(); } }
  private availabilityChanged(): void { if (!this.available) { this.reset(); } else { this.maybeStart(); } }
  private visibilityChanged(): void { if (!this.active) { this.reset(); this.started = false; } else { this.maybeStart(); } }
  private lockChanged(): void { if (this.locked) { this.reset(); this.started = false; } else { this.maybeStart(); } }
  private addressChanged(): void { this.reset(); }
  private stop(): void { this.reset(); this.started = true; this.message = text('discovery_stopped'); }
  private async start(): Promise<void> {
    if (!this.permitted() || this.scanning || this.verifying) { return; }
    this.reset(); this.started = true; this.scanning = true; const revision = this.revision;
    try {
      const result = await this.finder.start((servers: DiscoveredServer[]) => {
        if (revision === this.revision && this.permitted()) { this.servers = [...servers]; }
      });
      if (revision !== this.revision || !this.permitted()) { return; }
      this.servers = result.servers; this.loaded = true;
      if (result.limited) { this.message = text('discovery_limit_reached'); }
    } catch (e) { if (revision === this.revision && this.permitted() && (e as Error).message !== 'discovery_cancelled') { this.message = errorText(e as Error); } }
    finally { if (revision === this.revision) { this.scanning = false; } }
  }
  private async choose(candidate: DiscoveredServer): Promise<void> {
    if (!this.permitted() || this.verifying || !this.servers.some((s: DiscoveredServer) => s.id === candidate.id && s.address === candidate.address)) { return; }
    const revision = ++this.revision; this.scanning = false; this.verifying = true; this.message = '';
    try {
      const server = await this.finder.verify(candidate);
      if (revision === this.revision && this.permitted()) { this.onSelect(server); }
    } catch (e) { if (revision === this.revision && this.permitted() && (e as Error).message !== 'discovery_cancelled') { this.message = errorText(e as Error); } }
    finally { if (revision === this.revision) { this.verifying = false; } }
  }
  build() {
    Column({ space: 8 }) {
      Text($r('app.string.server_discovery_hint')).fontSize(12).fontColor($r('app.color.brand_muted')).width('100%')
      if (this.scanning || this.verifying) {
        BrandState({ label: this.verifying ? $r('app.string.discovery_verifying') : $r('app.string.discovery_scanning'), loading: true })
        BrandButton({ label: $r('app.string.discovery_stop'), icon: $r('app.media.menu_cancel'), onSelect: () => this.stop() })
      } else {
        BrandButton({ label: $r('app.string.discovery_start'), icon: $r('app.media.menu_server'), available: this.available && this.active && !this.locked,
          onSelect: () => this.start() })
      }
      if (this.loaded && !this.servers.length && !this.message) { Text($r('app.string.discovery_empty')).fontSize(12).fontColor($r('app.color.brand_muted')).width('100%') }
      if (this.message) { Text(this.message).fontSize(12).fontColor($r('app.color.brand_warm')).width('100%') }
      ForEach(this.servers, (server: DiscoveredServer) => {
        BrandButton({ label: server.name + ' · ' + server.address, icon: $r('app.media.menu_server'), available: this.available && this.active && !this.verifying && !this.locked,
          onSelect: () => this.choose(server) })
      }, (server: DiscoveredServer) => server.id + '|' + server.address)
    }.width('100%')
  }
}

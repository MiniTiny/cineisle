import { showBrandDialog } from '../components/CompactDialog';
import { BrandState } from '../components/BrandState';
import { UiLayout } from '../utils/UiLayout';
import router from '@ohos.router';
import { BrandButton } from '../components/BrandButton';
import { BrandHeading } from '../components/BrandHeading';
import { BrandHeader } from '../components/BrandHeader';
import { PinGate } from '../components/PinGate';
import { PublicUserPicker } from '../components/PublicUserPicker';
import { AppService } from '../service/AppService';
import { SessionStore } from '../service/SessionStore';
import { JellyfinClient } from '../service/JellyfinClient';
import { QuickConnectLogin } from '../service/QuickConnectLogin';
import { connectionFailure } from '../utils/Experience';
import { AccountSummary, ServerProfile } from '../utils/Accounts';
import { text, errorText } from '../utils/Strings';
interface AccountsRoute { server?: string; quick?: boolean }
@Entry
@Component
struct Accounts {
  @StorageLink('cineIsleFontScale') fontScale: number = 1;
  @State viewportWidth: number = 360;
  @State viewportHeight: number = 800;
  @StorageLink('cineIsleLocked') locked: boolean = true;
  @State accounts: AccountSummary[] = [];
  @State servers: ServerProfile[] = [];
  @State adding: boolean = false;
  @State quickEntry: boolean = false;
  @State server: string = '';
  @State username: string = '';
  @State password: string = '';
  @State busy: boolean = false;
  @State message: string = '';
  @State quickCode: string = '';
  @State editingId: string = '';
  @State serverName: string = '';
  @State addressText: string = '';
  private scroller: Scroller = new Scroller();
  private top(): void { if (this.visible) { this.scroller.scrollTo({ xOffset: 0, yOffset: 0 }); } }
  private toggleAdding(): void { this.cancelQuick(); this.adding = !this.adding; this.quickEntry = false; this.password = ''; this.top(); }
  private endEditing(): void { this.editingId = ''; this.top(); }
  private quick: QuickConnectLogin = new QuickConnectLogin();
  private timer: number = -1;
  private revision: number = 0;
  private visible: boolean = false;
  aboutToAppear(): void {
    const route = router.getParams() as AccountsRoute;
    this.server = route?.server ?? ''; this.adding = !!route?.quick; this.quickEntry = !!route?.quick; this.reload();
  }
  onPageShow(): void { this.visible = true; this.reload(); }
  onPageHide(): void { this.visible = false; this.cancelQuick(); this.password = ''; ++this.revision; }
  aboutToDisappear(): void { this.onPageHide(); }
  onBackPress(): boolean { if (this.quickCode) { this.cancelQuick(); this.top(); return true; } return false; }
  private async reload(): Promise<void> {
    const revision = this.revision;
    try { const accounts = await SessionStore.list(); const servers = await SessionStore.servers(); if (revision === this.revision) { this.accounts = accounts; this.servers = servers; } }
    catch (e) { this.message = errorText(e as Error); }
  }
  private async openHome(): Promise<void> { await router.replaceUrl({ url: 'pages/Index' }); router.clear(); }
  private async login(): Promise<void> {
    if (this.busy || this.quickCode) { return; } this.busy = true; this.message = ''; const revision = this.revision;
    try { await AppService.login(this.server, this.username, this.password, () => this.visible && revision === this.revision && !this.locked); if (revision === this.revision && this.visible) { await this.openHome(); } }
    catch (e) { if (revision === this.revision) { this.message = errorText(e as Error); } }
    finally { this.password = ''; if (revision === this.revision) { this.busy = false; } }
  }
  private async startQuick(): Promise<void> {
    if (this.busy) { return; } this.cancelQuick(); this.busy = true; this.message = ''; this.password = ''; const revision = this.revision;
    try { const profile = this.servers.find((s: ServerProfile) => s.addresses.includes(this.server.trim().replace(/\/+$/, ''))); const code = await this.quick.begin(this.server, profile?.id ?? '', profile?.addresses ?? []); if (revision !== this.revision || !this.visible) { this.quick.cancel(); return; } this.quickCode = code; this.top(); this.schedule(); }
    catch (e) { if (revision === this.revision && (e as Error).message !== 'quick_connect_cancelled') { this.message = errorText(e as Error); } }
    finally { if (revision === this.revision) { this.busy = false; } }
  }
  private schedule(): void { if (this.timer >= 0) { clearTimeout(this.timer); } if (this.visible && this.quickCode) { this.timer = setTimeout(() => this.checkQuick(), 5000); } }
  private cancelQuick(): void { if (this.timer >= 0) { clearTimeout(this.timer); this.timer = -1; } this.quick.cancel(); this.quickCode = ''; }
  private async checkQuick(): Promise<void> {
    if (!this.quickCode || this.busy || !this.visible || this.locked) { this.schedule(); return; }
    this.busy = true; const revision = this.revision;
    try {
      const client = await this.quick.poll();
      if (revision !== this.revision || !this.visible) { return; }
      if (client) { this.quickCode = ''; await AppService.loginQuick(client); if (revision === this.revision && this.visible) { await this.openHome(); } }
    } catch (e) {
      if (revision === this.revision) { this.message = errorText(e as Error); if (!connectionFailure(e as Error)) { this.cancelQuick(); } }
    } finally { if (revision === this.revision) { this.busy = false; this.schedule(); } }
  }
  private async select(account: AccountSummary): Promise<void> {
    if (this.busy) { return; } this.busy = true; this.message = ''; const revision = this.revision;
    try { await AppService.switchAccount(account.key); if (revision === this.revision && this.visible) { await this.openHome(); } }
    catch (e) { if (revision === this.revision) { this.message = errorText(e as Error); if (['login_expired', 'permission_denied'].includes((e as Error).message)) { this.adding = true; this.server = account.address; this.username = account.userName; this.top(); } } }
    finally { if (revision === this.revision) { this.busy = false; } }
  }
  private remove(account: AccountSummary): void {
    const revision = this.revision;
    showBrandDialog(() => this.getUIContext(), { width: this.viewportHeight < 440 ? Math.min(720, this.viewportWidth - 32) : undefined, height: this.viewportHeight < 440 ? '90%' : undefined, backgroundColor: $r('app.color.brand_surface_raised'), backgroundBlurStyle: BlurStyle.NONE, cornerRadius: 20, title: text('remove_saved_account'), message: text('remove_account_confirm'), buttonDirection: this.viewportHeight < 440 && this.viewportWidth >= 600 ? DialogButtonDirection.HORIZONTAL : DialogButtonDirection.VERTICAL, buttons: [{ defaultFocus: true, value: text('cancel'), fontColor: $r('app.color.brand_accent'), action: () => {} }, { value: text('confirm'), fontColor: $r('app.color.brand_danger'), action: async () => {
      if (this.busy || revision !== this.revision || !this.visible) { return; } this.busy = true;
      try { await AppService.removeAccount(account.key); await this.reload(); } catch (e) { this.message = errorText(e as Error); } finally { this.busy = false; }
    } }] }, this.viewportWidth, this.viewportHeight);
  }
  private editServer(server: ServerProfile): void { this.editingId = server.id; this.serverName = server.name; this.addressText = server.addresses.join('\n'); this.adding = false; this.message = ''; this.top(); }
  private async saveServer(): Promise<void> {
    if (this.busy) { return; } this.busy = true; this.message = '';
    try {
      const inputs = this.addressText.split(/\r?\n/).map((v: string) => v.trim()).filter((v: string) => !!v);
      if (this.editingId) { await AppService.saveServer(this.editingId, this.serverName, inputs); }
      else { const info = await JellyfinClient.inspectServer(this.server); await AppService.saveServer(info.Id!, this.serverName || info.ServerName || '', [this.server]); }
      this.endEditing(); await this.reload();
    } catch (e) { this.message = errorText(e as Error); } finally { this.busy = false; }
  }
  private removeServer(): void {
    const id = this.editingId; const revision = this.revision;
    showBrandDialog(() => this.getUIContext(), { width: this.viewportHeight < 440 ? Math.min(720, this.viewportWidth - 32) : undefined, height: this.viewportHeight < 440 ? '90%' : undefined, backgroundColor: $r('app.color.brand_surface_raised'), backgroundBlurStyle: BlurStyle.NONE, cornerRadius: 20, title: text('remove_saved_server'), message: text('remove_server_confirm'), buttonDirection: this.viewportHeight < 440 && this.viewportWidth >= 600 ? DialogButtonDirection.HORIZONTAL : DialogButtonDirection.VERTICAL, buttons: [{ defaultFocus: true, value: text('cancel'), fontColor: $r('app.color.brand_accent'), action: () => {} }, { value: text('confirm'), fontColor: $r('app.color.brand_danger'), action: async () => {
      if (this.busy || revision !== this.revision || !this.visible) { return; } this.busy = true;
      try { await AppService.removeServer(id); this.endEditing(); await this.reload(); } catch (e) { this.message = errorText(e as Error); } finally { this.busy = false; }
    } }] }, this.viewportWidth, this.viewportHeight);
  }
  private resetAccounts(): void {
    const revision = this.revision;
    showBrandDialog(() => this.getUIContext(), { width: this.viewportHeight < 440 ? Math.min(720, this.viewportWidth - 32) : undefined, height: this.viewportHeight < 440 ? '90%' : undefined, backgroundColor: $r('app.color.brand_surface_raised'), backgroundBlurStyle: BlurStyle.NONE, cornerRadius: 20, title: text('reset_saved_accounts'), message: text('reset_accounts_confirm'), buttonDirection: this.viewportHeight < 440 && this.viewportWidth >= 600 ? DialogButtonDirection.HORIZONTAL : DialogButtonDirection.VERTICAL, buttons: [{ defaultFocus: true, value: text('cancel'), fontColor: $r('app.color.brand_accent'), action: () => {} }, { value: text('confirm'), fontColor: $r('app.color.brand_danger'), action: async () => {
      if (this.busy || revision !== this.revision || !this.visible) { return; } this.busy = true;
      try { await AppService.resetAccounts(); this.message = ''; this.endEditing(); await this.reload(); } catch (e) { this.message = errorText(e as Error); } finally { this.busy = false; }
    } }] }, this.viewportWidth, this.viewportHeight);
  }
  @Builder
  private fieldCaption(label: Resource) {
    Text(label).fontSize(12).fontColor($r('app.color.brand_muted')).width('100%')
  }

  @Builder
  loginForm() {
    Column({ space: 12 }) {
      BrandHeading({ label: this.quickEntry || !!this.quickCode ? $r('app.string.quick_connect_login') : $r('app.string.add_account_server'), icon: this.quickEntry || !!this.quickCode ? $r('app.media.menu_quick') : $r('app.media.menu_add') })
      this.fieldCaption($r('app.string.server_address_label'))
      TextInput({ text: this.server, placeholder: $r('app.string.server_placeholder') }).height(UiLayout.buttonHeight(this.fontScale)).fontColor('#F2F3FA').placeholderColor($r('app.color.brand_muted')).backgroundColor($r('app.color.brand_surface')).borderRadius(12).enabled(!this.busy && !this.quickCode).onChange((v: string) => { this.server = v; })
      if (this.quickCode) {
        Text(this.quickCode).fontSize(38).minFontSize(16).maxFontSize(38).maxLines(1).width('100%').textAlign(TextAlign.Center).fontWeight(FontWeight.Bold).fontColor($r('app.color.brand_accent')).letterSpacing(6 / this.fontScale)
        Text($r('app.string.quick_connect_instructions')).fontSize(14).fontColor($r('app.color.brand_muted')).width('100%')
        BrandButton({ label: $r('app.string.quick_connect_check'), icon: $r('app.media.menu_sync'), primary: true, available: !this.busy, onSelect: () => this.checkQuick() })
        BrandButton({ label: $r('app.string.cancel'), icon: $r('app.media.menu_cancel'), onSelect: () => { this.cancelQuick(); this.message = ''; this.top(); } })
      } else if (this.quickEntry) {
        Text($r('app.string.quick_connect_start_hint')).fontSize(14).fontColor($r('app.color.brand_muted')).width('100%')
        BrandButton({ label: $r('app.string.quick_connect_login'), icon: $r('app.media.menu_quick'), primary: true, available: !this.busy && !!this.server.trim(), onSelect: () => this.startQuick() })
        BrandButton({ label: $r('app.string.login'), icon: $r('app.media.menu_login'), available: !this.busy, onSelect: () => { this.quickEntry = false; this.message = ''; this.top(); } })
      } else {
          PublicUserPicker({ server: this.server, available: !this.busy && !this.locked,
            onSelect: (name: string) => { this.username = name; this.password = ''; focusControl.requestFocus('account-login-password'); } })
        this.fieldCaption($r('app.string.username'))
        TextInput({ text: this.username, placeholder: $r('app.string.username') }).height(UiLayout.buttonHeight(this.fontScale)).fontColor('#F2F3FA').placeholderColor($r('app.color.brand_muted')).backgroundColor($r('app.color.brand_surface')).borderRadius(12).enabled(!this.busy).onChange((v: string) => { this.username = v; })
        this.fieldCaption($r('app.string.password'))
          TextInput({ text: this.password, placeholder: $r('app.string.password') }).id('account-login-password').height(UiLayout.buttonHeight(this.fontScale)).type(InputType.Password).fontColor('#F2F3FA').placeholderColor($r('app.color.brand_muted')).backgroundColor($r('app.color.brand_surface')).borderRadius(12).enabled(!this.busy).onChange((v: string) => { this.password = v; })
        BrandButton({ label: $r('app.string.login'), icon: $r('app.media.menu_login'), primary: true, available: !this.busy && !!this.server.trim() && !!this.username.trim(), onSelect: () => this.login() })
        BrandButton({ label: $r('app.string.quick_connect_login'), icon: $r('app.media.menu_quick'), available: !this.busy && !!this.server.trim(), onSelect: () => this.startQuick() })
        BrandButton({ label: $r('app.string.save_server_only'), icon: $r('app.media.menu_server'), available: !this.busy && !!this.server.trim(), onSelect: () => this.saveServer() })
        Text($r('app.string.https_hint')).fontColor($r('app.color.brand_muted')).fontSize(12).width('100%')
      }
    }.width('100%').padding(16).backgroundColor($r('app.color.brand_surface_raised')).borderRadius(20)
  }

  @Builder
  serverForm() {
    Column({ space: 12 }) {
      BrandHeading({ label: $r('app.string.server_addresses'), icon: $r('app.media.menu_server') })
      this.fieldCaption($r('app.string.server_display_name'))
      TextInput({ text: this.serverName, placeholder: $r('app.string.server_display_name') }).height(UiLayout.buttonHeight(this.fontScale)).fontColor('#F2F3FA').placeholderColor($r('app.color.brand_muted')).backgroundColor($r('app.color.brand_surface')).borderRadius(12).enabled(!this.busy).onChange((v: string) => { this.serverName = v; })
      this.fieldCaption($r('app.string.server_address_label'))
      TextArea({ text: this.addressText, placeholder: $r('app.string.addresses_hint') }).fontColor('#F2F3FA').placeholderColor($r('app.color.brand_muted')).backgroundColor($r('app.color.brand_surface')).borderRadius(12).height(Math.min(160 * this.fontScale, Math.max(80, this.viewportHeight * 0.4))).enabled(!this.busy).onChange((v: string) => { this.addressText = v; })
      Text($r('app.string.addresses_hint')).fontColor($r('app.color.brand_muted')).fontSize(12).width('100%')
      BrandButton({ label: $r('app.string.save'), icon: $r('app.media.menu_save'), primary: true, available: !this.busy, onSelect: () => this.saveServer() })
      BrandButton({ label: $r('app.string.remove_saved_server'), icon: $r('app.media.detail_remove'), destructive: true, available: !this.busy, onSelect: () => this.removeServer() })
      BrandButton({ label: $r('app.string.cancel'), icon: $r('app.media.menu_cancel'), available: !this.busy, onSelect: () => this.endEditing() })
    }.width('100%').padding(16).backgroundColor($r('app.color.brand_surface_raised')).borderRadius(20)
  }

  @Builder
  private accountCards() {
    BrandHeading({ label: $r('app.string.saved_accounts'), icon: $r('app.media.nav_user_active') })
    if (!this.accounts.length) { BrandState({ label: $r('app.string.no_saved_accounts'), icon: $r('app.media.menu_accounts') }) }
    ForEach(this.accounts, (account: AccountSummary) => {
      Column({ space: 12 }) {
        Row({ space: 12 }) {
          Row() { Image($r('app.media.nav_user_active')).width(22).height(22).accessibilityLevel('no') }
            .width(36).height(36).justifyContent(FlexAlign.Center).flexShrink(0).backgroundColor($r('app.color.brand_selected')).borderRadius(12)
          Column({ space: 4 }) {
            Text(account.userName || $r('app.string.account_unnamed')).fontColor('#F2F3FA').fontSize(18).fontWeight(FontWeight.Medium).width('100%')
            Text(account.serverName || account.address).fontColor($r('app.color.brand_muted')).fontSize(12).width('100%')
          }.layoutWeight(1)
        }.width('100%')
        if (account.active) {
          Row({ space: 6 }) { Image($r('app.media.nav_check_active')).width(16).height(16).accessibilityLevel('no'); Text($r('app.string.active_account')).fontColor($r('app.color.brand_accent')).fontSize(12) }.width('100%')
        }
        Flex({ wrap: FlexWrap.Wrap, justifyContent: FlexAlign.SpaceBetween }) {
          Column() { BrandButton({ label: $r('app.string.switch_account'), icon: $r('app.media.menu_login'), primary: true, available: !this.busy && !account.active, onSelect: () => this.select(account) }) }
            .width(this.viewportWidth < 360 || this.fontScale > 1 ? '100%' : '48%').margin({ bottom: 8 })
          Column() { BrandButton({ label: $r('app.string.remove_saved_account'), icon: $r('app.media.detail_remove'), destructive: true, available: !this.busy, onSelect: () => this.remove(account) }) }
            .width(this.viewportWidth < 360 || this.fontScale > 1 ? '100%' : '48%').margin({ bottom: 8 })
        }.width('100%')
      }.width('100%').padding(16).backgroundColor($r('app.color.brand_surface_raised')).borderRadius(20)
    }, (account: AccountSummary) => JSON.stringify(account))
  }

  @Builder
  private serverCards() {
    BrandHeading({ label: $r('app.string.saved_servers'), icon: $r('app.media.menu_server') })
    if (!this.servers.length) { BrandState({ label: $r('app.string.no_saved_servers'), icon: $r('app.media.menu_server') }) }
    ForEach(this.servers, (server: ServerProfile) => {
      Column({ space: 12 }) {
        Row({ space: 12 }) {
          Row() { Image($r('app.media.menu_server')).width(22).height(22).accessibilityLevel('no') }
            .width(36).height(36).justifyContent(FlexAlign.Center).flexShrink(0).backgroundColor($r('app.color.brand_selected')).borderRadius(12)
          Text(server.name || server.preferred).fontColor('#F2F3FA').fontSize(16).fontWeight(FontWeight.Medium).layoutWeight(1)
        }.width('100%')
        Text(server.addresses.join('\n')).fontColor($r('app.color.brand_muted')).fontSize(12).width('100%')
        Flex({ wrap: FlexWrap.Wrap, justifyContent: FlexAlign.SpaceBetween }) {
          Column() { BrandButton({ label: $r('app.string.login'), icon: $r('app.media.menu_login'), primary: true, available: !this.busy, onSelect: () => { this.server = server.preferred; this.username = ''; this.adding = true; this.top(); } }) }
            .width(this.viewportWidth < 360 || this.fontScale > 1 ? '100%' : '48%').margin({ bottom: 8 })
          Column() { BrandButton({ label: $r('app.string.manage_addresses'), icon: $r('app.media.menu_settings'), available: !this.busy, onSelect: () => this.editServer(server) }) }
            .width(this.viewportWidth < 360 || this.fontScale > 1 ? '100%' : '48%').margin({ bottom: 8 })
        }.width('100%')
      }.padding(16).width('100%').backgroundColor($r('app.color.brand_surface_raised')).borderRadius(20)
    }, (server: ServerProfile) => JSON.stringify(server))
  }

  build() {
    Column() {
      if (this.locked) { PinGate() }
      else {
        Column({ space: 14 }) {
          BrandHeader({ label: this.quickEntry ? $r('app.string.quick_connect_title') : $r('app.string.accounts_servers'), onBack: () => router.back() })
          if (this.message) {
            Scroll() { Text(this.message).fontColor($r('app.color.brand_danger')).fontSize(13).width('100%').padding(12) }
              .width('100%').height(Math.min(64 * this.fontScale, this.viewportHeight * 0.2))
              .backgroundColor($r('app.color.brand_surface_raised')).borderRadius(12).align(Alignment.TopStart)
          }
          Scroll(this.scroller) {
            Column({ space: 18 }) {
              if (this.busy) { BrandState({ label: $r('app.string.loading'), loading: true }) }
              if (this.editingId) { this.serverForm() }
              else {
                if (this.adding) {
                  this.loginForm()
                  BrandButton({ label: $r('app.string.saved_accounts'), icon: $r('app.media.menu_accounts'), available: !this.busy, onSelect: () => this.toggleAdding() })
                } else {
                  BrandButton({ label: $r('app.string.add_account_server'), icon: $r('app.media.menu_add'), primary: true, available: !this.busy, onSelect: () => this.toggleAdding() })
                  this.accountCards()
                  this.serverCards()
                }
              }
              if (!this.quickCode && !this.quickEntry) {
                Column({ space: 12 }) {
                  BrandHeading({ label: $r('app.string.credentials_group'), icon: $r('app.media.menu_lock') })
                  Text($r('app.string.credentials_hint')).fontSize(12).fontColor($r('app.color.brand_muted')).width('100%')
                  BrandButton({ label: $r('app.string.reset_saved_accounts'), icon: $r('app.media.menu_reset'), destructive: true, available: !this.busy, onSelect: () => this.resetAccounts() })
                }.width('100%').padding(16).backgroundColor($r('app.color.brand_surface_raised')).borderRadius(20)
              }
            }.width('100%').alignItems(HorizontalAlign.Start).padding({ bottom: 12 })
          }.width('100%').layoutWeight(1).align(Alignment.TopStart)
        }.padding(20).height('100%').width('100%').backgroundColor($r('app.color.brand_background'))
      }
    }.width('100%').height('100%').onAreaChange((_old: Area, area: Area) => { this.viewportWidth = Number.parseFloat(String(area.width)); this.viewportHeight = Number.parseFloat(String(area.height)); })
  }
}

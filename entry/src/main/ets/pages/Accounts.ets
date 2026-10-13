import { UiLayout } from '../utils/UiLayout';
import router from '@ohos.router';
import { PinGate } from '../components/PinGate';
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
  private toggleAdding(): void { this.cancelQuick(); this.adding = !this.adding; this.password = ''; this.top(); }
  private endEditing(): void { this.editingId = ''; this.top(); }
  private quick: QuickConnectLogin = new QuickConnectLogin();
  private timer: number = -1;
  private revision: number = 0;
  private visible: boolean = false;
  aboutToAppear(): void {
    const route = router.getParams() as AccountsRoute;
    this.server = route?.server ?? ''; this.adding = !!route?.quick; this.reload();
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
    AlertDialog.show({ title: text('remove_saved_account'), message: text('remove_account_confirm'), primaryButton: { value: text('cancel'), action: () => {} }, secondaryButton: { value: text('confirm'), action: async () => {
      if (this.busy || revision !== this.revision || !this.visible) { return; } this.busy = true;
      try { await AppService.removeAccount(account.key); await this.reload(); } catch (e) { this.message = errorText(e as Error); } finally { this.busy = false; }
    } } });
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
    AlertDialog.show({ title: text('remove_saved_server'), message: text('remove_server_confirm'), primaryButton: { value: text('cancel'), action: () => {} }, secondaryButton: { value: text('confirm'), action: async () => {
      if (this.busy || revision !== this.revision || !this.visible) { return; } this.busy = true;
      try { await AppService.removeServer(id); this.endEditing(); await this.reload(); } catch (e) { this.message = errorText(e as Error); } finally { this.busy = false; }
    } } });
  }
  private resetAccounts(): void {
    const revision = this.revision;
    AlertDialog.show({ title: text('reset_saved_accounts'), message: text('reset_accounts_confirm'), primaryButton: { value: text('cancel'), action: () => {} }, secondaryButton: { value: text('confirm'), action: async () => {
      if (this.busy || revision !== this.revision || !this.visible) { return; } this.busy = true;
      try { await AppService.resetAccounts(); this.message = ''; this.endEditing(); await this.reload(); } catch (e) { this.message = errorText(e as Error); } finally { this.busy = false; }
    } } });
  }
  @Builder
  loginForm() {
    TextInput({ text: this.server, placeholder: $r('app.string.server_placeholder') }).height(UiLayout.buttonHeight(this.fontScale)).fontColor('#F2F3FA').placeholderColor($r('app.color.brand_muted')).backgroundColor($r('app.color.brand_surface')).enabled(!this.busy && !this.quickCode).onChange((v: string) => { this.server = v; })
    if (this.quickCode) {
      Text(this.quickCode).fontSize(38).minFontSize(16).maxFontSize(38).maxLines(1).width('100%').textAlign(TextAlign.Center).fontWeight(FontWeight.Bold).fontColor($r('app.color.brand_accent')).letterSpacing(6 / this.fontScale)
      Text($r('app.string.quick_connect_instructions')).fontSize(14).fontColor($r('app.color.brand_muted'))
      Button($r('app.string.quick_connect_check')).labelStyle({ maxLines: 2, overflow: TextOverflow.Clip }).constraintSize({ minHeight: UiLayout.buttonHeight(this.fontScale), maxWidth: '100%' }).backgroundColor($r('app.color.brand_action')).enabled(!this.busy).onClick(() => this.checkQuick())
      Button($r('app.string.cancel')).labelStyle({ maxLines: 2, overflow: TextOverflow.Clip }).constraintSize({ minHeight: UiLayout.buttonHeight(this.fontScale), maxWidth: '100%' }).backgroundColor($r('app.color.brand_surface')).onClick(() => { this.cancelQuick(); this.message = ''; this.top(); })
    } else {
      TextInput({ text: this.username, placeholder: $r('app.string.username') }).height(UiLayout.buttonHeight(this.fontScale)).fontColor('#F2F3FA').placeholderColor($r('app.color.brand_muted')).backgroundColor($r('app.color.brand_surface')).enabled(!this.busy).onChange((v: string) => { this.username = v; })
      TextInput({ text: this.password, placeholder: $r('app.string.password') }).height(UiLayout.buttonHeight(this.fontScale)).type(InputType.Password).fontColor('#F2F3FA').placeholderColor($r('app.color.brand_muted')).backgroundColor($r('app.color.brand_surface')).enabled(!this.busy).onChange((v: string) => { this.password = v; })
      Button($r('app.string.login')).labelStyle({ maxLines: 2, overflow: TextOverflow.Clip }).constraintSize({ minHeight: UiLayout.buttonHeight(this.fontScale), maxWidth: '100%' }).backgroundColor($r('app.color.brand_action')).enabled(!this.busy && !!this.server.trim() && !!this.username.trim()).onClick(() => this.login())
      Button($r('app.string.quick_connect_login')).labelStyle({ maxLines: 2, overflow: TextOverflow.Clip }).constraintSize({ minHeight: UiLayout.buttonHeight(this.fontScale), maxWidth: '100%' }).backgroundColor($r('app.color.brand_surface')).enabled(!this.busy && !!this.server.trim()).onClick(() => this.startQuick())
      Button($r('app.string.save_server_only')).labelStyle({ maxLines: 2, overflow: TextOverflow.Clip }).constraintSize({ minHeight: UiLayout.buttonHeight(this.fontScale), maxWidth: '100%' }).backgroundColor($r('app.color.brand_surface')).enabled(!this.busy && !!this.server.trim()).onClick(() => this.saveServer())
      Text($r('app.string.https_hint')).fontColor($r('app.color.brand_muted')).fontSize(12)
    }
  }
  @Builder
  serverForm() {
    Text($r('app.string.server_addresses')).fontColor('#F2F3FA').fontSize(20)
    TextInput({ text: this.serverName, placeholder: $r('app.string.server_display_name') }).height(UiLayout.buttonHeight(this.fontScale)).fontColor('#F2F3FA').backgroundColor($r('app.color.brand_surface')).enabled(!this.busy).onChange((v: string) => { this.serverName = v; })
    TextArea({ text: this.addressText, placeholder: $r('app.string.addresses_hint') }).fontColor('#F2F3FA').backgroundColor($r('app.color.brand_surface')).height(160).enabled(!this.busy).onChange((v: string) => { this.addressText = v; })
    Text($r('app.string.addresses_hint')).fontColor($r('app.color.brand_muted')).fontSize(12)
    Button($r('app.string.save')).labelStyle({ maxLines: 2, overflow: TextOverflow.Clip }).constraintSize({ minHeight: UiLayout.buttonHeight(this.fontScale), maxWidth: '100%' }).backgroundColor($r('app.color.brand_action')).enabled(!this.busy).onClick(() => this.saveServer())
    Button($r('app.string.remove_saved_server')).labelStyle({ maxLines: 2, overflow: TextOverflow.Clip }).constraintSize({ minHeight: UiLayout.buttonHeight(this.fontScale), maxWidth: '100%' }).backgroundColor($r('app.color.brand_surface')).fontColor($r('app.color.brand_danger')).enabled(!this.busy).onClick(() => this.removeServer())
    Button($r('app.string.cancel')).labelStyle({ maxLines: 2, overflow: TextOverflow.Clip }).constraintSize({ minHeight: UiLayout.buttonHeight(this.fontScale), maxWidth: '100%' }).backgroundColor($r('app.color.brand_surface')).enabled(!this.busy).onClick(() => this.endEditing())
  }
  build() {
    Column() {
      if (this.locked) { PinGate() }
      else {
        Column({ space: 14 }) {
          Row({ space: 10 }) {
            Button($r('app.string.back')).labelStyle({ maxLines: 2, overflow: TextOverflow.Clip }).constraintSize({ minHeight: UiLayout.buttonHeight(this.fontScale), maxWidth: '100%' }).backgroundColor($r('app.color.brand_surface')).onClick(() => router.back())
            Text($r('app.string.accounts_servers')).fontColor('#F2F3FA').fontSize(22).maxLines(1).textOverflow({ overflow: TextOverflow.Ellipsis }).layoutWeight(1)
          }.width('100%')
          if (this.message) { Text(this.message).fontColor($r('app.color.brand_danger')).fontSize(13).width('100%') }
          Scroll(this.scroller) {
            Column({ space: 14 }) {
              if (this.editingId) { this.serverForm() }
              else {
                if (this.adding) { this.loginForm() }
                Button(this.adding ? $r('app.string.saved_accounts') : $r('app.string.add_account_server')).labelStyle({ maxLines: 2, overflow: TextOverflow.Clip }).constraintSize({ minHeight: UiLayout.buttonHeight(this.fontScale), maxWidth: '100%' }).backgroundColor($r('app.color.brand_surface')).enabled(!this.busy).onClick(() => this.toggleAdding())
                if (!this.adding) {
                  Text($r('app.string.saved_accounts')).fontColor('#F2F3FA').fontSize(18).width('100%')
                  if (!this.accounts.length) { Text($r('app.string.no_saved_accounts')).fontColor($r('app.color.brand_muted')) }
                  ForEach(this.accounts, (account: AccountSummary) => {
                    Column({ space: 8 }) {
                      Text(account.userName || $r('app.string.account_unnamed')).fontColor('#F2F3FA').fontSize(18).width('100%')
                      Text(account.serverName || account.address).fontColor($r('app.color.brand_muted')).fontSize(12).width('100%')
                      if (account.active) { Text($r('app.string.active_account')).fontColor($r('app.color.brand_accent')).fontSize(12) }
                      Flex({ wrap: FlexWrap.Wrap }) {
                        Button($r('app.string.switch_account')).labelStyle({ maxLines: 2, overflow: TextOverflow.Clip }).margin({ right: 8, bottom: 8 }).constraintSize({ minHeight: UiLayout.buttonHeight(this.fontScale), maxWidth: '100%' }).backgroundColor($r('app.color.brand_action')).enabled(!this.busy && !account.active).onClick(() => this.select(account))
                        Button($r('app.string.remove_saved_account')).labelStyle({ maxLines: 2, overflow: TextOverflow.Clip }).margin({ right: 8, bottom: 8 }).constraintSize({ minHeight: UiLayout.buttonHeight(this.fontScale), maxWidth: '100%' }).backgroundColor($r('app.color.brand_surface')).enabled(!this.busy).onClick(() => this.remove(account))
                      }
                    }.width('100%').padding(14).backgroundColor($r('app.color.brand_surface')).borderRadius(12)
                  }, (account: AccountSummary) => JSON.stringify(account))
                  Text($r('app.string.saved_servers')).fontColor('#F2F3FA').fontSize(18).width('100%')
                  ForEach(this.servers, (server: ServerProfile) => {
                    Column({ space: 8 }) {
                      Text(server.name || server.preferred).fontColor('#F2F3FA').fontSize(16).width('100%')
                      Text(server.addresses.join('\n')).fontColor($r('app.color.brand_muted')).fontSize(12).width('100%')
                      Flex({ wrap: FlexWrap.Wrap }) {
                        Button($r('app.string.login')).labelStyle({ maxLines: 2, overflow: TextOverflow.Clip }).margin({ right: 8, bottom: 8 }).constraintSize({ minHeight: UiLayout.buttonHeight(this.fontScale), maxWidth: '100%' }).backgroundColor($r('app.color.brand_action')).enabled(!this.busy).onClick(() => { this.server = server.preferred; this.username = ''; this.adding = true; this.top(); })
                        Button($r('app.string.manage_addresses')).labelStyle({ maxLines: 2, overflow: TextOverflow.Clip }).margin({ right: 8, bottom: 8 }).constraintSize({ minHeight: UiLayout.buttonHeight(this.fontScale), maxWidth: '100%' }).backgroundColor($r('app.color.brand_surface')).enabled(!this.busy).onClick(() => this.editServer(server))
                      }
                    }.padding(14).width('100%').backgroundColor($r('app.color.brand_surface')).borderRadius(12)
                  }, (server: ServerProfile) => JSON.stringify(server))
                }
              }
              if (!this.quickCode) { Button($r('app.string.reset_saved_accounts')).labelStyle({ maxLines: 2, overflow: TextOverflow.Clip }).constraintSize({ minHeight: UiLayout.buttonHeight(this.fontScale), maxWidth: '100%' }).backgroundColor($r('app.color.brand_surface')).fontColor($r('app.color.brand_danger')).enabled(!this.busy).onClick(() => this.resetAccounts()) }
            }.width('100%').alignItems(HorizontalAlign.Start)
          }.width('100%').layoutWeight(1).align(Alignment.TopStart)
        }.padding(20).height('100%').width('100%').backgroundColor($r('app.color.brand_background'))
      }
    }.width('100%').height('100%').onAreaChange((_old: Area, area: Area) => { this.viewportWidth = Number.parseFloat(String(area.width)); this.viewportHeight = Number.parseFloat(String(area.height)); })
  }
}

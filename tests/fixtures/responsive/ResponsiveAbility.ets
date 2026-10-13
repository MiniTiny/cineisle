// QA-only native viewport harness. Copied into an isolated bundle, never the product HAP.
import { AppService } from '../service/AppService';
import { AppLock } from '../service/AppLock';
import { UiLayout } from '../utils/UiLayout';
import { Configuration } from '@ohos.app.ability.Configuration';
import UIAbility from '@ohos.app.ability.UIAbility';
import Want from '@ohos.app.ability.Want';
import window from '@ohos.window';
import display from '@ohos.display';
import fs from '@ohos.file.fs';
export default class ResponsiveAbility extends UIAbility {
  private stage: window.WindowStage | undefined = undefined;
  private child: window.Window | undefined = undefined;
  private target: string = 'Index';
  private font: number = 100;
  private width: number = 320;
  private height: number = 640;
  private landscape: boolean = false;
  onConfigurationUpdated(config: Configuration): void { if (config.fontSizeScale !== undefined) { AppStorage.setOrCreate('cineIsleFontScale', UiLayout.scale(config.fontSizeScale)); } if (config.direction !== undefined) { AppStorage.setOrCreate('cineIsleLandscape', config.direction === 1); } }
  onCreate(want: Want): void { this.read(want); }
  onNewWant(want: Want): void { this.read(want); if (this.stage) { this.apply(); } }
  private read(want: Want): void {
    this.target = String(want.parameters?.target ?? 'Index');
    this.font = Number(want.parameters?.font ?? 100); this.width = Number(want.parameters?.width ?? 320);
    this.height = Number(want.parameters?.height ?? 640); this.landscape = !!want.parameters?.landscape;
  }
  onWindowStageCreate(stage: window.WindowStage): void { this.stage = stage; stage.loadContent('pages/ResponsiveBackdrop', () => this.apply()); }
  private async apply(): Promise<void> {
    if (!this.stage) { return; }
    try {
      this.context.getApplicationContext().setFontSizeScale(this.font / 100);
      AppStorage.setOrCreate('cineIsleFontScale', UiLayout.scale(this.font / 100));
      AppStorage.setOrCreate('cineIsleLandscape', this.landscape);
      const main = await this.stage.getMainWindow();
      await main.setPreferredOrientation(this.landscape ? window.Orientation.LANDSCAPE : window.Orientation.PORTRAIT);
      await new Promise<void>((resolve) => setTimeout(resolve, 700));
      if (this.child) { await this.child.destroyWindow(); }
      const screen = display.getDefaultDisplaySync();
      this.child = await this.stage.createSubWindow('responsiveViewport');
      await this.child.loadContent('pages/Index'); await this.child.showWindow();
      await this.child.setWindowBackgroundColor('#0D1924');
      await this.child.setWindowLayoutFullScreen(true);
      await this.child.resize(Math.round(this.width * screen.densityPixels), Math.round(this.height * screen.densityPixels));
      await this.child.moveWindowTo(20, this.landscape ? 100 : 180);
      await new Promise<void>((resolve) => setTimeout(resolve, 350));
      const file = fs.openSync(this.context.filesDir + '/responsive-viewport.json', fs.OpenMode.CREATE | fs.OpenMode.READ_WRITE | fs.OpenMode.TRUNC);
      const evidence = JSON.stringify({ requestedWidth: this.width, requestedHeight: this.height, font: this.font,
        configurationFontScale: this.context.config.fontSizeScale, density: screen.densityPixels, screenWidth: screen.width, screenHeight: screen.height,
        window: this.child.getWindowProperties() });
      fs.writeSync(file.fd, evidence); fs.closeSync(file); console.info('Responsive QA viewport: ' + evidence);
      for (let i = 0; i < 50 && !AppService.client; i++) { await new Promise<void>((resolve) => setTimeout(resolve, 100)); }
      if (AppLock.enabled && AppLock.locked) { await AppLock.unlock('123456'); }
      const router = this.child.getUIContext().getRouter();
      const ids: string[] = ['Movie', 'Series', 'Season', 'Episode'];
      const index = ids.indexOf(this.target);
      if (index >= 0 && AppService.client) {
        const item = await AppService.client.detail((index + 1).toString(16).padStart(32, '0'));
        await router.pushUrl({ url: 'pages/Detail', params: { item: item } });
      } else if (this.target === 'Player' && AppService.client) {
        const item = await AppService.client.detail('00000000000000000000000000000004');
        await router.pushUrl({ url: 'pages/Player', params: await AppService.detailPlayback(item) });
      } else if (this.target === 'Actor') {
        await router.pushUrl({ url: 'pages/Actor', params: { personId: '00000000000000000000000000000032', personName: '潮汐 · 演员测试' } });
      } else if (['Favorites', 'Settings', 'Accounts', 'Downloads'].includes(this.target)) {
        await router.pushUrl({ url: 'pages/' + this.target });
      } else if (this.target === 'Quick') {
        await router.pushUrl({ url: 'pages/Accounts', params: { quick: true, server: 'http://127.0.0.1:61822' } });
      } else if (this.target === 'Pin') {
        if (!AppLock.enabled) { await AppLock.configure('', '123456'); } AppLock.lock();
      } else if (this.target === 'Restore') { if (AppLock.enabled) { await AppLock.configure('123456', ''); }
      } else if (this.target === 'Login') { await AppService.logout(); }
    } catch (e) { console.error('Responsive QA setup failed: ' + (e as Error).message); }
  }
}

import UIAbility from '@ohos.app.ability.UIAbility';
import ConfigurationConstant from '@ohos.app.ability.ConfigurationConstant';
import window from '@ohos.window';
import { AppLock } from '../service/AppLock';
import { SystemPlayback } from '../service/SystemPlayback';
export default class EntryAbility extends UIAbility {
  private main: window.Window | undefined = undefined;
  onWindowStageCreate(stage: window.WindowStage): void {
    stage.loadContent('pages/Index', (error) => {
      if (error.code) { console.warn('CineIsle window content unavailable'); return; }
      this.configureWindow(stage);
    });
  }
  private async configureWindow(stage: window.WindowStage): Promise<void> {
    try {
      const main = await stage.getMainWindow(); this.main = main;
      AppLock.changed = () => {
        if (AppLock.locked) { SystemPlayback.current?.pause(); SystemPlayback.current?.stopPiP(); }
        this.main?.setWindowPrivacyMode(AppLock.enabled && AppLock.locked).catch(() => {});
      };
      this.context.getApplicationContext().setColorMode(ConfigurationConstant.ColorMode.COLOR_MODE_DARK);
      main.setWindowBackgroundColor('#13232E');
      await main.setWindowSystemBarProperties({ statusBarColor: '#0D1924', navigationBarColor: '#13232E',
        statusBarContentColor: '#F2F3FA', navigationBarContentColor: '#F2F3FA' });
    } catch (e) { console.warn('CineIsle window theme unavailable'); }
  }
  onBackground(): void { AppLock.background(); if (AppLock.enabled) { this.main?.setWindowPrivacyMode(true).catch(() => {}); } SystemPlayback.current?.background(); }
  onForeground(): void { AppLock.foreground(); this.main?.setWindowPrivacyMode(AppLock.enabled && AppLock.locked).catch(() => {}); SystemPlayback.current?.foreground(); }
  onDestroy(): void { AppLock.changed = undefined; SystemPlayback.current?.dispose(); }
}

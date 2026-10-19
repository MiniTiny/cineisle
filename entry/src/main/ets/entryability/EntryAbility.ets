import { Configuration } from '@ohos.app.ability.Configuration';
import { UiLayout } from '../utils/UiLayout';
import UIAbility from '@ohos.app.ability.UIAbility';
import ConfigurationConstant from '@ohos.app.ability.ConfigurationConstant';
import window from '@ohos.window';
import { AppService } from '../service/AppService';
import { AppLock } from '../service/AppLock';
import { PendingSync } from '../service/PendingSync';
import { SystemPlayback } from '../service/SystemPlayback';
import { PlaybackWindow } from '../service/PlaybackWindow';
export default class EntryAbility extends UIAbility {
  private main: window.Window | undefined = undefined;
  onConfigurationUpdated(configuration: Configuration): void {
    if (!configuration || configuration.fontSizeScale !== undefined) { AppStorage.setOrCreate('cineIsleFontScale', UiLayout.scale(configuration?.fontSizeScale)); }
    if (configuration?.direction !== undefined) { AppStorage.setOrCreate('cineIsleLandscape', configuration.direction === ConfigurationConstant.Direction.DIRECTION_HORIZONTAL); }
  }
  onWindowStageCreate(stage: window.WindowStage): void {
    this.onConfigurationUpdated(this.context.config);
    AppService.closePlayback = async () => { await SystemPlayback.current?.dispose(); await PlaybackWindow.current?.dispose(); };
    stage.loadContent('pages/Index', (error) => {
      if (error.code) { console.warn('CineIsle window content unavailable'); return; }
      this.configureWindow(stage);
    });
  }
  private async configureWindow(stage: window.WindowStage): Promise<void> {
    try {
      const main = await stage.getMainWindow(); this.main = main;
      AppLock.changed = () => {
        PlaybackWindow.current?.setLocked(AppLock.locked);
        if (AppLock.locked) { SystemPlayback.current?.pause(); SystemPlayback.current?.stopPiP(); }
        if (!AppLock.locked) { PendingSync.wake(); }
        this.main?.setWindowPrivacyMode(AppLock.enabled && AppLock.locked).catch(() => {});
      };
      this.context.getApplicationContext().setColorMode(ConfigurationConstant.ColorMode.COLOR_MODE_DARK);
      main.setWindowBackgroundColor('#13232E');
      await main.setWindowSystemBarProperties({ statusBarColor: '#0D1924', navigationBarColor: '#13232E',
        statusBarContentColor: '#F2F3FA', navigationBarContentColor: '#F2F3FA' });
    } catch (e) { console.warn('CineIsle window theme unavailable'); }
  }
  onBackground(): void { AppLock.background(); PendingSync.background(); PlaybackWindow.current?.background(); if (AppLock.enabled) { this.main?.setWindowPrivacyMode(true).catch(() => {}); } SystemPlayback.current?.background(); }
  onForeground(): void { AppLock.foreground(); PendingSync.foreground(); PlaybackWindow.current?.foreground(); this.main?.setWindowPrivacyMode(AppLock.enabled && AppLock.locked).catch(() => {}); SystemPlayback.current?.foreground(); }
  onDestroy(): void { PendingSync.background(); AppLock.changed = undefined; PlaybackWindow.current?.dispose(); SystemPlayback.current?.dispose(); }
}

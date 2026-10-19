// Native space/network declarations are deterministic fixtures, never device acceptance.
exports.install = platform => {
  if (!platform.has('@ohos.wallpaper')) platform.set('@ohos.wallpaper', { WallpaperType: { WALLPAPER_SYSTEM: 0, WALLPAPER_LOCKSCREEN: 1 }, async getColors() { return []; }, on() {}, off() {} });
  if (!platform.has('@ohos.i18n')) platform.set('@ohos.i18n', { System: { getSystemLanguage: () => 'zh-Hans', getAppPreferredLanguage: () => 'zh-Hans', setAppPreferredLanguage() {} } });
  if (!platform.has('@ohos.multimedia.image')) platform.set('@ohos.multimedia.image', { createImageSource() { throw Error('image decoder not installed in this fixture'); } });
  require('./sync-platform.cjs').install(platform);
  if (!platform.has('@ohos.file.statvfs')) platform.set('@ohos.file.statvfs', {});
  if (!platform.has('@ohos.net.connection')) platform.set('@ohos.net.connection', {});
  Object.assign(platform.get('@ohos.file.statvfs'), { getFreeSize: async () => 1024 ** 4 });
  Object.assign(platform.get('@ohos.net.connection'), { NetBearType: { BEARER_WIFI: 1, BEARER_CELLULAR: 0 },
    getDefaultNetSync: () => ({ netId: 1 }), getNetCapabilitiesSync: () => ({ bearerTypes: [1] }), isDefaultNetMeteredSync: () => false,
    getDefaultNet: async () => ({ netId: 1 }), getNetCapabilities: async () => ({ bearerTypes: [1] }) });
};

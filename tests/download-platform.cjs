// Native space/network declarations are deterministic fixtures, never device acceptance.
exports.install = platform => {
  if (!platform.has('@ohos.file.statvfs')) platform.set('@ohos.file.statvfs', {});
  if (!platform.has('@ohos.net.connection')) platform.set('@ohos.net.connection', {});
  Object.assign(platform.get('@ohos.file.statvfs'), { getFreeSize: async () => 1024 ** 4 });
  Object.assign(platform.get('@ohos.net.connection'), { NetBearType: { BEARER_WIFI: 1, BEARER_CELLULAR: 0 },
    getDefaultNet: async () => ({ netId: 1 }), getNetCapabilities: async () => ({ bearerTypes: [1] }) });
};

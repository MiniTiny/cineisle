import connection from '@ohos.net.connection';
import { DownloadNetwork } from '../utils/Downloads';

export class TrickplayNetwork {
  // The HTTP API cannot enforce the OS downloader's no-roaming policy. Fail closed on mobile
  // unless both mobile and roaming were explicitly allowed; playback requests are independent.
  static allowed(policy: DownloadNetwork): boolean {
    try {
      const net = connection.getDefaultNetSync(); if (net.netId <= 0) { return false; }
      const caps = connection.getNetCapabilitiesSync(net);
      if (policy.mobile && policy.roaming) { return true; }
      return caps.bearerTypes.includes(connection.NetBearType.BEARER_WIFI) && !caps.bearerTypes.includes(connection.NetBearType.BEARER_CELLULAR) && !connection.isDefaultNetMeteredSync();
    } catch (e) { return false; }
  }
}

import connection from '@ohos.net.connection';
import { DownloadNetwork } from '../utils/Downloads';

export class DownloadNetworkGuard {
  static async legacy(policy: DownloadNetwork): Promise<void> {
    if (policy.mobile) { return; }
    const net = await connection.getDefaultNet(); const caps = await connection.getNetCapabilities(net);
    if (!caps.bearerTypes.includes(connection.NetBearType.BEARER_WIFI)) { throw new Error('download_network_restricted'); }
  }
}

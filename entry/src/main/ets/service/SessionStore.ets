import asset from '@ohos.security.asset';
import util from '@ohos.util';
import { BusinessError } from '@ohos.base';
import { Session } from '../model/Models';
import { ProductIdentity } from '../utils/ProductIdentity';

export class SessionStore {
  private static alias(): Uint8Array { return new util.TextEncoder().encodeInto(ProductIdentity.SESSION_ALIAS); }

  static async load(): Promise<Session | undefined> {
    const query: asset.AssetMap = new Map();
    query.set(asset.Tag.ALIAS, SessionStore.alias());
    query.set(asset.Tag.RETURN_TYPE, asset.ReturnType.ALL);
    try {
      const result = await asset.query(query);
      if (result.length === 0) { return undefined; }
      const secret = result[0].get(asset.Tag.SECRET) as Uint8Array;
      return JSON.parse(new util.TextDecoder().decodeToString(secret)) as Session;
    } catch (e) {
      if ((e as BusinessError).code === 24000002) { return undefined; }
      throw new Error('session_read_failed');
    }
  }

  static async save(session: Session): Promise<void> {
    const attrs: asset.AssetMap = new Map();
    attrs.set(asset.Tag.ALIAS, SessionStore.alias());
    attrs.set(asset.Tag.SECRET, new util.TextEncoder().encodeInto(JSON.stringify(session)));
    attrs.set(asset.Tag.ACCESSIBILITY, asset.Accessibility.DEVICE_UNLOCKED);
    attrs.set(asset.Tag.CONFLICT_RESOLUTION, asset.ConflictResolution.OVERWRITE);
    await asset.add(attrs);
  }

  static async clear(): Promise<void> {
    const query: asset.AssetMap = new Map();
    query.set(asset.Tag.ALIAS, SessionStore.alias());
    try { await asset.remove(query); } catch (e) {
      if ((e as BusinessError).code !== 24000002) { throw new Error('session_clear_failed'); }
    }
  }
}

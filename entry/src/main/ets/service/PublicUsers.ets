import { JellyfinClient, PublicUser } from './JellyfinClient';
import { SessionStore } from './SessionStore';
import { ServerProfile } from '../utils/Accounts';

export async function loadPublicUsers(server: string): Promise<PublicUser[]> {
  const address = server.trim().replace(/\/+$/, '');
  const profile = (await SessionStore.servers()).find((value: ServerProfile) => value.addresses.includes(address));
  // This client has no token. A saved server must pass the same anonymous identity check as login.
  const client = await JellyfinClient.quickClient(address, profile?.id ?? '', profile?.addresses ?? []);
  return client.publicUsers();
}

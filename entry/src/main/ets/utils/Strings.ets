import resourceManager from '@ohos.resourceManager';
import { AppFailure } from './Failures';

let resources: resourceManager.ResourceManager | undefined = undefined;
export function initializeStrings(manager: resourceManager.ResourceManager): void { resources = manager; }
export function text(name: string, ...args: Array<string | number>): string {
  try { return resources?.getStringByNameSync(name, ...args) ?? name; } catch (e) { return name; }
}
export function errorText(error: Error): string {
  if (error instanceof AppFailure) { return text(error.failureCode, ...error.params); }
  const message = error.message;
  return /^[a-z_]+$/.test(message) ? text(message) : message;
}

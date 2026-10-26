// This is a JSON body value, never an Authorization header or a device identity.
export class DeviceNameRules {
  static readonly maximumInputCodeUnits: number = 64;
}

export function deviceNameValue(value: string): string {
  if (typeof value !== 'string' || value.length > DeviceNameRules.maximumInputCodeUnits || /[\u0000-\u001f\u007f]/.test(value)) { throw new Error('device_name_invalid'); }
  return value.trim();
}

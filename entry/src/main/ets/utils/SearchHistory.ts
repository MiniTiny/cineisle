// Search history storage policy. Length uses UTF-16 code units for format compatibility.
export class SearchHistoryRules {
  static readonly maxTermCodeUnits: number = 128;
  static readonly maxEntries: number = 20;
}

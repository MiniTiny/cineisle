// Route strings and numeric tab identities are persisted/platform contracts.
export class AppRoutes {
  static readonly index: string = 'pages/Index';
  static readonly detail: string = 'pages/Detail';
  static readonly collection: string = 'pages/Collection';
  static readonly player: string = 'pages/Player';
  static readonly favorites: string = 'pages/Favorites';
  static readonly downloads: string = 'pages/Downloads';
  static readonly actor: string = 'pages/Actor';
  static readonly settings: string = 'pages/Settings';
  static readonly accounts: string = 'pages/Accounts';
  static readonly captionSettings: string = 'pages/CaptionSettings';
}

export enum MainTab { Discover = 0, Home = 1, Library = 2, Actors = 3, More = 4 }
// Library is transient; reopening it restores More, matching the existing stored format.
export const persistedTabs: number[] = [MainTab.Discover, MainTab.Home, MainTab.Actors, MainTab.More];

export function storedTab(tab: number): number { return tab === MainTab.Library ? MainTab.More : tab; }
export function tabSelected(tab: number, index: number): boolean {
  return tab === index || (index === MainTab.More && tab === MainTab.Library);
}

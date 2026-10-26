const recipes=[
  {
    "id": "tab-Discover--1",
    "file": "entry/src/main/ets/utils/Navigation.ts",
    "old": "Discover = 0",
    "replacement": "Discover = -1",
    "name": "navigation independent persisted tab 0",
    "suite": "navigation-contract.test.cjs"
  },
  {
    "id": "tab-Discover-1",
    "file": "entry/src/main/ets/utils/Navigation.ts",
    "old": "Discover = 0",
    "replacement": "Discover = 1",
    "name": "navigation independent persisted tab 0",
    "suite": "navigation-contract.test.cjs"
  },
  {
    "id": "tab-Home--1",
    "file": "entry/src/main/ets/utils/Navigation.ts",
    "old": "Home = 1",
    "replacement": "Home = 0",
    "name": "navigation independent persisted tab 1",
    "suite": "navigation-contract.test.cjs"
  },
  {
    "id": "tab-Home-1",
    "file": "entry/src/main/ets/utils/Navigation.ts",
    "old": "Home = 1",
    "replacement": "Home = 2",
    "name": "navigation independent persisted tab 1",
    "suite": "navigation-contract.test.cjs"
  },
  {
    "id": "tab-Library--1",
    "file": "entry/src/main/ets/utils/Navigation.ts",
    "old": "Library = 2",
    "replacement": "Library = 1",
    "name": "navigation actual tab 2",
    "suite": "navigation-contract.test.cjs"
  },
  {
    "id": "tab-Library-1",
    "file": "entry/src/main/ets/utils/Navigation.ts",
    "old": "Library = 2",
    "replacement": "Library = 3",
    "name": "navigation actual tab 2",
    "suite": "navigation-contract.test.cjs"
  },
  {
    "id": "tab-Actors--1",
    "file": "entry/src/main/ets/utils/Navigation.ts",
    "old": "Actors = 3",
    "replacement": "Actors = 2",
    "name": "navigation independent persisted tab 3",
    "suite": "navigation-contract.test.cjs"
  },
  {
    "id": "tab-Actors-1",
    "file": "entry/src/main/ets/utils/Navigation.ts",
    "old": "Actors = 3",
    "replacement": "Actors = 4",
    "name": "navigation independent persisted tab 3",
    "suite": "navigation-contract.test.cjs"
  },
  {
    "id": "tab-More--1",
    "file": "entry/src/main/ets/utils/Navigation.ts",
    "old": "More = 4",
    "replacement": "More = 3",
    "name": "navigation independent persisted tab 4",
    "suite": "navigation-contract.test.cjs"
  },
  {
    "id": "tab-More-1",
    "file": "entry/src/main/ets/utils/Navigation.ts",
    "old": "More = 4",
    "replacement": "More = 5",
    "name": "navigation independent persisted tab 4",
    "suite": "navigation-contract.test.cjs"
  },
  {
    "id": "route-index",
    "file": "entry/src/main/ets/utils/Navigation.ts",
    "old": "index: string = 'pages/Index'",
    "replacement": "index: string = 'pages/Drift'",
    "name": "navigation actual native loadContent entry",
    "suite": "navigation-contract.test.cjs"
  },
  {
    "id": "route-detail",
    "file": "entry/src/main/ets/utils/Navigation.ts",
    "old": "detail: string = 'pages/Detail'",
    "replacement": "detail: string = 'pages/Drift'",
    "name": "navigation actual open Movie",
    "suite": "navigation-contract.test.cjs"
  },
  {
    "id": "route-collection",
    "file": "entry/src/main/ets/utils/Navigation.ts",
    "old": "collection: string = 'pages/Collection'",
    "replacement": "collection: string = 'pages/Drift'",
    "name": "navigation actual open BoxSet",
    "suite": "navigation-contract.test.cjs"
  },
  {
    "id": "route-player",
    "file": "entry/src/main/ets/utils/Navigation.ts",
    "old": "player: string = 'pages/Player'",
    "replacement": "player: string = 'pages/Drift'",
    "name": "navigation actual SDK downloaded player route",
    "suite": "navigation-contract.test.cjs"
  },
  {
    "id": "route-favorites",
    "file": "entry/src/main/ets/utils/Navigation.ts",
    "old": "favorites: string = 'pages/Favorites'",
    "replacement": "favorites: string = 'pages/Drift'",
    "name": "navigation actual SDK route favorites",
    "suite": "navigation-contract.test.cjs"
  },
  {
    "id": "route-downloads",
    "file": "entry/src/main/ets/utils/Navigation.ts",
    "old": "downloads: string = 'pages/Downloads'",
    "replacement": "downloads: string = 'pages/Drift'",
    "name": "navigation actual SDK route downloads",
    "suite": "navigation-contract.test.cjs"
  },
  {
    "id": "route-actor",
    "file": "entry/src/main/ets/utils/Navigation.ts",
    "old": "actor: string = 'pages/Actor'",
    "replacement": "actor: string = 'pages/Drift'",
    "name": "navigation actual SDK actor route preserves params",
    "suite": "navigation-contract.test.cjs"
  },
  {
    "id": "route-settings",
    "file": "entry/src/main/ets/utils/Navigation.ts",
    "old": "settings: string = 'pages/Settings'",
    "replacement": "settings: string = 'pages/Drift'",
    "name": "navigation actual SDK route settings",
    "suite": "navigation-contract.test.cjs"
  },
  {
    "id": "route-accounts",
    "file": "entry/src/main/ets/utils/Navigation.ts",
    "old": "accounts: string = 'pages/Accounts'",
    "replacement": "accounts: string = 'pages/Drift'",
    "name": "navigation actual SDK route accounts_servers",
    "suite": "navigation-contract.test.cjs"
  },
  {
    "id": "route-captionSettings",
    "file": "entry/src/main/ets/utils/Navigation.ts",
    "old": "captionSettings: string = 'pages/CaptionSettings'",
    "replacement": "captionSettings: string = 'pages/Drift'",
    "name": "navigation actual SDK caption settings route",
    "suite": "navigation-contract.test.cjs"
  },
  {
    "id": "stored-mapping-remove",
    "file": "entry/src/main/ets/utils/Navigation.ts",
    "old": "tab === MainTab.Library ? MainTab.More : tab",
    "replacement": "tab",
    "name": "navigation actual tab 2",
    "suite": "navigation-contract.test.cjs"
  },
  {
    "id": "stored-mapping-consumer",
    "file": "entry/src/main/ets/pages/Index.ets",
    "old": "state.tab = storedTab(index)",
    "replacement": "state.tab = index",
    "name": "navigation actual tab 2",
    "suite": "navigation-contract.test.cjs"
  },
  {
    "id": "selected-alias-remove",
    "file": "entry/src/main/ets/utils/Navigation.ts",
    "old": "(index === MainTab.More && tab === MainTab.Library)",
    "replacement": "false",
    "name": "navigation nested library highlights More independently",
    "suite": "navigation-contract.test.cjs"
  },
  {
    "id": "selected-consumer-bypass",
    "file": "entry/src/main/ets/pages/Index.ets",
    "old": "Image(tabSelected(this.tab, index) ? active : muted)",
    "replacement": "Image(this.tab === index ? active : muted)",
    "name": "navigation nested library highlights More independently",
    "suite": "navigation-contract.test.cjs"
  },
  {
    "id": "persisted-validation-remove",
    "file": "entry/src/main/ets/utils/Experience.ts",
    "old": "persistedTabs.includes(value.tab)",
    "replacement": "true",
    "name": "navigation independent persisted tab 2",
    "suite": "navigation-contract.test.cjs"
  }
];
const controls=[
  {
    "name": "navigation actual native loadContent entry",
    "phase": "stage-load",
    "nativeInit": "stage",
    "requiredCalls": {
      "ability-load": 1
    },
    "scope": "navigation",
    "suite": "navigation-contract.test.cjs"
  },
  {
    "name": "navigation actual tab 2",
    "phase": "file-write",
    "requiredCalls": {
      "file-tryLock": 1
    },
    "details": {
      "filename": "experience.json.tmp",
      "stage": "business"
    },
    "scope": "navigation",
    "suite": "navigation-contract.test.cjs"
  },
  {
    "name": "navigation actual SDK route settings",
    "phase": "ui-compile",
    "scope": "navigation",
    "suite": "navigation-contract.test.cjs"
  },
  {
    "name": "navigation independent persisted tab 2",
    "phase": "setup",
    "scope": "navigation",
    "suite": "navigation-contract.test.cjs"
  }
];
module.exports={recipes,controls,extraScopes:['entry/src/main/resources'],scope:'navigation',fixture:'tests/navigation-fixture.cjs',earlyPhase:'file-write',earlyOld:'await t.action(check);',earlyReplacement:"f.trace().call('file-write',()=>{});await t.action(check);",selfFaults:[{id:'stage-init-capture',phase:'stage-load',file:'tests/navigation-contract.test.cjs',old:"f.trace().call('stage-load',()=>{",replacement:"((phase,operation)=>operation())('stage-load',()=>{"}]};

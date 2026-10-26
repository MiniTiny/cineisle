const recipes=[
  {
    "id": "menu-production-route-drift",
    "file": "entry/src/main/ets/utils/Navigation.ts",
    "old": "favorites: string = 'pages/Favorites'",
    "replacement": "favorites: string = 'pages/Drift'",
    "name": "menu navigation uses production routes and tab identity",
    "suite": "menu-navigation-contract.test.cjs"
  },
  {
    "id": "menu-production-tab-drift",
    "file": "entry/src/main/ets/utils/Navigation.ts",
    "old": "Library = 2",
    "replacement": "Library = 3",
    "name": "menu navigation uses production routes and tab identity",
    "suite": "menu-navigation-contract.test.cjs"
  }
];
const controls=[
  {
    "scope": "menu-navigation",
    "suite": "menu-navigation-contract.test.cjs",
    "name": "menu navigation uses production routes and tab identity",
    "phase": "ui-compile"
  },
  {
    "scope": "menu-navigation",
    "suite": "menu-navigation-contract.test.cjs",
    "name": "menu navigation uses production routes and tab identity",
    "phase": "ui-render",
    "requiredCalls": {
      "ui-compile": 1
    }
  },
  {
    "scope": "menu-navigation",
    "suite": "menu-navigation-contract.test.cjs",
    "name": "menu navigation uses production routes and tab identity",
    "phase": "setup"
  }
];
module.exports={recipes,controls,extraScopes:['entry/src/main/resources'],scope:'menu-navigation',fixture:'tests/menu-navigation-fixture.cjs',earlyPhase:'ui-render',earlyOld:'await test.action(check);',earlyReplacement:"f.trace().call('ui-render',()=>{});await test.action(check);"};

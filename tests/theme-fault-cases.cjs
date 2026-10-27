const recipes=[
  {
    "id": "foreground-drift",
    "file": "entry/src/main/ets/utils/UiPalette.ets",
    "old": "foreground: ResourceColor = '#F2F3FA';",
    "replacement": "foreground: ResourceColor = '#F2F3FB';",
    "name": "theme baseline BrandHeader false false 1",
    "suite": "theme-contract.test.cjs"
  },
  {
    "id": "onAction-drift",
    "file": "entry/src/main/ets/utils/UiPalette.ets",
    "old": "onAction: ResourceColor = '#F2F3FA';",
    "replacement": "onAction: ResourceColor = '#F2F3FB';",
    "name": "theme default primary text stays original white",
    "suite": "theme-contract.test.cjs"
  },
  {
    "id": "amoledBackground-drift",
    "file": "entry/src/main/ets/utils/UiPalette.ets",
    "old": "amoledBackground: ResourceColor = '#000000';",
    "replacement": "amoledBackground: ResourceColor = '#000001';",
    "name": "theme baseline Settings true false 1",
    "suite": "theme-contract.test.cjs"
  },
  {
    "id": "foreground-consumer-bypass",
    "file": "entry/src/main/ets/components/BrandHeader.ets",
    "old": ".fontColor(this.palette.foreground)",
    "replacement": ".fontColor('#F2F3FA')",
    "name": "theme semantic foreground BrandHeader",
    "suite": "theme-contract.test.cjs"
  },
  {
    "id": "foreground-wrong-role",
    "file": "entry/src/main/ets/components/BrandHeader.ets",
    "old": ".fontColor(this.palette.foreground)",
    "replacement": ".fontColor(this.palette.onAction)",
    "name": "theme semantic foreground BrandHeader",
    "suite": "theme-contract.test.cjs"
  },
  {
    "id": "AMOLED-consumer-bypass",
    "file": "entry/src/main/ets/components/BrandChoice.ets",
    "old": ".backgroundColor((this.amoled ? this.palette.amoledBackground : this.palette.surface))",
    "replacement": ".backgroundColor((this.amoled ? '#000000' : this.palette.surface))",
    "name": "theme semantic AMOLED BrandChoice",
    "suite": "theme-contract.test.cjs"
  },
  {
    "id": "primary-wrong-role",
    "file": "entry/src/main/ets/components/BrandButton.ets",
    "old": "this.primary ? this.palette.onAction : this.palette.foreground",
    "replacement": "this.palette.foreground",
    "name": "theme button text role primary",
    "suite": "theme-contract.test.cjs"
  },
  {
    "id": "video-role-coupling",
    "file": "entry/src/main/ets/pages/Player.ets",
    "old": ".id('playbackFrameCover').width('100%').height('100%').backgroundColor('#000000')",
    "replacement": ".id('playbackFrameCover').width('100%').height('100%').backgroundColor(this.palette.amoledBackground)",
    "name": "theme video canvas and night mask stay independent black",
    "suite": "theme-contract.test.cjs"
  }
];
const controls=[
  {
    "name": "theme semantic foreground BrandHeader",
    "phase": "ui-compile",
    "scope": "theme-contract",
    "suite": "theme-contract.test.cjs"
  },
  {
    "name": "theme semantic foreground BrandHeader",
    "phase": "ui-render",
    "requiredCalls": {
      "ui-compile": 1
    },
    "scope": "theme-contract",
    "suite": "theme-contract.test.cjs"
  },
  {
    "name": "theme button text role primary",
    "phase": "setup",
    "scope": "theme-contract",
    "suite": "theme-contract.test.cjs"
  }
];
module.exports={recipes,controls,extraScopes:['entry/src/main/resources'],scope:'theme-contract',fixture:'tests/theme-contract-fixture.cjs',earlyPhase:'ui-render',earlyOld:'await t.action(check);',earlyReplacement:"f.trace().call('ui-render',()=>{});await t.action(check);"};

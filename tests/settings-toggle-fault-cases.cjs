const recipes=[
  {
    "id": "disabled-protection-bypass",
    "file": "entry/src/main/ets/components/SettingsToggle.ets",
    "old": ".enabled(this.available)",
    "replacement": ".enabled(true)",
    "name": "setting toggle actual disabled player_seek_gesture",
    "suite": "settings-toggle-contract.test.cjs"
  },
  {
    "id": "selected-binding-drift",
    "file": "entry/src/main/ets/components/SettingsToggle.ets",
    "old": ".select(this.selected)",
    "replacement": ".select(!this.selected)",
    "name": "setting toggle actual player gestures",
    "suite": "settings-toggle-contract.test.cjs"
  },
  {
    "id": "callback-remove",
    "file": "entry/src/main/ets/components/SettingsToggle.ets",
    "old": "this.onChange(value)",
    "replacement": "undefined",
    "name": "setting toggle actual player autoPiP",
    "suite": "settings-toggle-contract.test.cjs"
  },
  {
    "id": "row-spacing",
    "file": "entry/src/main/ets/components/SettingsToggle.ets",
    "old": "Row({ space: 12 })",
    "replacement": "Row({ space: 8 })",
    "name": "setting toggle actual layout 320 640 1",
    "suite": "settings-toggle-contract.test.cjs"
  },
  {
    "id": "label-size",
    "file": "entry/src/main/ets/components/SettingsToggle.ets",
    "old": ".fontSize(14)",
    "replacement": ".fontSize(15)",
    "name": "setting toggle actual layout 320 640 1",
    "suite": "settings-toggle-contract.test.cjs"
  },
  {
    "id": "label-weight",
    "file": "entry/src/main/ets/components/SettingsToggle.ets",
    "old": ".layoutWeight(1)",
    "replacement": ".layoutWeight(0)",
    "name": "setting toggle actual layout 320 640 1",
    "suite": "settings-toggle-contract.test.cjs"
  },
  {
    "id": "row-width",
    "file": "entry/src/main/ets/components/SettingsToggle.ets",
    "old": ".width('100%')",
    "replacement": ".width('80%')",
    "name": "setting toggle actual layout 320 640 1",
    "suite": "settings-toggle-contract.test.cjs"
  },
  {
    "id": "selection-color",
    "file": "entry/src/main/ets/components/SettingsToggle.ets",
    "old": ".selectedColor(this.palette.action)",
    "replacement": ".selectedColor(this.palette.muted)",
    "name": "setting toggle actual layout 320 640 1",
    "suite": "settings-toggle-contract.test.cjs"
  },
  {
    "id": "page-availability-remove",
    "file": "entry/src/main/ets/pages/Settings.ets",
    "old": "selected: this.playerUi.seek, available: this.playerUi.gestures",
    "replacement": "selected: this.playerUi.seek, available: true",
    "name": "setting toggle actual disabled player_seek_gesture",
    "suite": "settings-toggle-contract.test.cjs"
  }
];
const controls=[
  {
    "name": "setting toggle actual player gestures",
    "phase": "ui-compile",
    "scope": "settings-toggle",
    "suite": "settings-toggle-contract.test.cjs"
  },
  {
    "name": "setting toggle actual player autoPiP",
    "phase": "file-write",
    "requiredCalls": {
      "ui-render": 1,
      "file-tryLock": 1
    },
    "details": {
      "filename": "experience.json.tmp",
      "stage": "business"
    },
    "scope": "settings-toggle",
    "suite": "settings-toggle-contract.test.cjs"
  },
  {
    "name": "setting toggle actual layout 320 640 1",
    "phase": "setup",
    "scope": "settings-toggle",
    "suite": "settings-toggle-contract.test.cjs"
  }
];
module.exports={recipes,controls,extraScopes:['entry/src/main/resources'],scope:'settings-toggle',fixture:'tests/settings-toggle-fixture.cjs',earlyPhase:'file-write',earlyOld:'await t.action(check);',earlyReplacement:"f.trace().call('file-write',()=>{});await t.action(check);"};

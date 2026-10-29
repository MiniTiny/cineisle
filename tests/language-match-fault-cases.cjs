const recipes = [
  {
    "id": "tag-limit--1",
    "file": "entry/src/main/ets/utils/PlaybackPreferences.ts",
    "old": "maximumTagCodeUnits: number = 63",
    "replacement": "maximumTagCodeUnits: number = 62",
    "name": "language persisted admission 63",
    "suite": "language-match-contract.test.cjs"
  },
  {
    "id": "tag-limit-1",
    "file": "entry/src/main/ets/utils/PlaybackPreferences.ts",
    "old": "maximumTagCodeUnits: number = 63",
    "replacement": "maximumTagCodeUnits: number = 64",
    "name": "language real player metadata admission 64",
    "suite": "language-match-contract.test.cjs"
  },
  {
    "id": "tag-guard-remove",
    "file": "entry/src/main/ets/utils/PlaybackPreferences.ts",
    "old": "tag.length > PlaybackLanguageRules.maximumTagCodeUnits",
    "replacement": "false",
    "name": "language normalized admission 64",
    "suite": "language-match-contract.test.cjs"
  },
  {
    "id": "tag-compare",
    "file": "entry/src/main/ets/utils/PlaybackPreferences.ts",
    "old": "tag.length > PlaybackLanguageRules.maximumTagCodeUnits",
    "replacement": "tag.length >= PlaybackLanguageRules.maximumTagCodeUnits",
    "name": "language normalized admission 63",
    "suite": "language-match-contract.test.cjs"
  },
  {
    "id": "exactScore-1",
    "file": "entry/src/main/ets/utils/PlaybackPreferences.ts",
    "old": "exactScore: number = 100",
    "replacement": "exactScore: number = 99",
    "name": "language private score exact",
    "suite": "language-match-contract.test.cjs"
  },
  {
    "id": "exactScore1",
    "file": "entry/src/main/ets/utils/PlaybackPreferences.ts",
    "old": "exactScore: number = 100",
    "replacement": "exactScore: number = 101",
    "name": "language private score exact",
    "suite": "language-match-contract.test.cjs"
  },
  {
    "id": "compatibleScriptScore-1",
    "file": "entry/src/main/ets/utils/PlaybackPreferences.ts",
    "old": "compatibleScriptScore: number = 80",
    "replacement": "compatibleScriptScore: number = 79",
    "name": "language private score script",
    "suite": "language-match-contract.test.cjs"
  },
  {
    "id": "compatibleScriptScore1",
    "file": "entry/src/main/ets/utils/PlaybackPreferences.ts",
    "old": "compatibleScriptScore: number = 80",
    "replacement": "compatibleScriptScore: number = 81",
    "name": "language private score script",
    "suite": "language-match-contract.test.cjs"
  },
  {
    "id": "regionalFallbackScore-1",
    "file": "entry/src/main/ets/utils/PlaybackPreferences.ts",
    "old": "regionalFallbackScore: number = 40",
    "replacement": "regionalFallbackScore: number = 39",
    "name": "language private score regional fallback",
    "suite": "language-match-contract.test.cjs"
  },
  {
    "id": "regionalFallbackScore1",
    "file": "entry/src/main/ets/utils/PlaybackPreferences.ts",
    "old": "regionalFallbackScore: number = 40",
    "replacement": "regionalFallbackScore: number = 41",
    "name": "language private score regional fallback",
    "suite": "language-match-contract.test.cjs"
  },
  {
    "id": "baseFallbackScore-1",
    "file": "entry/src/main/ets/utils/PlaybackPreferences.ts",
    "old": "baseFallbackScore: number = 50",
    "replacement": "baseFallbackScore: number = 49",
    "name": "language private score base fallback",
    "suite": "language-match-contract.test.cjs"
  },
  {
    "id": "baseFallbackScore1",
    "file": "entry/src/main/ets/utils/PlaybackPreferences.ts",
    "old": "baseFallbackScore: number = 50",
    "replacement": "baseFallbackScore: number = 51",
    "name": "language private score base fallback",
    "suite": "language-match-contract.test.cjs"
  },
  {
    "id": "winner-equal-overwrite",
    "file": "entry/src/main/ets/utils/PlaybackPreferences.ts",
    "old": "if (ranked > best)",
    "replacement": "if (ranked >= best)",
    "name": "language real player first equal remains stable",
    "suite": "language-match-contract.test.cjs"
  },
  {
    "id": "selected-tie-remove",
    "file": "entry/src/main/ets/utils/PlaybackPreferences.ts",
    "old": "(track.key === selected ? 1 : 0)",
    "replacement": "0",
    "name": "language real player selected equal wins",
    "suite": "language-match-contract.test.cjs"
  },
  {
    "id": "script-conflict-remove",
    "file": "entry/src/main/ets/utils/PlaybackPreferences.ts",
    "old": "if (wantedScript && actualScript && wantedScript !== actualScript)",
    "replacement": "if (false)",
    "name": "language real player conflicting script remains unmatched",
    "suite": "language-match-contract.test.cjs"
  }
];
recipes.push(...[
  {
    "id": "editor-audioLanguage-62",
    "file": "entry/src/main/ets/pages/Player.ets",
    "old": "TextInput({ text: this.audioLanguage, placeholder: text('playback_language_placeholder') })\n        .height(UiLayout.buttonHeight(this.fontScale)).maxLength(PlaybackLanguageInput.maximumRawCodeUnits).fontSize(14).fontColor(this.palette.foreground)",
    "replacement": "TextInput({ text: this.audioLanguage, placeholder: text('playback_language_placeholder') })\n        .height(UiLayout.buttonHeight(this.fontScale)).maxLength(62).fontSize(14).fontColor(this.palette.foreground)",
    "name": "language editor raw limit audioLanguage",
    "suite": "language-match-contract.test.cjs"
  },
  {
    "id": "editor-audioLanguage-64",
    "file": "entry/src/main/ets/pages/Player.ets",
    "old": "TextInput({ text: this.audioLanguage, placeholder: text('playback_language_placeholder') })\n        .height(UiLayout.buttonHeight(this.fontScale)).maxLength(PlaybackLanguageInput.maximumRawCodeUnits).fontSize(14).fontColor(this.palette.foreground)",
    "replacement": "TextInput({ text: this.audioLanguage, placeholder: text('playback_language_placeholder') })\n        .height(UiLayout.buttonHeight(this.fontScale)).maxLength(64).fontSize(14).fontColor(this.palette.foreground)",
    "name": "language editor raw limit audioLanguage",
    "suite": "language-match-contract.test.cjs"
  },
  {
    "id": "editor-subtitleLanguage-62",
    "file": "entry/src/main/ets/pages/Player.ets",
    "old": "TextInput({ text: this.subtitleLanguage, placeholder: text('playback_language_placeholder') })\n        .height(UiLayout.buttonHeight(this.fontScale)).maxLength(PlaybackLanguageInput.maximumRawCodeUnits).fontSize(14).fontColor(this.palette.foreground)",
    "replacement": "TextInput({ text: this.subtitleLanguage, placeholder: text('playback_language_placeholder') })\n        .height(UiLayout.buttonHeight(this.fontScale)).maxLength(62).fontSize(14).fontColor(this.palette.foreground)",
    "name": "language editor raw limit subtitleLanguage",
    "suite": "language-match-contract.test.cjs"
  },
  {
    "id": "editor-subtitleLanguage-64",
    "file": "entry/src/main/ets/pages/Player.ets",
    "old": "TextInput({ text: this.subtitleLanguage, placeholder: text('playback_language_placeholder') })\n        .height(UiLayout.buttonHeight(this.fontScale)).maxLength(PlaybackLanguageInput.maximumRawCodeUnits).fontSize(14).fontColor(this.palette.foreground)",
    "replacement": "TextInput({ text: this.subtitleLanguage, placeholder: text('playback_language_placeholder') })\n        .height(UiLayout.buttonHeight(this.fontScale)).maxLength(64).fontSize(14).fontColor(this.palette.foreground)",
    "name": "language editor raw limit subtitleLanguage",
    "suite": "language-match-contract.test.cjs"
  },
  {
    "id": "editor-raw-rule-62",
    "file": "entry/src/main/ets/utils/PlaybackPreferences.ts",
    "old": "maximumRawCodeUnits: number = 63",
    "replacement": "maximumRawCodeUnits: number = 62",
    "name": "language editor raw limit audioLanguage",
    "suite": "language-match-contract.test.cjs"
  },
  {
    "id": "editor-raw-rule-64",
    "file": "entry/src/main/ets/utils/PlaybackPreferences.ts",
    "old": "maximumRawCodeUnits: number = 63",
    "replacement": "maximumRawCodeUnits: number = 64",
    "name": "language editor raw limit audioLanguage",
    "suite": "language-match-contract.test.cjs"
  }
]);
const controls = [
  {phase:"ui-compile", name:"language editor raw limit audioLanguage", suite:"language-match-contract.test.cjs", scope:"language-match"},
  {
    "phase": "preferences-open",
    "name": "language persisted admission 63",
    "suite": "language-match-contract.test.cjs",
    "scope": "language-match",
    "nativeInit": "preferences"
  },
  {
    "phase": "preferences-flush",
    "name": "language persisted admission 63",
    "suite": "language-match-contract.test.cjs",
    "scope": "language-match",
    "requiredCalls": {
      "preferences-put": 1
    }
  },
  {
    "phase": "native-player-create",
    "name": "language real player exact beats selected base",
    "suite": "language-match-contract.test.cjs",
    "scope": "language-match",
    "nativeInit": "player"
  },
  {
    "phase": "native-track-select",
    "name": "language real player exact beats selected base",
    "suite": "language-match-contract.test.cjs",
    "scope": "language-match",
    "requiredCalls": {
      "native-player-create": 1
    }
  },
  {
    "phase": "score-compile",
    "name": "language private score exact",
    "suite": "language-match-contract.test.cjs",
    "scope": "language-match"
  },
  {
    "phase": "setup",
    "name": "language normalized admission 63",
    "suite": "language-match-contract.test.cjs",
    "scope": "language-match"
  }
];
module.exports={recipes,controls,extraScopes:['entry/src/main/resources'],scope:'language-match',fixture:'tests/language-match-contract-fixture.cjs',earlyPhase:'native-track-select',earlyOld:'try { privateScore = compileScore(); await test.action(check); }',earlyReplacement:"try { trace.call('native-track-select',()=>{}); privateScore = compileScore(); await test.action(check); }",selfFaults:[{id:'native-preferences-init-observer',phase:'preferences-open',file:'tests/language-match-contract-fixture.cjs',old:"(...args) => trace.call('preferences-open', async () => {",replacement:"(...args) => ((phase,operation)=>operation())('preferences-open', async () => {",status:'invalid'},{id:'native-player-init-observer',phase:'native-player-create',file:'tests/language-match-contract-fixture.cjs',old:"() => trace.call('native-player-create', async () => {",replacement:"() => ((phase,operation)=>operation())('native-player-create', async () => {",status:'detected'}]};

const recipes = [
  {
    "id": "title-budget--1",
    "file": "entry/src/main/ets/service/OfflineSubtitles.ets",
    "old": "maximumTitleCodeUnits: number = 256",
    "replacement": "maximumTitleCodeUnits: number = 255",
    "name": "retry subtitle title 256",
    "suite": "subtitle-metadata-contract.test.cjs"
  },
  {
    "id": "title-budget-1",
    "file": "entry/src/main/ets/service/OfflineSubtitles.ets",
    "old": "maximumTitleCodeUnits: number = 256",
    "replacement": "maximumTitleCodeUnits: number = 257",
    "name": "retry subtitle title 257",
    "suite": "subtitle-metadata-contract.test.cjs"
  },
  {
    "id": "title-truncate-remove",
    "file": "entry/src/main/ets/service/OfflineSubtitles.ets",
    "old": "(stream.DisplayTitle || stream.Language || stream.Codec || '').slice(0, OfflineSubtitles.maximumTitleCodeUnits)",
    "replacement": "(stream.DisplayTitle || stream.Language || stream.Codec || '')",
    "name": "plan subtitle title 257",
    "suite": "subtitle-metadata-contract.test.cjs"
  },
  {
    "id": "title-codepoint-truncate",
    "file": "entry/src/main/ets/service/OfflineSubtitles.ets",
    "old": "(stream.DisplayTitle || stream.Language || stream.Codec || '').slice(0, OfflineSubtitles.maximumTitleCodeUnits)",
    "replacement": "Array.from((stream.DisplayTitle || stream.Language || stream.Codec || '')).slice(0, OfflineSubtitles.maximumTitleCodeUnits).join('')",
    "name": "retry subtitle title splits UTF16 surrogate pair",
    "suite": "subtitle-metadata-contract.test.cjs"
  },
  {
    "id": "language-budget--1",
    "file": "entry/src/main/ets/service/OfflineSubtitles.ets",
    "old": "maximumLanguageCodeUnits: number = 63",
    "replacement": "maximumLanguageCodeUnits: number = 62",
    "name": "retry subtitle language 63",
    "suite": "subtitle-metadata-contract.test.cjs"
  },
  {
    "id": "language-budget-1",
    "file": "entry/src/main/ets/service/OfflineSubtitles.ets",
    "old": "maximumLanguageCodeUnits: number = 63",
    "replacement": "maximumLanguageCodeUnits: number = 64",
    "name": "retry subtitle language 64",
    "suite": "subtitle-metadata-contract.test.cjs"
  },
  {
    "id": "language-truncate-remove",
    "file": "entry/src/main/ets/service/OfflineSubtitles.ets",
    "old": "(stream.Language ?? '').slice(0, OfflineSubtitles.maximumLanguageCodeUnits)",
    "replacement": "(stream.Language ?? '')",
    "name": "plan subtitle language 64",
    "suite": "subtitle-metadata-contract.test.cjs"
  },
  {
    "id": "language-codepoint-truncate",
    "file": "entry/src/main/ets/service/OfflineSubtitles.ets",
    "old": "(stream.Language ?? '').slice(0, OfflineSubtitles.maximumLanguageCodeUnits)",
    "replacement": "Array.from((stream.Language ?? '')).slice(0, OfflineSubtitles.maximumLanguageCodeUnits).join('')",
    "name": "retry subtitle language splits UTF16 surrogate pair",
    "suite": "subtitle-metadata-contract.test.cjs"
  },
  {
    "id": "fallback-order",
    "file": "entry/src/main/ets/service/OfflineSubtitles.ets",
    "old": "stream.DisplayTitle || stream.Language || stream.Codec || ''",
    "replacement": "stream.Language || stream.DisplayTitle || stream.Codec || ''",
    "name": "retry subtitle title 256",
    "suite": "subtitle-metadata-contract.test.cjs"
  },
  {
    "id": "duplicate-guard-remove",
    "file": "entry/src/main/ets/service/OfflineSubtitles.ets",
    "old": "!textSubtitle(stream) || seen.has(stream.Index)",
    "replacement": "!textSubtitle(stream)",
    "name": "plan subtitle filters nontext and retains first duplicate index",
    "suite": "subtitle-metadata-contract.test.cjs"
  }
];
const controls = [
  {
    "phase": "http-create",
    "name": "retry subtitle title 256",
    "suite": "subtitle-metadata-contract.test.cjs",
    "scope": "subtitle-metadata",
    "nativeInit": true
  },
  {
    "phase": "http-create",
    "name": "retry subtitle title 256",
    "suite": "subtitle-metadata-contract.test.cjs",
    "scope": "subtitle-metadata",
    "nativeInit": 2,
    "requiredCalls": {
      "version": 1,
      "http-create": 2
    }
  },
  {
    "phase": "subtitle-create",
    "name": "retry subtitle title 256",
    "suite": "subtitle-metadata-contract.test.cjs",
    "scope": "subtitle-metadata",
    "nativeInit": "subtitle",
    "requiredCalls": {
      "playback-info": 1
    }
  },
  {
    "phase": "file-rename",
    "name": "retry subtitle title 256",
    "suite": "subtitle-metadata-contract.test.cjs",
    "scope": "subtitle-metadata",
    "requiredCalls": {
      "playback-info": 1
    }
  },
  {
    "phase": "setup",
    "name": "retry subtitle title 256",
    "suite": "subtitle-metadata-contract.test.cjs",
    "scope": "subtitle-metadata"
  }
];
module.exports={recipes,controls,scope:'subtitle-metadata',fixture:'tests/subtitle-metadata-contract-fixture.cjs',earlyPhase:'file-rename',earlyOld:'try { await test.action(check); }',earlyReplacement:"try { f.trace().call('file-rename',()=>{}); await test.action(check); }",selfFaults:[{id:'native-http-init-observer',phase:'http-create',file:'tests/catalog-contract-fixture.cjs',old:"http.createHttp=()=>trace.call('http-create',()=>{",replacement:"http.createHttp=()=>((phase,operation)=>operation())('http-create',()=>{",status:'detected'},{id:'native-subtitle-init-observer',phase:'subtitle-create',file:'tests/subtitle-metadata-contract-fixture.cjs',old:"(_context, value) => f.trace().call('subtitle-create', async () => {",replacement:"(_context, value) => ((phase,operation)=>operation())('subtitle-create', async () => {",status:'detected'}]};

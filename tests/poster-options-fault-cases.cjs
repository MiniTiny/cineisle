const recipes=[
  {
    "id": "minimumCapacityMb-drift-0",
    "file": "entry/src/main/ets/utils/PosterOptions.ts",
    "old": "minimumCapacityMb: number = 1",
    "replacement": "minimumCapacityMb: number = 0",
    "name": "poster options lower capacity 0",
    "suite": "poster-options-contract.test.cjs"
  },
  {
    "id": "minimumCapacityMb-drift-2",
    "file": "entry/src/main/ets/utils/PosterOptions.ts",
    "old": "minimumCapacityMb: number = 1",
    "replacement": "minimumCapacityMb: number = 2",
    "name": "poster options lower capacity 1",
    "suite": "poster-options-contract.test.cjs"
  },
  {
    "id": "maximumCapacityMb-drift-199",
    "file": "entry/src/main/ets/utils/PosterOptions.ts",
    "old": "maximumCapacityMb: number = 200",
    "replacement": "maximumCapacityMb: number = 199",
    "name": "poster options lower capacity 200",
    "suite": "poster-options-contract.test.cjs"
  },
  {
    "id": "maximumCapacityMb-drift-201",
    "file": "entry/src/main/ets/utils/PosterOptions.ts",
    "old": "maximumCapacityMb: number = 200",
    "replacement": "maximumCapacityMb: number = 201",
    "name": "poster options lower capacity 201",
    "suite": "poster-options-contract.test.cjs"
  },
  {
    "id": "capacity-min-compare",
    "file": "entry/src/main/ets/utils/PosterOptions.ts",
    "old": "value.maxMb >= PosterOptionRules.minimumCapacityMb",
    "replacement": "value.maxMb > PosterOptionRules.minimumCapacityMb",
    "name": "poster options actual save capacity 1",
    "suite": "poster-options-contract.test.cjs"
  },
  {
    "id": "capacity-max-compare",
    "file": "entry/src/main/ets/utils/PosterOptions.ts",
    "old": "value.maxMb <= PosterOptionRules.maximumCapacityMb",
    "replacement": "value.maxMb < PosterOptionRules.maximumCapacityMb",
    "name": "poster options actual SDK capacity 200",
    "suite": "poster-options-contract.test.cjs"
  },
  {
    "id": "capacity-min-remove",
    "file": "entry/src/main/ets/utils/PosterOptions.ts",
    "old": "value.maxMb >= PosterOptionRules.minimumCapacityMb",
    "replacement": "true",
    "name": "poster options lower capacity 0",
    "suite": "poster-options-contract.test.cjs"
  },
  {
    "id": "capacity-max-remove",
    "file": "entry/src/main/ets/utils/PosterOptions.ts",
    "old": "value.maxMb <= PosterOptionRules.maximumCapacityMb",
    "replacement": "true",
    "name": "poster options actual save capacity 201",
    "suite": "poster-options-contract.test.cjs"
  },
  {
    "id": "capacity-integer-remove",
    "file": "entry/src/main/ets/utils/PosterOptions.ts",
    "old": "Number.isInteger(value.maxMb)",
    "replacement": "true",
    "name": "poster options lower capacity 1.5",
    "suite": "poster-options-contract.test.cjs"
  },
  {
    "id": "tag-max-compare",
    "file": "entry/src/main/ets/utils/PosterOptions.ts",
    "old": "value.tag.length <= PosterImagePolicy.maximumTagCodeUnits",
    "replacement": "value.tag.length < PosterImagePolicy.maximumTagCodeUnits",
    "name": "poster options http tag 256 unicode true",
    "suite": "poster-options-contract.test.cjs"
  },
  {
    "id": "tag-max-remove",
    "file": "entry/src/main/ets/utils/PosterOptions.ts",
    "old": "value.tag.length <= PosterImagePolicy.maximumTagCodeUnits",
    "replacement": "true",
    "name": "poster options cache tag 257 unicode true",
    "suite": "poster-options-contract.test.cjs"
  },
  {
    "id": "tag-max-drift-255",
    "file": "entry/src/main/ets/utils/PosterOptions.ts",
    "old": "maximumTagCodeUnits: number = 256",
    "replacement": "maximumTagCodeUnits: number = 255",
    "name": "poster options http tag 256 unicode true",
    "suite": "poster-options-contract.test.cjs"
  },
  {
    "id": "tag-max-drift-257",
    "file": "entry/src/main/ets/utils/PosterOptions.ts",
    "old": "maximumTagCodeUnits: number = 256",
    "replacement": "maximumTagCodeUnits: number = 257",
    "name": "poster options http tag 257 unicode true",
    "suite": "poster-options-contract.test.cjs"
  },
  {
    "id": "enabled-default",
    "file": "entry/src/main/ets/utils/PosterOptions.ts",
    "old": "enabled: boolean = true",
    "replacement": "enabled: boolean = false",
    "name": "poster options actual SDK initial values retain defaults",
    "suite": "poster-options-contract.test.cjs"
  },
  {
    "id": "capacity-default",
    "file": "entry/src/main/ets/utils/PosterOptions.ts",
    "old": "maxMb: number = 20",
    "replacement": "maxMb: number = 21",
    "name": "poster options actual SDK initial values retain defaults",
    "suite": "poster-options-contract.test.cjs"
  },
  {
    "id": "cache-target-guard-remove",
    "file": "entry/src/main/ets/service/PosterCache.ets",
    "old": "!validPosterTarget(target)",
    "replacement": "false",
    "name": "poster options cache-independent tag 257 unicode false",
    "suite": "poster-options-contract.test.cjs"
  }
];
recipes.push(
  ...[2, 4].map(value => ({ id: 'capacity-draft-digits-' + value, file: 'entry/src/main/ets/utils/PosterOptions.ts', old: 'maximumCapacityDraftDigits: number = 3', replacement: 'maximumCapacityDraftDigits: number = ' + value, name: value === 2 ? 'poster draft actual input "123"' : 'poster draft actual input "0001"', suite: 'poster-draft-contract.test.cjs' })),
  { id: 'capacity-draft-producer-drift', file: 'entry/src/main/ets/pages/Settings.ets', old: '.maxLength(PosterOptionRules.maximumCapacityDraftDigits)', replacement: '.maxLength(2)', name: 'poster draft actual input "123"', suite: 'poster-draft-contract.test.cjs' },
  { id: 'capacity-draft-guard-remove', file: 'entry/src/main/ets/pages/Settings.ets', old: '!PosterOptionRules.validCapacityDraft(this.posterCapacity)', replacement: 'false', name: 'poster draft actual input "0001"', suite: 'poster-draft-contract.test.cjs' },
  { id: 'capacity-draft-minimum-quantifier', file: 'entry/src/main/ets/utils/PosterOptions.ts', old: "new RegExp('^[0-9]{1,' + PosterOptionRules.maximumCapacityDraftDigits", replacement: "new RegExp('^[0-9]{2,' + PosterOptionRules.maximumCapacityDraftDigits", name: 'poster draft grammar "1"', suite: 'poster-draft-contract.test.cjs' }
);
const controls=[
  {
    "name": "poster options actual save capacity 1",
    "phase": "prefs-open",
    "nativeInit": "prefs",
    "scope": "poster-options",
    "suite": "poster-options-contract.test.cjs"
  },
  {
    "name": "poster options actual save capacity 1",
    "phase": "prefs-get",
    "requiredCalls": {
      "prefs-open": 1
    },
    "scope": "poster-options",
    "suite": "poster-options-contract.test.cjs"
  },
  {
    "name": "poster options actual save capacity 1",
    "phase": "prefs-flush",
    "requiredCalls": {
      "prefs-put": 1
    },
    "scope": "poster-options",
    "suite": "poster-options-contract.test.cjs"
  },
  {
    "name": "poster options http tag 256 unicode true",
    "phase": "http-create",
    "nativeInit": true,
    "scope": "poster-options",
    "suite": "poster-options-contract.test.cjs"
  },
  {
    "name": "poster options cache tag 256 unicode true",
    "phase": "request",
    "requiredCalls": {
      "prefs-get": 1,
      "http-create": 1
    },
    "scope": "poster-options",
    "suite": "poster-options-contract.test.cjs"
  },
  {
    "name": "poster options actual SDK initial values retain defaults",
    "phase": "ui-compile",
    "scope": "poster-options",
    "suite": "poster-options-contract.test.cjs"
  },
  {
    "name": "poster options lower capacity 1",
    "phase": "setup",
    "scope": "poster-options",
    "suite": "poster-options-contract.test.cjs"
  }
];
module.exports={recipes,controls,scope:'poster-options',extraScopes:['entry/src/main/resources'],fixture:'tests/poster-options-fixture.cjs',earlyPhase:'prefs-flush',earlyOld:'try{await test.action(check);',earlyReplacement:"try{f.trace().call('prefs-flush',()=>{});await test.action(check);",selfFaults:[{id:'native-prefs-init-capture',phase:'prefs-open',file:'tests/poster-options-fixture.cjs',old:"f.trace().call('prefs-open',async()=>{",replacement:"((phase,operation)=>operation())('prefs-open',async()=>{",status:'detected'}]};

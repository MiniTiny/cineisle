const recipes=[
  {
    "id": "render-family-0",
    "file": "entry/src/main/ets/utils/CaptionStyle.ts",
    "old": "value: 'default', caption: 'caption_family_default', renderFamily: 'sans-serif'",
    "replacement": "value: 'default', caption: 'caption_family_default', renderFamily: 'incorrect-font'",
    "name": "caption choice actual SDK family 0",
    "suite": "caption-choice-contract.test.cjs"
  },
  {
    "id": "render-family-1",
    "file": "entry/src/main/ets/utils/CaptionStyle.ts",
    "old": "value: 'monospacedSerif', caption: 'caption_family_mono_serif', renderFamily: 'serif-monospace'",
    "replacement": "value: 'monospacedSerif', caption: 'caption_family_mono_serif', renderFamily: 'incorrect-font'",
    "name": "caption choice actual SDK family 1",
    "suite": "caption-choice-contract.test.cjs"
  },
  {
    "id": "render-family-2",
    "file": "entry/src/main/ets/utils/CaptionStyle.ts",
    "old": "value: 'serif', caption: 'caption_family_serif', renderFamily: 'serif'",
    "replacement": "value: 'serif', caption: 'caption_family_serif', renderFamily: 'incorrect-font'",
    "name": "caption choice actual SDK family 2",
    "suite": "caption-choice-contract.test.cjs"
  },
  {
    "id": "render-family-3",
    "file": "entry/src/main/ets/utils/CaptionStyle.ts",
    "old": "value: 'monospacedSansSerif', caption: 'caption_family_mono_sans', renderFamily: 'monospace'",
    "replacement": "value: 'monospacedSansSerif', caption: 'caption_family_mono_sans', renderFamily: 'incorrect-font'",
    "name": "caption choice actual SDK family 3",
    "suite": "caption-choice-contract.test.cjs"
  },
  {
    "id": "render-family-4",
    "file": "entry/src/main/ets/utils/CaptionStyle.ts",
    "old": "value: 'sansSerif', caption: 'caption_family_sans', renderFamily: 'sans-serif'",
    "replacement": "value: 'sansSerif', caption: 'caption_family_sans', renderFamily: 'incorrect-font'",
    "name": "caption choice actual SDK family 4",
    "suite": "caption-choice-contract.test.cjs"
  },
  {
    "id": "render-family-5",
    "file": "entry/src/main/ets/utils/CaptionStyle.ts",
    "old": "value: 'casual', caption: 'caption_family_casual', renderFamily: 'casual'",
    "replacement": "value: 'casual', caption: 'caption_family_casual', renderFamily: 'incorrect-font'",
    "name": "caption choice actual SDK family 5",
    "suite": "caption-choice-contract.test.cjs"
  },
  {
    "id": "render-family-6",
    "file": "entry/src/main/ets/utils/CaptionStyle.ts",
    "old": "value: 'cursive', caption: 'caption_family_cursive', renderFamily: 'cursive'",
    "replacement": "value: 'cursive', caption: 'caption_family_cursive', renderFamily: 'incorrect-font'",
    "name": "caption choice actual SDK family 6",
    "suite": "caption-choice-contract.test.cjs"
  },
  {
    "id": "render-family-7",
    "file": "entry/src/main/ets/utils/CaptionStyle.ts",
    "old": "value: 'smallCapitals', caption: 'caption_family_small_caps', renderFamily: 'sans-serif-smallcaps'",
    "replacement": "value: 'smallCapitals', caption: 'caption_family_small_caps', renderFamily: 'incorrect-font'",
    "name": "caption choice actual SDK family 7",
    "suite": "caption-choice-contract.test.cjs"
  },
  {
    "id": "family-label-0",
    "file": "entry/src/main/ets/utils/CaptionStyle.ts",
    "old": "value: 'default', caption: 'caption_family_default'",
    "replacement": "value: 'default', caption: 'caption_invalid'",
    "name": "caption choice actual SDK family 0",
    "suite": "caption-choice-contract.test.cjs"
  },
  {
    "id": "family-label-7",
    "file": "entry/src/main/ets/utils/CaptionStyle.ts",
    "old": "value: 'smallCapitals', caption: 'caption_family_small_caps'",
    "replacement": "value: 'smallCapitals', caption: 'caption_invalid'",
    "name": "caption choice actual SDK family 7",
    "suite": "caption-choice-contract.test.cjs"
  },
  {
    "id": "family-native-drift",
    "file": "entry/src/main/ets/utils/CaptionStyle.ts",
    "old": "value: 'monospacedSerif', caption: 'caption_family_mono_serif'",
    "replacement": "value: 'unknown', caption: 'caption_family_mono_serif'",
    "name": "caption choice actual SDK family 1",
    "suite": "caption-choice-contract.test.cjs"
  },
  {
    "id": "family-legacy-binding",
    "file": "entry/src/main/ets/utils/CaptionStyle.ts",
    "old": "map((choice: CaptionFamilyChoice): string => choice.value)",
    "replacement": "map((choice: CaptionFamilyChoice): string => 'unknown')",
    "name": "caption choice legacy sequences preserve native strings and SDK declarations",
    "suite": "caption-choice-contract.test.cjs"
  },
  {
    "id": "edge-label-0",
    "file": "entry/src/main/ets/utils/CaptionStyle.ts",
    "old": "value: 'none', caption: 'caption_edge_none'",
    "replacement": "value: 'none', caption: 'caption_invalid'",
    "name": "caption choice actual SDK edge 0",
    "suite": "caption-choice-contract.test.cjs"
  },
  {
    "id": "edge-label-4",
    "file": "entry/src/main/ets/utils/CaptionStyle.ts",
    "old": "value: 'dropShadow', caption: 'caption_edge_shadow'",
    "replacement": "value: 'dropShadow', caption: 'caption_invalid'",
    "name": "caption choice actual SDK edge 4",
    "suite": "caption-choice-contract.test.cjs"
  },
  {
    "id": "edge-native-drift",
    "file": "entry/src/main/ets/utils/CaptionStyle.ts",
    "old": "value: 'raised', caption: 'caption_edge_raised'",
    "replacement": "value: 'unknown', caption: 'caption_edge_raised'",
    "name": "caption choice actual SDK edge 1",
    "suite": "caption-choice-contract.test.cjs"
  },
  {
    "id": "edge-legacy-binding",
    "file": "entry/src/main/ets/utils/CaptionStyle.ts",
    "old": "map((choice: CaptionEdgeChoice): string => choice.value)",
    "replacement": "map((choice: CaptionEdgeChoice): string => 'unknown')",
    "name": "caption choice legacy sequences preserve native strings and SDK declarations",
    "suite": "caption-choice-contract.test.cjs"
  },
  {
    "id": "family-order",
    "file": "entry/src/main/ets/utils/CaptionStyle.ts",
    "old": "];\nexport const CAPTION_EDGE_CHOICES",
    "replacement": "].reverse();\nexport const CAPTION_EDGE_CHOICES",
    "name": "caption choice actual SDK family 0",
    "suite": "caption-choice-contract.test.cjs"
  },
  {
    "id": "edge-order",
    "file": "entry/src/main/ets/utils/CaptionStyle.ts",
    "old": "];\nexport const CAPTION_FAMILIES",
    "replacement": "].reverse();\nexport const CAPTION_FAMILIES",
    "name": "caption choice actual SDK edge 0",
    "suite": "caption-choice-contract.test.cjs"
  },
  {
    "id": "family-index-min-remove",
    "file": "entry/src/main/ets/pages/CaptionSettings.ets",
    "old": "value >= 0 && value < CAPTION_FAMILIES.length",
    "replacement": "true && value < CAPTION_FAMILIES.length",
    "name": "caption choice unknown native values reject and invalid SDK indices preserve draft",
    "suite": "caption-choice-contract.test.cjs"
  },
  {
    "id": "edge-index-max-remove",
    "file": "entry/src/main/ets/pages/CaptionSettings.ets",
    "old": "value >= 0 && value < CAPTION_EDGES.length",
    "replacement": "value >= 0 && true",
    "name": "caption choice unknown native values reject and invalid SDK indices preserve draft",
    "suite": "caption-choice-contract.test.cjs"
  }
];
const controls=[
  {
    "name": "caption choice actual SDK family 1",
    "phase": "caption-manager",
    "nativeInit": true,
    "scope": "caption-preference",
    "suite": "caption-choice-contract.test.cjs"
  },
  {
    "name": "caption choice actual SDK edge 3",
    "phase": "caption-style-written",
    "requiredCalls": {
      "native-style-read": 2,
      "caption-style-write": 1
    },
    "details": {
      "writes": 1
    },
    "scope": "caption-preference",
    "suite": "caption-choice-contract.test.cjs"
  },
  {
    "name": "caption choice legacy sequences preserve native strings and SDK declarations",
    "phase": "sdk-declarations",
    "scope": "caption-preference",
    "suite": "caption-choice-contract.test.cjs"
  },
  {
    "name": "caption choice actual SDK family 1",
    "phase": "ui-compile",
    "scope": "caption-preference",
    "suite": "caption-choice-contract.test.cjs"
  },
  {
    "name": "caption choice actual SDK family 1",
    "phase": "ui-render",
    "requiredCalls": {
      "ui-compile": 1
    },
    "scope": "caption-preference",
    "suite": "caption-choice-contract.test.cjs"
  },
  {
    "name": "caption choice actual SDK edge 3",
    "phase": "setup",
    "scope": "caption-preference",
    "suite": "caption-choice-contract.test.cjs"
  }
];
module.exports={recipes,controls,scope:'caption-preference',extraScopes:['entry/src/main/resources'],fixture:'tests/caption-preference-fixture.cjs',earlyPhase:'caption-style-written',earlyOld:'try{await test.action(check,time);',earlyReplacement:"try{f.trace().call('caption-style-written',()=>{});await test.action(check,time);",selfFaults:[{id:'native-manager-init-capture',phase:'caption-manager',file:'tests/caption-preference-fixture.cjs',old:"f.trace().call('caption-manager',()=>{",replacement:"((phase,operation)=>operation())('caption-manager',()=>{",status:'detected'}]};

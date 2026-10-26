const recipes=[
  {
    "id": "attempts-drift-5",
    "file": "entry/src/main/ets/service/SystemCaptions.ets",
    "old": "verificationAttempts: number = 6",
    "replacement": "verificationAttempts: number = 5",
    "name": "caption verification actual target read 6",
    "suite": "caption-verification-contract.test.cjs"
  },
  {
    "id": "attempts-drift-7",
    "file": "entry/src/main/ets/service/SystemCaptions.ets",
    "old": "verificationAttempts: number = 6",
    "replacement": "verificationAttempts: number = 7",
    "name": "caption verification exhausted target restores original after sixth attempt",
    "suite": "caption-verification-contract.test.cjs"
  },
  {
    "id": "interval-drift-99",
    "file": "entry/src/main/ets/service/SystemCaptions.ets",
    "old": "verificationIntervalMs: number = 100",
    "replacement": "verificationIntervalMs: number = 99",
    "name": "caption verification actual target read 6",
    "suite": "caption-verification-contract.test.cjs"
  },
  {
    "id": "interval-drift-101",
    "file": "entry/src/main/ets/service/SystemCaptions.ets",
    "old": "verificationIntervalMs: number = 100",
    "replacement": "verificationIntervalMs: number = 101",
    "name": "caption verification actual target read 6",
    "suite": "caption-verification-contract.test.cjs"
  },
  {
    "id": "attempts-compare",
    "file": "entry/src/main/ets/service/SystemCaptions.ets",
    "old": "n < SystemCaptions.verificationAttempts;",
    "replacement": "n <= SystemCaptions.verificationAttempts;",
    "name": "caption verification exhausted target restores original after sixth attempt",
    "suite": "caption-verification-contract.test.cjs"
  },
  {
    "id": "last-wait-compare",
    "file": "entry/src/main/ets/service/SystemCaptions.ets",
    "old": "n + 1 < SystemCaptions.verificationAttempts",
    "replacement": "n + 1 <= SystemCaptions.verificationAttempts",
    "name": "caption verification exhausted target restores original after sixth attempt",
    "suite": "caption-verification-contract.test.cjs"
  },
  {
    "id": "last-wait-remove",
    "file": "entry/src/main/ets/service/SystemCaptions.ets",
    "old": "if (n + 1 < SystemCaptions.verificationAttempts)",
    "replacement": "if (false)",
    "name": "caption verification actual target read 6",
    "suite": "caption-verification-contract.test.cjs"
  },
  {
    "id": "confirmation-guard-remove",
    "file": "entry/src/main/ets/service/SystemCaptions.ets",
    "old": "state.available && sameCaptionConfig(state.config, config)",
    "replacement": "state.available",
    "name": "caption verification actual target read 6",
    "suite": "caption-verification-contract.test.cjs"
  },
  {
    "id": "confirmation-compare",
    "file": "entry/src/main/ets/service/SystemCaptions.ets",
    "old": "sameCaptionConfig(state.config, config)",
    "replacement": "!sameCaptionConfig(state.config, config)",
    "name": "caption verification actual target read 1",
    "suite": "caption-verification-contract.test.cjs"
  },
  {
    "id": "failure-guard-remove",
    "file": "entry/src/main/ets/service/SystemCaptions.ets",
    "old": "if (!verified) { throw new Error('caption_save_failed'); }",
    "replacement": "if (false) { throw new Error('caption_save_failed'); }",
    "name": "caption verification exhausted target restores original after sixth attempt",
    "suite": "caption-verification-contract.test.cjs"
  }
];
const controls=[
  {
    "name": "caption verification actual target read 1",
    "phase": "caption-manager",
    "nativeInit": true,
    "scope": "caption-preference",
    "suite": "caption-verification-contract.test.cjs"
  },
  {
    "name": "caption verification actual target read 1",
    "phase": "caption-style-written",
    "requiredCalls": {
      "native-style-read": 2,
      "caption-style-write": 1
    },
    "details": {
      "writes": 1
    },
    "scope": "caption-preference",
    "suite": "caption-verification-contract.test.cjs"
  },
  {
    "name": "caption verification actual target read 6",
    "phase": "verify-style-read",
    "requiredCalls": {
      "caption-enabled-write": 1
    },
    "scope": "caption-preference",
    "suite": "caption-verification-contract.test.cjs"
  },
  {
    "name": "caption verification actual target read 6",
    "phase": "timer-set",
    "requiredCalls": {
      "caption-style-written": 1
    },
    "details": {
      "duration": 100
    },
    "scope": "caption-preference",
    "suite": "caption-verification-contract.test.cjs"
  },
  {
    "name": "caption verification actual target read 1",
    "phase": "setup",
    "scope": "caption-preference",
    "suite": "caption-verification-contract.test.cjs"
  }
];
module.exports={recipes,controls,scope:'caption-preference',fixture:'tests/caption-preference-fixture.cjs',earlyPhase:'caption-style-written',earlyOld:'try{await test.action(check,time);',earlyReplacement:"try{f.trace().call('caption-style-written',()=>{});await test.action(check,time);",selfFaults:[{id:'native-manager-init-capture',phase:'caption-manager',file:'tests/caption-preference-fixture.cjs',old:"f.trace().call('caption-manager',()=>{",replacement:"((phase,operation)=>operation())('caption-manager',()=>{",status:'detected'}]};

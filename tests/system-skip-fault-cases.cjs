const recipes = [
  {
    "id": "default--1",
    "file": "entry/src/main/ets/service/SystemPlayback.ets",
    "old": "defaultSkipMs: number = 15000",
    "replacement": "defaultSkipMs: number = 14999",
    "name": "session default skip forward at 30000",
    "suite": "system-skip-contract.test.cjs"
  },
  {
    "id": "default-1",
    "file": "entry/src/main/ets/service/SystemPlayback.ets",
    "old": "defaultSkipMs: number = 15000",
    "replacement": "defaultSkipMs: number = 15001",
    "name": "session default skip forward at 30000",
    "suite": "system-skip-contract.test.cjs"
  },
  {
    "id": "session-forward-consumer",
    "file": "entry/src/main/ets/service/SystemPlayback.ets",
    "old": "this.skip(amount ?? SystemPlayback.defaultSkipMs);",
    "replacement": "this.skip((amount ?? SystemPlayback.defaultSkipMs) + 1);",
    "name": "session default skip forward at 30000",
    "suite": "system-skip-contract.test.cjs"
  },
  {
    "id": "session-backward-consumer",
    "file": "entry/src/main/ets/service/SystemPlayback.ets",
    "old": "this.skip(-(amount ?? SystemPlayback.defaultSkipMs));",
    "replacement": "this.skip(-((amount ?? SystemPlayback.defaultSkipMs) + 1));",
    "name": "session default skip backward at 30000",
    "suite": "system-skip-contract.test.cjs"
  },
  {
    "id": "pip-forward-consumer",
    "file": "entry/src/main/ets/service/SystemPlayback.ets",
    "old": "this.skip(SystemPlayback.defaultSkipMs);",
    "replacement": "this.skip(SystemPlayback.defaultSkipMs + 1);",
    "name": "pip default skip forward at 30000",
    "suite": "system-skip-contract.test.cjs"
  },
  {
    "id": "pip-backward-consumer",
    "file": "entry/src/main/ets/service/SystemPlayback.ets",
    "old": "this.skip(-SystemPlayback.defaultSkipMs);",
    "replacement": "this.skip(-(SystemPlayback.defaultSkipMs + 1));",
    "name": "pip default skip backward at 30000",
    "suite": "system-skip-contract.test.cjs"
  },
  {
    "id": "forward-nullish-drift",
    "file": "entry/src/main/ets/service/SystemPlayback.ets",
    "old": "this.skip(amount ?? SystemPlayback.defaultSkipMs);",
    "replacement": "this.skip(amount || SystemPlayback.defaultSkipMs);",
    "name": "session explicit skip forward zero",
    "suite": "system-skip-contract.test.cjs"
  },
  {
    "id": "backward-nullish-drift",
    "file": "entry/src/main/ets/service/SystemPlayback.ets",
    "old": "this.skip(-(amount ?? SystemPlayback.defaultSkipMs));",
    "replacement": "this.skip(-(amount || SystemPlayback.defaultSkipMs));",
    "name": "session explicit skip backward zero",
    "suite": "system-skip-contract.test.cjs"
  },
  {
    "id": "finite-protection-remove",
    "file": "entry/src/main/ets/service/SystemPlayback.ets",
    "old": "!this.disposed && Number.isFinite(amount)",
    "replacement": "!this.disposed",
    "name": "session explicit skip forward NaN",
    "suite": "system-skip-contract.test.cjs"
  },
  {
    "id": "disposed-protection-remove",
    "file": "entry/src/main/ets/service/SystemPlayback.ets",
    "old": "!this.disposed && Number.isFinite(amount)",
    "replacement": "Number.isFinite(amount)",
    "name": "session late default skip callback cannot reach the controller after disposal",
    "suite": "system-skip-contract.test.cjs"
  }
];
const controls = [
  {
    "phase": "av-create",
    "name": "session default skip forward at 30000",
    "suite": "system-skip-contract.test.cjs",
    "scope": "system-skip",
    "nativeInit": true
  },
  {
    "phase": "native-session-create",
    "name": "session default skip forward at 30000",
    "suite": "system-skip-contract.test.cjs",
    "scope": "system-skip",
    "nativeInit": "session",
    "requiredCalls": {
      "av-create": 1
    }
  },
  {
    "phase": "native-pip-create",
    "name": "pip default skip forward at 30000",
    "suite": "system-skip-contract.test.cjs",
    "scope": "system-skip",
    "nativeInit": "pip",
    "requiredCalls": {
      "native-session-create": 1
    }
  },
  {
    "phase": "native-seek",
    "name": "pip default skip forward at 30000",
    "suite": "system-skip-contract.test.cjs",
    "scope": "system-skip",
    "requiredCalls": {
      "control-event": 1
    }
  },
  {
    "phase": "control-event",
    "name": "session default skip forward at 30000",
    "suite": "system-skip-contract.test.cjs",
    "scope": "system-skip",
    "requiredCalls": {
      "native-session-create": 1
    }
  },
  {
    "phase": "setup",
    "name": "session default skip forward at 30000",
    "suite": "system-skip-contract.test.cjs",
    "scope": "system-skip"
  }
];
module.exports={recipes,controls,scope:'system-skip',fixture:'tests/system-skip-fixture.cjs',earlyPhase:'native-seek',earlyOld:'try { await test.action(check); }',earlyReplacement:"try { f.trace().call('native-seek',()=>{}); await test.action(check); }",selfFaults:[{id:'native-session-origin-remove',phase:'native-session-create',file:'tests/system-skip-fixture.cjs',old:"(...args) => f.trace().call('native-session-create', async () => {",replacement:"(...args) => ((phase,operation)=>operation())('native-session-create', async () => {",status:'invalid'},{id:'native-pip-observer-remove',phase:'native-pip-create',file:'tests/system-skip-fixture.cjs',old:"(...args) => f.trace().call('native-pip-create', async () => {",replacement:"(...args) => ((phase,operation)=>operation())('native-pip-create', async () => {",status:'detected'}]};

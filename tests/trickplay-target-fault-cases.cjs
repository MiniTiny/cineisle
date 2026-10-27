const recipes = [
  {
    "id": "target--1",
    "file": "entry/src/main/ets/service/TrickplayPreview.ets",
    "old": "decodeTargetWidthPx: number = 640",
    "replacement": "decodeTargetWidthPx: number = 639",
    "name": "page trickplay source width 1920",
    "suite": "trickplay-target-contract.test.cjs"
  },
  {
    "id": "target-1",
    "file": "entry/src/main/ets/service/TrickplayPreview.ets",
    "old": "decodeTargetWidthPx: number = 640",
    "replacement": "decodeTargetWidthPx: number = 641",
    "name": "page trickplay source width 1920",
    "suite": "trickplay-target-contract.test.cjs"
  },
  {
    "id": "target-consumer-drift",
    "file": "entry/src/main/ets/service/TrickplayPreview.ets",
    "old": "TrickplayPreview.decodeTargetWidthPx, () =>",
    "replacement": "TrickplayPreview.decodeTargetWidthPx + 1, () =>",
    "name": "page trickplay source width 641",
    "suite": "trickplay-target-contract.test.cjs"
  },
  {
    "id": "target-bound-remove",
    "file": "entry/src/main/ets/service/TrickplayPreview.ets",
    "old": "TrickplayPreview.decodeTargetWidthPx, () =>",
    "replacement": "32768, () =>",
    "name": "preview trickplay source width 1920",
    "suite": "trickplay-target-contract.test.cjs"
  },
  {
    "id": "width-remove",
    "file": "entry/src/main/ets/service/PosterBitmap.ets",
    "old": "w > maximumSourceDimensionPx",
    "replacement": "false",
    "name": "page trickplay independent width 32769",
    "suite": "trickplay-target-contract.test.cjs"
  },
  {
    "id": "width-compare",
    "file": "entry/src/main/ets/service/PosterBitmap.ets",
    "old": "w > maximumSourceDimensionPx",
    "replacement": "w >= maximumSourceDimensionPx",
    "name": "page trickplay independent width 32768",
    "suite": "trickplay-target-contract.test.cjs"
  },
  {
    "id": "height-remove",
    "file": "entry/src/main/ets/service/PosterBitmap.ets",
    "old": "h > maximumSourceDimensionPx",
    "replacement": "false",
    "name": "page trickplay independent height 32769",
    "suite": "trickplay-target-contract.test.cjs"
  },
  {
    "id": "height-compare",
    "file": "entry/src/main/ets/service/PosterBitmap.ets",
    "old": "h > maximumSourceDimensionPx",
    "replacement": "h >= maximumSourceDimensionPx",
    "name": "page trickplay independent height 32768",
    "suite": "trickplay-target-contract.test.cjs"
  },
  {
    "id": "waiting-render-remove",
    "file": "entry/src/main/ets/service/TrickplayPreview.ets",
    "old": "this.decoding || this.waitingRender || !this.pending",
    "replacement": "this.decoding || !this.pending",
    "name": "page trickplay retains retired bitmaps until the actual Image completion callback",
    "suite": "trickplay-target-contract.test.cjs"
  },
  {
    "id": "same-frame-guard-remove",
    "file": "entry/src/main/ets/service/TrickplayPreview.ets",
    "old": "if (this.time === frame.time) { return; }",
    "replacement": "if (false) { return; }",
    "name": "preview trickplay skips a rendered frame already decoded",
    "suite": "trickplay-target-contract.test.cjs"
  },
  {
    "id": "hide-revision-remove",
    "file": "entry/src/main/ets/service/TrickplayPreview.ets",
    "old": "hide(): void { ++this.revision;",
    "replacement": "hide(): void {",
    "name": "preview trickplay hide rejects an in-flight bitmap independently of data replacement",
    "suite": "trickplay-target-contract.test.cjs"
  },
  {
    "id": "pending-first-drift",
    "file": "entry/src/main/ets/service/TrickplayPreview.ets",
    "old": "this.pending = frame; this.drain();",
    "replacement": "if (!this.pending) { this.pending = frame; } this.drain();",
    "name": "preview trickplay coalesces to the last pending frame",
    "suite": "trickplay-target-contract.test.cjs"
  },
  {
    "id": "retired-release-early",
    "file": "entry/src/main/ets/service/TrickplayPreview.ets",
    "old": "if (this.current) { this.retired.push(this.current); }\n      this.current = bitmap;",
    "replacement": "if (this.current) { this.current.release().catch(() => {}); }\n      this.current = bitmap;",
    "name": "page trickplay retains retired bitmaps until the actual Image completion callback",
    "suite": "trickplay-target-contract.test.cjs"
  }
];
const controls = [
  {
    "phase": "image-source",
    "name": "page trickplay source width 641",
    "suite": "trickplay-target-contract.test.cjs",
    "scope": "trickplay-target",
    "nativeInit": "image",
    "requiredCalls": {
      "ui-render": 1
    }
  },
  {
    "phase": "bitmap-create",
    "name": "page trickplay source width 641",
    "suite": "trickplay-target-contract.test.cjs",
    "scope": "trickplay-target",
    "nativeInit": "bitmap",
    "requiredCalls": {
      "image-source": 1,
      "image-info": 1
    }
  },
  {
    "phase": "image-info",
    "name": "page trickplay source width 641",
    "suite": "trickplay-target-contract.test.cjs",
    "scope": "trickplay-target",
    "requiredCalls": {
      "image-source": 1
    }
  },
  {
    "phase": "bitmap-release",
    "name": "preview trickplay hide rejects an in-flight bitmap independently of data replacement",
    "suite": "trickplay-target-contract.test.cjs",
    "scope": "trickplay-target",
    "requiredCalls": {
      "bitmap-create": 1
    }
  },
  {
    "phase": "ui-compile",
    "name": "page trickplay source width 641",
    "suite": "trickplay-target-contract.test.cjs",
    "scope": "trickplay-target"
  },
  {
    "phase": "setup",
    "name": "lower trickplay source width 640",
    "suite": "trickplay-target-contract.test.cjs",
    "scope": "trickplay-target"
  }
];
module.exports={recipes,controls,scope:'trickplay-target',extraScopes:['entry/src/main/resources'],fixture:'tests/trickplay-target-fixture.cjs',earlyPhase:'bitmap-create',earlyOld:'try { await test.action(check); }',earlyReplacement:"try { f.trace().call('bitmap-create',()=>{}); await test.action(check); }",selfFaults:[{id:'image-init-observer-remove',phase:'image-source',file:'tests/trickplay-target-fixture.cjs',old:"bytes => f.trace().call('image-source', () => {",replacement:"bytes => ((phase,operation)=>operation())('image-source', () => {",status:'detected'},{id:'bitmap-init-observer-remove',phase:'bitmap-create',file:'tests/trickplay-target-fixture.cjs',old:"options => f.trace().call('bitmap-create', async () => {",replacement:"options => ((phase,operation)=>operation())('bitmap-create', async () => {",status:'detected'}]};

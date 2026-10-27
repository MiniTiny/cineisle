const recipes=[
  {
    "id": "source-dimension-32767",
    "file": "entry/src/main/ets/service/PosterBitmap.ets",
    "old": "maximumSourceDimensionPx: number = 32768",
    "replacement": "maximumSourceDimensionPx: number = 32767",
    "name": "poster decode native width 32768",
    "suite": "poster-decode-contract.test.cjs"
  },
  {
    "id": "source-dimension-32769",
    "file": "entry/src/main/ets/service/PosterBitmap.ets",
    "old": "maximumSourceDimensionPx: number = 32768",
    "replacement": "maximumSourceDimensionPx: number = 32769",
    "name": "poster decode native height 32769",
    "suite": "poster-decode-contract.test.cjs"
  },
  {
    "id": "width-bound-compare",
    "file": "entry/src/main/ets/service/PosterBitmap.ets",
    "old": "w > maximumSourceDimensionPx",
    "replacement": "w >= maximumSourceDimensionPx",
    "name": "poster decode native width 32768",
    "suite": "poster-decode-contract.test.cjs"
  },
  {
    "id": "width-bound-remove",
    "file": "entry/src/main/ets/service/PosterBitmap.ets",
    "old": "w > maximumSourceDimensionPx",
    "replacement": "false",
    "name": "poster decode native width 32769",
    "suite": "poster-decode-contract.test.cjs"
  },
  {
    "id": "width-integer-remove",
    "file": "entry/src/main/ets/service/PosterBitmap.ets",
    "old": "!Number.isInteger(w)",
    "replacement": "false",
    "name": "poster decode native width string-1",
    "suite": "poster-decode-contract.test.cjs"
  },
  {
    "id": "width-positive-compare",
    "file": "entry/src/main/ets/service/PosterBitmap.ets",
    "old": "w <= 0",
    "replacement": "w < 0",
    "name": "poster decode native width 0",
    "suite": "poster-decode-contract.test.cjs"
  },
  {
    "id": "height-bound-compare",
    "file": "entry/src/main/ets/service/PosterBitmap.ets",
    "old": "h > maximumSourceDimensionPx",
    "replacement": "h >= maximumSourceDimensionPx",
    "name": "poster decode native height 32768",
    "suite": "poster-decode-contract.test.cjs"
  },
  {
    "id": "height-bound-remove",
    "file": "entry/src/main/ets/service/PosterBitmap.ets",
    "old": "h > maximumSourceDimensionPx",
    "replacement": "false",
    "name": "poster decode native height 32769",
    "suite": "poster-decode-contract.test.cjs"
  },
  {
    "id": "height-integer-remove",
    "file": "entry/src/main/ets/service/PosterBitmap.ets",
    "old": "!Number.isInteger(h)",
    "replacement": "false",
    "name": "poster decode native height string-1",
    "suite": "poster-decode-contract.test.cjs"
  },
  {
    "id": "height-positive-compare",
    "file": "entry/src/main/ets/service/PosterBitmap.ets",
    "old": "h <= 0",
    "replacement": "h < 0",
    "name": "poster decode native height 0",
    "suite": "poster-decode-contract.test.cjs"
  },
  {
    "id": "source-pixels-15999999",
    "file": "entry/src/main/ets/service/PosterBitmap.ets",
    "old": "maximumSourcePixels: number = 16000000",
    "replacement": "maximumSourcePixels: number = 15999999",
    "name": "poster decode native pixel budget 16000000",
    "suite": "poster-decode-contract.test.cjs"
  },
  {
    "id": "source-pixels-16000001",
    "file": "entry/src/main/ets/service/PosterBitmap.ets",
    "old": "maximumSourcePixels: number = 16000000",
    "replacement": "maximumSourcePixels: number = 16000001",
    "name": "poster decode actual SDK cache chain pixels 16000001",
    "suite": "poster-decode-contract.test.cjs"
  },
  {
    "id": "pixel-bound-remove",
    "file": "entry/src/main/ets/service/PosterBitmap.ets",
    "old": "w * h > maximumSourcePixels",
    "replacement": "false",
    "name": "poster decode actual SDK cache chain pixels 16000001",
    "suite": "poster-decode-contract.test.cjs"
  },
  {
    "id": "pixel-bound-compare",
    "file": "entry/src/main/ets/service/PosterBitmap.ets",
    "old": "w * h > maximumSourcePixels",
    "replacement": "w * h >= maximumSourcePixels",
    "name": "poster decode native pixel budget 16000000",
    "suite": "poster-decode-contract.test.cjs"
  },
  {
    "id": "concurrency-2",
    "file": "entry/src/main/ets/service/PosterBitmap.ets",
    "old": "maximumConcurrentDecodes: number = 3",
    "replacement": "maximumConcurrentDecodes: number = 2",
    "name": "poster decode actual concurrency is three",
    "suite": "poster-decode-contract.test.cjs"
  },
  {
    "id": "concurrency-4",
    "file": "entry/src/main/ets/service/PosterBitmap.ets",
    "old": "maximumConcurrentDecodes: number = 3",
    "replacement": "maximumConcurrentDecodes: number = 4",
    "name": "poster decode actual concurrency is three",
    "suite": "poster-decode-contract.test.cjs"
  },
  {
    "id": "concurrency-guard-remove",
    "file": "entry/src/main/ets/service/PosterBitmap.ets",
    "old": "active < maximumConcurrentDecodes",
    "replacement": "true",
    "name": "poster decode actual concurrency is three",
    "suite": "poster-decode-contract.test.cjs"
  },
  {
    "id": "waiting-63",
    "file": "entry/src/main/ets/service/PosterBitmap.ets",
    "old": "maximumWaitingDecodes: number = 64",
    "replacement": "maximumWaitingDecodes: number = 63",
    "name": "poster decode waiting budget 64",
    "suite": "poster-decode-contract.test.cjs"
  },
  {
    "id": "waiting-65",
    "file": "entry/src/main/ets/service/PosterBitmap.ets",
    "old": "maximumWaitingDecodes: number = 64",
    "replacement": "maximumWaitingDecodes: number = 65",
    "name": "poster decode waiting budget 65",
    "suite": "poster-decode-contract.test.cjs"
  },
  {
    "id": "waiting-guard-remove",
    "file": "entry/src/main/ets/service/PosterBitmap.ets",
    "old": "waiting.length >= maximumWaitingDecodes",
    "replacement": "false",
    "name": "poster decode waiting budget 65",
    "suite": "poster-decode-contract.test.cjs"
  },
  {
    "id": "waiting-bound-compare",
    "file": "entry/src/main/ets/service/PosterBitmap.ets",
    "old": "waiting.length >= maximumWaitingDecodes",
    "replacement": "waiting.length > maximumWaitingDecodes",
    "name": "poster decode waiting budget 65",
    "suite": "poster-decode-contract.test.cjs"
  },
  {
    "id": "output-height-1",
    "file": "entry/src/main/ets/service/PosterBitmap.ets",
    "old": "maximumOutputHeightFactor: number = 2",
    "replacement": "maximumOutputHeightFactor: number = 1",
    "name": "poster decode actual output parameters 160",
    "suite": "poster-decode-contract.test.cjs"
  },
  {
    "id": "output-height-3",
    "file": "entry/src/main/ets/service/PosterBitmap.ets",
    "old": "maximumOutputHeightFactor: number = 2",
    "replacement": "maximumOutputHeightFactor: number = 3",
    "name": "poster decode actual output parameters 160",
    "suite": "poster-decode-contract.test.cjs"
  },
  {
    "id": "bitmap-options-drift",
    "file": "entry/src/main/ets/service/PosterBitmap.ets",
    "old": "editable: false",
    "replacement": "editable: true",
    "name": "poster decode actual output parameters 480",
    "suite": "poster-decode-contract.test.cjs"
  },
  {
    "id": "output-ceil-width",
    "file": "entry/src/main/ets/service/PosterBitmap.ets",
    "old": "Math.floor(w * scale)",
    "replacement": "Math.ceil(w * scale)",
    "name": "poster decode preserves fractional output flooring width",
    "suite": "poster-decode-contract.test.cjs"
  },
  {
    "id": "output-ceil-height",
    "file": "entry/src/main/ets/service/PosterBitmap.ets",
    "old": "Math.floor(h * scale)",
    "replacement": "Math.ceil(h * scale)",
    "name": "poster decode preserves fractional output flooring height",
    "suite": "poster-decode-contract.test.cjs"
  },
  {
    "id": "waiting-owner-guard-remove",
    "file": "entry/src/main/ets/service/PosterBitmap.ets",
    "old": "if (!job.allowed()) { job.reject(new Error('poster_cancelled')); continue; }",
    "replacement": "if (false) { job.reject(new Error('poster_cancelled')); continue; }",
    "name": "poster decode cancelled waiting row never creates a source",
    "suite": "poster-decode-contract.test.cjs"
  },
  {
    "id": "pre-bitmap-owner-remove",
    "file": "entry/src/main/ets/service/PosterBitmap.ets",
    "old": "if (!job.allowed()) { throw new Error('poster_cancelled'); }\n    const scale",
    "replacement": "if (false) { throw new Error('poster_cancelled'); }\n    const scale",
    "name": "poster decode cancellation during metadata avoids bitmap creation",
    "suite": "poster-decode-contract.test.cjs"
  },
  {
    "id": "post-bitmap-owner-remove",
    "file": "entry/src/main/ets/service/PosterBitmap.ets",
    "old": "if (!job.allowed()) { throw new Error('poster_cancelled'); }\n    job.resolve(bitmap)",
    "replacement": "if (false) { throw new Error('poster_cancelled'); }\n    job.resolve(bitmap)",
    "name": "poster decode cancellation after bitmap creation releases both resources",
    "suite": "poster-decode-contract.test.cjs"
  }
,
{
  "id": "source-release-remove",
  "file": "entry/src/main/ets/service/PosterBitmap.ets",
  "old": "await source?.release()",
  "replacement": "void 0",
  "name": "poster decode native pixel budget 16000000",
  "suite": "poster-decode-contract.test.cjs"
},
{
  "id": "cancelled-bitmap-release-remove",
  "file": "entry/src/main/ets/service/PosterBitmap.ets",
  "old": "await bitmap.release().catch(() => {});",
  "replacement": "void 0;",
  "name": "poster decode cancellation after bitmap creation releases both resources",
  "suite": "poster-decode-contract.test.cjs"
}];
const controls=[
  {
    "name": "poster decode native pixel budget 16000000",
    "phase": "image-source",
    "nativeInit": "image",
    "scope": "poster-decode",
    "suite": "poster-decode-contract.test.cjs"
  },
  {
    "name": "poster decode native pixel budget 16000000",
    "phase": "image-info",
    "requiredCalls": {
      "image-source": 1
    },
    "details": {
      "created": 1
    },
    "scope": "poster-decode",
    "suite": "poster-decode-contract.test.cjs"
  },
  {
    "name": "poster decode native pixel budget 16000000",
    "phase": "bitmap-create",
    "requiredCalls": {
      "image-info": 1
    },
    "details": {
      "width": 480,
      "height": 480,
      "editable": false
    },
    "scope": "poster-decode",
    "suite": "poster-decode-contract.test.cjs"
  },
  {
    "name": "poster decode native pixel budget 16000000",
    "phase": "image-source-release",
    "requiredCalls": {
      "bitmap-create": 1
    },
    "scope": "poster-decode",
    "suite": "poster-decode-contract.test.cjs"
  },
  {
    "name": "poster decode actual SDK cache chain pixels 16000000",
    "phase": "http-create",
    "nativeInit": true,
    "requiredCalls": {
      "ui-render": 1
    },
    "scope": "poster-decode",
    "suite": "poster-decode-contract.test.cjs"
  },
  {
    "name": "poster decode actual SDK cache chain pixels 16000000",
    "phase": "ui-compile",
    "scope": "poster-decode",
    "suite": "poster-decode-contract.test.cjs"
  },
  {
    "name": "poster decode actual SDK cache chain pixels 16000000",
    "phase": "ui-render",
    "requiredCalls": {
      "ui-compile": 1
    },
    "scope": "poster-decode",
    "suite": "poster-decode-contract.test.cjs"
  },
  {
    "name": "poster decode native pixel budget 16000000",
    "phase": "setup",
    "scope": "poster-decode",
    "suite": "poster-decode-contract.test.cjs"
  }
];
module.exports={recipes,controls,scope:'poster-decode',extraScopes:['entry/src/main/resources'],fixture:'tests/poster-decode-fixture.cjs',earlyPhase:'bitmap-create',earlyOld:'try{await test.action(check);',earlyReplacement:"try{f.trace().call('bitmap-create',()=>{});await test.action(check);",selfFaults:[{id:'native-image-init-capture',phase:'image-source',file:'tests/poster-decode-fixture.cjs',old:"f.trace().call('image-source',()=>{",replacement:"((phase,operation)=>operation())('image-source',()=>{",status:'detected'}]};

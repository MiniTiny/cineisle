const recipes=[
  {
    "id": "hardware-order",
    "file": "entry/src/main/ets/pages/Settings.ets",
    "old": "MPV_HARDWARE_MODES.map(",
    "replacement": "MPV_HARDWARE_MODES.slice().reverse().map(",
    "name": "MPV choice actual hardware",
    "suite": "mpv-choice-contract.test.cjs"
  },
  {
    "id": "video-order",
    "file": "entry/src/main/ets/pages/Settings.ets",
    "old": "MPV_VIDEO_OUTPUTS.map(",
    "replacement": "MPV_VIDEO_OUTPUTS.slice().reverse().map(",
    "name": "MPV choice actual video",
    "suite": "mpv-choice-contract.test.cjs"
  },
  {
    "id": "hardware-value-drift",
    "file": "entry/src/main/ets/utils/MpvOptions.ts",
    "old": "['no', 'ohcodec', 'ohcodec-copy']",
    "replacement": "['no', 'ohcodec-copy', 'ohcodec']",
    "name": "MPV choice actual hardware",
    "suite": "mpv-choice-contract.test.cjs"
  },
  {
    "id": "video-value-drift",
    "file": "entry/src/main/ets/utils/MpvOptions.ts",
    "old": "['gpu-next', 'gpu']",
    "replacement": "['gpu', 'gpu-next']",
    "name": "MPV choice actual video",
    "suite": "mpv-choice-contract.test.cjs"
  }
];
const controls=[
  {
    "name": "MPV choice actual hardware",
    "phase": "ui-compile",
    "scope": "mpv-choice",
    "suite": "mpv-choice-contract.test.cjs"
  },
  {
    "name": "MPV choice actual video",
    "phase": "ui-render",
    "requiredCalls": {
      "ui-compile": 1
    },
    "scope": "mpv-choice",
    "suite": "mpv-choice-contract.test.cjs"
  },
  {
    "name": "MPV choice actual video",
    "phase": "setup",
    "scope": "mpv-choice",
    "suite": "mpv-choice-contract.test.cjs"
  }
];
module.exports={recipes,controls,extraScopes:['entry/src/main/resources'],scope:'mpv-choice',fixture:'tests/mpv-choice-fixture.cjs',earlyPhase:'ui-render',earlyOld:'await t.action(check);',earlyReplacement:"f.trace().call('ui-render',()=>{});await t.action(check);"};

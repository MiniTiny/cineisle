const recipes=[
  {
    "id": "cache-byte-drift--1",
    "file": "entry/src/main/ets/service/AssFonts.ets",
    "old": "maximumCachedConfigurationReadBytes: number = 1024 * 1024",
    "replacement": "maximumCachedConfigurationReadBytes: number = 1024 * 1024 - 1",
    "name": "font cache actual read admission bytes 1048576",
    "suite": "font-cache-admission-contract.test.cjs"
  },
  {
    "id": "cache-byte-drift-1",
    "file": "entry/src/main/ets/service/AssFonts.ets",
    "old": "maximumCachedConfigurationReadBytes: number = 1024 * 1024",
    "replacement": "maximumCachedConfigurationReadBytes: number = 1024 * 1024 + 1",
    "name": "font cache actual read admission bytes 1048577",
    "suite": "font-cache-admission-contract.test.cjs"
  },
  {
    "id": "cache-read-guard-remove",
    "file": "entry/src/main/ets/service/AssFonts.ets",
    "old": "fs.statSync(configuration).size > AssFonts.maximumCachedConfigurationReadBytes",
    "replacement": "fs.statSync(configuration).size < 0",
    "name": "font cache actual read admission bytes 1048577",
    "suite": "font-cache-admission-contract.test.cjs"
  },
  {
    "id": "cache-read-bound-compare",
    "file": "entry/src/main/ets/service/AssFonts.ets",
    "old": "fs.statSync(configuration).size > AssFonts.maximumCachedConfigurationReadBytes",
    "replacement": "fs.statSync(configuration).size >= AssFonts.maximumCachedConfigurationReadBytes",
    "name": "font cache actual read admission bytes 1048576",
    "suite": "font-cache-admission-contract.test.cjs"
  }
];
const controls=[
  {
    "name": "font cache actual read admission bytes 1048576",
    "phase": "font-config",
    "nativeInit": "font",
    "scope": "ass-font-budget",
    "suite": "font-cache-admission-contract.test.cjs"
  },
  {
    "name": "font cache actual read admission bytes 1048576",
    "phase": "font-face",
    "requiredCalls": {
      "font-config": 1
    },
    "scope": "ass-font-budget",
    "suite": "font-cache-admission-contract.test.cjs"
  },
  {
    "name": "font cache actual read admission bytes 1048576",
    "phase": "file-stat",
    "requiredCalls": {
      "font-face": 1
    },
    "details": {
      "filename": "fonts.conf"
    },
    "scope": "ass-font-budget",
    "suite": "font-cache-admission-contract.test.cjs"
  },
  {
    "name": "font cache actual read admission bytes 1048576",
    "phase": "file-read",
    "requiredCalls": {
      "file-stat": 1
    },
    "details": {
      "filename": "fonts.conf"
    },
    "scope": "ass-font-budget",
    "suite": "font-cache-admission-contract.test.cjs"
  },
  {
    "name": "font cache actual read admission bytes 1048577",
    "phase": "file-write",
    "requiredCalls": {
      "file-stat": 1
    },
    "details": {
      "filename": "fonts.conf.tmp"
    },
    "scope": "ass-font-budget",
    "suite": "font-cache-admission-contract.test.cjs"
  },
  {
    "name": "font cache actual read admission bytes 1048577",
    "phase": "file-rename",
    "requiredCalls": {
      "file-write": 1,
      "file-sync": 1,
      "file-close": 1
    },
    "details": {
      "filename": "fonts.conf"
    },
    "scope": "ass-font-budget",
    "suite": "font-cache-admission-contract.test.cjs"
  },
  {
    "name": "font cache unchanged actual content avoids replacement and retains timestamp",
    "phase": "setup",
    "scope": "ass-font-budget",
    "suite": "font-cache-admission-contract.test.cjs"
  }
];
module.exports={recipes,controls,scope:'ass-font-budget',fixture:'tests/ass-font-budget-fixture.cjs',earlyPhase:'file-rename',earlyOld:'try{await test.action(check);',earlyReplacement:"try{f.trace().call('file-rename',()=>{});await test.action(check);",selfFaults:[{id:'native-font-init-capture',phase:'font-config',file:'tests/ass-font-budget-fixture.cjs',old:"f.trace().call('font-config',()=>{",replacement:"((phase,operation)=>operation())('font-config',()=>{",status:'detected'}]};

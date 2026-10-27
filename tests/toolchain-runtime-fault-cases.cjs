const recipes=[
  {
    "id": "default-location-drift",
    "file": "config/deveco.json",
    "old": "/Applications/DevEco-Studio.app/Contents",
    "replacement": "/Applications/DevEco-Other.app/Contents",
    "name": "toolchain Node roots default",
    "suite": "toolchain-runtime-contract.test.cjs"
  },
  {
    "id": "IDE-override-remove",
    "file": "tests/deveco-runtime.cjs",
    "old": "option('DEVECO_CONTENTS',defaults.defaultContents)",
    "replacement": "defaults.defaultContents",
    "name": "toolchain Node roots independent roots",
    "suite": "toolchain-runtime-contract.test.cjs"
  },
  {
    "id": "SDK-override-remove",
    "file": "tests/deveco-runtime.cjs",
    "old": "option('DEVECO_SDK_HOME',contents+'/sdk')",
    "replacement": "contents+'/sdk'",
    "name": "toolchain Node roots independent roots",
    "suite": "toolchain-runtime-contract.test.cjs"
  },
  {
    "id": "Node-override-remove",
    "file": "tests/deveco-runtime.cjs",
    "old": "option('NODE_HOME',bundledNodeHome)",
    "replacement": "bundledNodeHome",
    "name": "toolchain Node roots independent roots",
    "suite": "toolchain-runtime-contract.test.cjs"
  },
  {
    "id": "NDK-override-remove",
    "file": "tests/deveco-runtime.cjs",
    "old": "option('OHOS_NDK_HOME',sdkHome+'/default/openharmony/native')",
    "replacement": "sdkHome+'/default/openharmony/native'",
    "name": "toolchain Node roots independent roots",
    "suite": "toolchain-runtime-contract.test.cjs"
  },
  {
    "id": "Node-empty-mode-drift",
    "file": "tests/deveco-runtime.cjs",
    "old": "emptyIsDefault?(env[key]||fallback):(env[key]===undefined?fallback:env[key])",
    "replacement": "env[key]===undefined?fallback:env[key]",
    "name": "toolchain Node roots empty default",
    "suite": "toolchain-runtime-contract.test.cjs"
  },
  {
    "id": "Python-SDK-override-remove",
    "file": "scripts/deveco-runtime.py",
    "old": "sdk = option('DEVECO_SDK_HOME', contents + '/sdk')",
    "replacement": "sdk = contents + '/sdk'",
    "name": "toolchain Python roots independent roots",
    "suite": "toolchain-runtime-contract.test.cjs"
  },
  {
    "id": "Python-legacy-empty-mode-drift",
    "file": "scripts/deveco-runtime.py",
    "old": "fallback if value is None else value",
    "replacement": "value or fallback",
    "name": "toolchain Python roots legacy empty presence",
    "suite": "toolchain-runtime-contract.test.cjs"
  },
  {
    "id": "build-Node-parameter-drift",
    "file": "scripts/build.sh",
    "old": "export NODE_HOME=\"${deveco_paths[1]}\"",
    "replacement": "export NODE_HOME=\"${deveco_paths[2]}\"",
    "name": "toolchain actual build driver preserves environment and argument order",
    "suite": "toolchain-runtime-contract.test.cjs"
  },
  {
    "id": "build-SDK-parameter-drift",
    "file": "scripts/build.sh",
    "old": "export DEVECO_SDK_HOME=\"${deveco_paths[2]}\"",
    "replacement": "export DEVECO_SDK_HOME=\"${deveco_paths[1]}\"",
    "name": "toolchain actual build driver preserves environment and argument order",
    "suite": "toolchain-runtime-contract.test.cjs"
  },
  {
    "id": "actual-SDK-loader-argument-drift",
    "file": "tests/deveco-runtime.cjs",
    "old": "etsLoader:path.join(sdkHome,'default/openharmony/ets/build-tools/ets-loader')",
    "replacement": "etsLoader:path.join(contents,'sdk/default/openharmony/ets/build-tools/ets-loader')",
    "name": "toolchain actual SDK loader honors independent SDK root with spaces",
    "suite": "toolchain-runtime-contract.test.cjs"
  }
];
const controls=[
  {
    "name": "toolchain Python roots independent roots",
    "phase": "python-runtime",
    "nativeInit": "toolchain",
    "requiredCalls": {
      "runtime-load": 1
    },
    "details": {
      "originalCode": "ENOENT"
    },
    "scope": "toolchain-runtime",
    "suite": "toolchain-runtime-contract.test.cjs"
  },
  {
    "name": "toolchain actual SDK loader honors independent SDK root with spaces",
    "phase": "sdk-compile",
    "nativeInit": "sdk",
    "requiredCalls": {
      "runtime-load": 2
    },
    "details": {
      "originalCode": "MODULE_NOT_FOUND",
      "requested": true
    },
    "scope": "toolchain-runtime",
    "suite": "toolchain-runtime-contract.test.cjs"
  },
  {
    "name": "toolchain actual build driver preserves environment and argument order",
    "phase": "build-driver",
    "nativeInit": "driver",
    "requiredCalls": {
      "python-runtime": 1,
      "runtime-load": 1
    },
    "details": {
      "missingTool": true
    },
    "scope": "toolchain-runtime",
    "suite": "toolchain-runtime-contract.test.cjs"
  },
  {
    "name": "toolchain Node roots independent roots",
    "phase": "runtime-load",
    "scope": "toolchain-runtime",
    "suite": "toolchain-runtime-contract.test.cjs"
  },
  {
    "name": "toolchain Node roots default",
    "phase": "setup",
    "scope": "toolchain-runtime",
    "suite": "toolchain-runtime-contract.test.cjs"
  }
];
module.exports={recipes,controls,extraScopes:['scripts','entry/src/main/resources'],scope:'toolchain-runtime',fixture:'tests/toolchain-runtime-fixture.cjs',earlyPhase:'python-runtime',earlyOld:'await test.action(check);',earlyReplacement:"trace.call('python-runtime',()=>{});await test.action(check);",selfFaults:[{id:'actual-python-spawn-capture',phase:'python-runtime',file:'tests/toolchain-runtime-fixture.cjs',old:"return trace.call('python-runtime',()=>{",replacement:"return ((phase,operation)=>operation())('python-runtime',()=>{"},{id:'SDK-module-init-capture',phase:'sdk-compile',file:'tests/toolchain-runtime-fixture.cjs',old:"trace.call('sdk-compile',()=>{",replacement:"((phase,operation)=>operation())('sdk-compile',()=>{"}]};

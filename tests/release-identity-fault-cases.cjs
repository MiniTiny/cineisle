const recipes=[
  {
    "id": "version-code-drift-19999",
    "file": "AppScope/app.json5",
    "old": "\"versionCode\": 20000",
    "replacement": "\"versionCode\": 19999",
    "name": "release frozen metadata retains version 0.2.0 and code 20000",
    "suite": "release-identity-contract.test.cjs"
  },
  {
    "id": "version-code-drift-20001",
    "file": "AppScope/app.json5",
    "old": "\"versionCode\": 20000",
    "replacement": "\"versionCode\": 20001",
    "name": "release frozen metadata retains version 0.2.0 and code 20000",
    "suite": "release-identity-contract.test.cjs"
  },
  {
    "id": "app-version",
    "file": "AppScope/app.json5",
    "old": "\"versionName\": \"0.2.0\"",
    "replacement": "\"versionName\": \"0.2.1\"",
    "name": "release frozen metadata retains version 0.2.0 and code 20000",
    "suite": "release-identity-contract.test.cjs"
  },
  {
    "id": "root-package-version",
    "file": "oh-package.json5",
    "old": "\"version\": \"0.2.0\"",
    "replacement": "\"version\": \"0.2.1\"",
    "name": "release frozen metadata retains version 0.2.0 and code 20000",
    "suite": "release-identity-contract.test.cjs"
  },
  {
    "id": "entry-package-version",
    "file": "entry/oh-package.json5",
    "old": "\"version\": \"0.2.0\"",
    "replacement": "\"version\": \"0.2.1\"",
    "name": "release frozen metadata retains version 0.2.0 and code 20000",
    "suite": "release-identity-contract.test.cjs"
  },
  {
    "id": "wire-client-version",
    "file": "entry/src/main/ets/utils/ProductIdentity.ts",
    "old": "VERSION: string = '0.2.0'",
    "replacement": "VERSION: string = '0.2.1'",
    "name": "release actual HTTP authorization retains client app version",
    "suite": "release-identity-contract.test.cjs"
  },
  {
    "id": "label-version-base",
    "file": "entry/src/main/resources/base/element/string.json",
    "old": "0.2.0",
    "replacement": "0.2.1",
    "name": "release localized labels retain app version independently of native schemas",
    "suite": "release-identity-contract.test.cjs"
  },
  {
    "id": "label-version-en_US",
    "file": "entry/src/main/resources/en_US/element/string.json",
    "old": "0.2.0",
    "replacement": "0.2.1",
    "name": "release localized labels retain app version independently of native schemas",
    "suite": "release-identity-contract.test.cjs"
  }
];
const controls=[
  {
    "name": "release frozen metadata retains version 0.2.0 and code 20000",
    "phase": "metadata-read",
    "nativeInit": "metadata",
    "details": {
      "relative": "AppScope/app.json5",
      "originalCode": "ENOENT"
    },
    "scope": "release-identity",
    "suite": "release-identity-contract.test.cjs"
  },
  {
    "name": "release actual HTTP authorization retains client app version",
    "phase": "http-create",
    "nativeInit": true,
    "scope": "release-identity",
    "suite": "release-identity-contract.test.cjs"
  },
  {
    "name": "release actual HTTP authorization retains client app version",
    "phase": "request",
    "requiredCalls": {
      "http-create": 1
    },
    "scope": "release-identity",
    "suite": "release-identity-contract.test.cjs"
  },
  {
    "name": "release localized labels retain app version independently of native schemas",
    "phase": "labels-read",
    "scope": "release-identity",
    "suite": "release-identity-contract.test.cjs"
  },
  {
    "name": "release frozen metadata retains version 0.2.0 and code 20000",
    "phase": "setup",
    "scope": "release-identity",
    "suite": "release-identity-contract.test.cjs"
  }
];
module.exports={recipes,controls,extraScopes:['AppScope','oh-package.json5','entry/oh-package.json5','entry/src/main/resources','scripts'],scope:'release-identity',fixture:'tests/release-identity-fixture.cjs',earlyPhase:'request',earlyOld:'try{await test.action(check);',earlyReplacement:"try{f.trace().call('request',()=>{});await test.action(check);",selfFaults:[{id:'metadata-native-read-capture',phase:'metadata-read',file:'tests/release-identity-fixture.cjs',old:"f.trace().call('metadata-read',()=>{",replacement:"((phase,operation)=>operation())('metadata-read',()=>{"},{id:'HTTP-native-init-capture',phase:'http-create',file:'tests/catalog-contract-fixture.cjs',old:"trace.call('http-create',()=>{",replacement:"((phase,operation)=>operation())('http-create',()=>{"}]};

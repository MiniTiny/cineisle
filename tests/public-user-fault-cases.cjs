const recipes=[
  {
    "id": "count-drift-999",
    "file": "entry/src/main/ets/service/JellyfinClient.ets",
    "old": "maximumPublicUsers: number = 1000",
    "replacement": "maximumPublicUsers: number = 999",
    "name": "public users native count 1000",
    "suite": "public-user-contract.test.cjs"
  },
  {
    "id": "count-drift-1001",
    "file": "entry/src/main/ets/service/JellyfinClient.ets",
    "old": "maximumPublicUsers: number = 1000",
    "replacement": "maximumPublicUsers: number = 1001",
    "name": "public users native count 1001",
    "suite": "public-user-contract.test.cjs"
  },
  {
    "id": "name-drift-255",
    "file": "entry/src/main/ets/service/JellyfinClient.ets",
    "old": "maximumPublicNameCodeUnits: number = 256",
    "replacement": "maximumPublicNameCodeUnits: number = 255",
    "name": "public users native name 256 unicode true",
    "suite": "public-user-contract.test.cjs"
  },
  {
    "id": "name-drift-257",
    "file": "entry/src/main/ets/service/JellyfinClient.ets",
    "old": "maximumPublicNameCodeUnits: number = 256",
    "replacement": "maximumPublicNameCodeUnits: number = 257",
    "name": "public users native name 257 unicode true",
    "suite": "public-user-contract.test.cjs"
  },
  {
    "id": "count-protection-remove",
    "file": "entry/src/main/ets/service/JellyfinClient.ets",
    "old": "users.length > JellyfinClient.maximumPublicUsers",
    "replacement": "false",
    "name": "public users facade count 1001",
    "suite": "public-user-contract.test.cjs"
  },
  {
    "id": "count-comparison",
    "file": "entry/src/main/ets/service/JellyfinClient.ets",
    "old": "users.length > JellyfinClient.maximumPublicUsers",
    "replacement": "users.length >= JellyfinClient.maximumPublicUsers",
    "name": "public users lower count 1000",
    "suite": "public-user-contract.test.cjs"
  },
  {
    "id": "name-protection-remove",
    "file": "entry/src/main/ets/service/JellyfinClient.ets",
    "old": "user.Name.length > JellyfinClient.maximumPublicNameCodeUnits",
    "replacement": "false",
    "name": "public users native name 257 unicode false",
    "suite": "public-user-contract.test.cjs"
  },
  {
    "id": "name-comparison",
    "file": "entry/src/main/ets/service/JellyfinClient.ets",
    "old": "user.Name.length > JellyfinClient.maximumPublicNameCodeUnits",
    "replacement": "user.Name.length >= JellyfinClient.maximumPublicNameCodeUnits",
    "name": "public users lower name 256 unicode true",
    "suite": "public-user-contract.test.cjs"
  },
  {
    "id": "authenticated-protection-remove",
    "file": "entry/src/main/ets/service/JellyfinClient.ets",
    "old": "if (this.session.token) { throw new Error('api_session_invalid'); }",
    "replacement": "if (false) { throw new Error('api_session_invalid'); }",
    "name": "public users authenticated client fails before actual HTTP",
    "suite": "public-user-contract.test.cjs"
  },
  {
    "id": "validation-after-dedup",
    "file": "entry/src/main/ets/service/JellyfinClient.ets",
    "old": "for (const user of users) {",
    "replacement": "for (const user of users) { if (result.some((value: PublicUser) => value.id === user?.Id)) { continue; }",
    "name": "public users duplicate invalid record is validated before deduplication",
    "suite": "public-user-contract.test.cjs"
  }
];
const controls=[
  {
    "name": "public users facade count 1000",
    "phase": "http-create",
    "nativeInit": 2,
    "requiredCalls": {
      "version": 1,
      "http-create": 2
    },
    "scope": "public-user",
    "suite": "public-user-contract.test.cjs"
  },
  {
    "name": "public users facade count 1000",
    "phase": "http-create",
    "nativeInit": 1,
    "scope": "public-user",
    "suite": "public-user-contract.test.cjs"
  },
  {
    "name": "public users facade count 1000",
    "phase": "request",
    "requiredCalls": {
      "version": 1,
      "http-create": 2
    },
    "details": {
      "pathname": "/jellyfin/Users/Public"
    },
    "scope": "public-user",
    "suite": "public-user-contract.test.cjs"
  },
  {
    "name": "public users lower count 1000",
    "phase": "api-users",
    "scope": "public-user",
    "suite": "public-user-contract.test.cjs"
  },
  {
    "name": "public users actual SDK picker shows original validation error",
    "phase": "ui-compile",
    "scope": "public-user",
    "suite": "public-user-contract.test.cjs"
  },
  {
    "name": "public users native count 1000",
    "phase": "setup",
    "scope": "public-user",
    "suite": "public-user-contract.test.cjs"
  }
];
module.exports={recipes,controls,extraScopes:['entry/src/main/resources'],scope:'public-user',fixture:'tests/public-user-fixture.cjs',earlyPhase:'request',earlyOld:'await test.action(check);',earlyReplacement:"f.trace().call('request',()=>{});await test.action(check);",selfFaults:[{id:'anonymous-native-init-capture',phase:'http-create',file:'tests/catalog-contract-fixture.cjs',old:"trace.call('http-create',()=>{",replacement:"((phase,operation)=>operation())('http-create',()=>{",status:'detected'}]};

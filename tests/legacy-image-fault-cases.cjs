const recipes = [
  {
    "id": "defaultPrimaryImageWidthPx-1",
    "file": "entry/src/main/ets/service/JellyfinClient.ets",
    "old": "defaultPrimaryImageWidthPx: number = 360",
    "replacement": "defaultPrimaryImageWidthPx: number = 359",
    "name": "legacy image cold primary untagged",
    "suite": "legacy-image-contract.test.cjs"
  },
  {
    "id": "defaultPrimaryImageWidthPx1",
    "file": "entry/src/main/ets/service/JellyfinClient.ets",
    "old": "defaultPrimaryImageWidthPx: number = 360",
    "replacement": "defaultPrimaryImageWidthPx: number = 361",
    "name": "legacy image cold primary untagged",
    "suite": "legacy-image-contract.test.cjs"
  },
  {
    "id": "defaultBackdropImageWidthPx-1",
    "file": "entry/src/main/ets/service/JellyfinClient.ets",
    "old": "defaultBackdropImageWidthPx: number = 960",
    "replacement": "defaultBackdropImageWidthPx: number = 959",
    "name": "legacy image cold backdrop untagged",
    "suite": "legacy-image-contract.test.cjs"
  },
  {
    "id": "defaultBackdropImageWidthPx1",
    "file": "entry/src/main/ets/service/JellyfinClient.ets",
    "old": "defaultBackdropImageWidthPx: number = 960",
    "replacement": "defaultBackdropImageWidthPx: number = 961",
    "name": "legacy image cold backdrop untagged",
    "suite": "legacy-image-contract.test.cjs"
  },
  {
    "id": "defaultImageQuality-1",
    "file": "entry/src/main/ets/service/JellyfinClient.ets",
    "old": "defaultImageQuality: number = 85",
    "replacement": "defaultImageQuality: number = 84",
    "name": "legacy image cold primary untagged",
    "suite": "legacy-image-contract.test.cjs"
  },
  {
    "id": "defaultImageQuality1",
    "file": "entry/src/main/ets/service/JellyfinClient.ets",
    "old": "defaultImageQuality: number = 85",
    "replacement": "defaultImageQuality: number = 86",
    "name": "legacy image cold primary untagged",
    "suite": "legacy-image-contract.test.cjs"
  },
  {
    "id": "defaultPrimaryImageWidthPx-consumer",
    "file": "entry/src/main/ets/service/JellyfinClient.ets",
    "old": "maxWidth: JellyfinClient.defaultPrimaryImageWidthPx",
    "replacement": "maxWidth: JellyfinClient.defaultPrimaryImageWidthPx + 1",
    "name": "legacy image cold primary untagged",
    "suite": "legacy-image-contract.test.cjs"
  },
  {
    "id": "primary-quality-consumer",
    "file": "entry/src/main/ets/service/JellyfinClient.ets",
    "old": "maxWidth: JellyfinClient.defaultPrimaryImageWidthPx, quality: JellyfinClient.defaultImageQuality",
    "replacement": "maxWidth: JellyfinClient.defaultPrimaryImageWidthPx, quality: JellyfinClient.defaultImageQuality + 1",
    "name": "legacy image cold primary tagged",
    "suite": "legacy-image-contract.test.cjs"
  },
  {
    "id": "defaultBackdropImageWidthPx-consumer",
    "file": "entry/src/main/ets/service/JellyfinClient.ets",
    "old": "maxWidth: JellyfinClient.defaultBackdropImageWidthPx",
    "replacement": "maxWidth: JellyfinClient.defaultBackdropImageWidthPx + 1",
    "name": "legacy image cold backdrop untagged",
    "suite": "legacy-image-contract.test.cjs"
  },
  {
    "id": "backdrop-quality-consumer",
    "file": "entry/src/main/ets/service/JellyfinClient.ets",
    "old": "maxWidth: JellyfinClient.defaultBackdropImageWidthPx, quality: JellyfinClient.defaultImageQuality",
    "replacement": "maxWidth: JellyfinClient.defaultBackdropImageWidthPx, quality: JellyfinClient.defaultImageQuality + 1",
    "name": "legacy image cold backdrop tagged",
    "suite": "legacy-image-contract.test.cjs"
  },
  {
    "id": "backdrop-branch-remove",
    "file": "entry/src/main/ets/service/JellyfinClient.ets",
    "old": "if (backdrop) {",
    "replacement": "if (false) {",
    "name": "legacy image cold backdrop tagged",
    "suite": "legacy-image-contract.test.cjs"
  }
];
const controls = [
  {
    "phase": "url-parse",
    "name": "legacy image cold primary untagged",
    "suite": "legacy-image-contract.test.cjs",
    "scope": "legacy-image",
    "requiredCalls": {
      "url-build": 1
    }
  },
  {
    "phase": "url-build",
    "name": "legacy image cold backdrop tagged",
    "suite": "legacy-image-contract.test.cjs",
    "scope": "legacy-image"
  },
  {
    "phase": "setup",
    "name": "legacy image cold primary untagged",
    "suite": "legacy-image-contract.test.cjs",
    "scope": "legacy-image"
  }
];
module.exports={recipes,controls,scope:'legacy-image',fixture:'tests/legacy-image-contract-fixture.cjs',earlyPhase:'url-parse',earlyOld:'await test.action(check);',earlyReplacement:"f.trace().call('url-parse',()=>{}); await test.action(check);"};

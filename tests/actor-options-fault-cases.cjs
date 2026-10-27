const recipes=[
  {
    "id": "value-playCount",
    "file": "entry/src/main/ets/utils/ActorOrder.ts",
    "old": "value: 'playCount'",
    "replacement": "value: 'drift-playCount'",
    "name": "actor options actual UI playCount",
    "suite": "actor-options-contract.test.cjs"
  },
  {
    "id": "caption-playCount",
    "file": "entry/src/main/ets/utils/ActorOrder.ts",
    "old": "caption: 'actor_order_play'",
    "replacement": "caption: 'drift-actor_order_play'",
    "name": "actor options actual UI playCount",
    "suite": "actor-options-contract.test.cjs"
  },
  {
    "id": "value-watched",
    "file": "entry/src/main/ets/utils/ActorOrder.ts",
    "old": "value: 'watched'",
    "replacement": "value: 'drift-watched'",
    "name": "actor options actual UI watched",
    "suite": "actor-options-contract.test.cjs"
  },
  {
    "id": "caption-watched",
    "file": "entry/src/main/ets/utils/ActorOrder.ts",
    "old": "caption: 'actor_order_watched'",
    "replacement": "caption: 'drift-actor_order_watched'",
    "name": "actor options actual UI playCount",
    "suite": "actor-options-contract.test.cjs"
  },
  {
    "id": "value-unplayed",
    "file": "entry/src/main/ets/utils/ActorOrder.ts",
    "old": "value: 'unplayed'",
    "replacement": "value: 'drift-unplayed'",
    "name": "actor options actual UI unplayed",
    "suite": "actor-options-contract.test.cjs"
  },
  {
    "id": "caption-unplayed",
    "file": "entry/src/main/ets/utils/ActorOrder.ts",
    "old": "caption: 'actor_order_unplayed'",
    "replacement": "caption: 'drift-actor_order_unplayed'",
    "name": "actor options actual UI playCount",
    "suite": "actor-options-contract.test.cjs"
  },
  {
    "id": "value-works",
    "file": "entry/src/main/ets/utils/ActorOrder.ts",
    "old": "value: 'works'",
    "replacement": "value: 'drift-works'",
    "name": "actor options actual UI works",
    "suite": "actor-options-contract.test.cjs"
  },
  {
    "id": "caption-works",
    "file": "entry/src/main/ets/utils/ActorOrder.ts",
    "old": "caption: 'actor_order_works'",
    "replacement": "caption: 'drift-actor_order_works'",
    "name": "actor options actual UI playCount",
    "suite": "actor-options-contract.test.cjs"
  },
  {
    "id": "value-recent",
    "file": "entry/src/main/ets/utils/ActorOrder.ts",
    "old": "value: 'recent'",
    "replacement": "value: 'drift-recent'",
    "name": "actor options actual UI recent",
    "suite": "actor-options-contract.test.cjs"
  },
  {
    "id": "caption-recent",
    "file": "entry/src/main/ets/utils/ActorOrder.ts",
    "old": "caption: 'actor_order_recent'",
    "replacement": "caption: 'drift-actor_order_recent'",
    "name": "actor options actual UI playCount",
    "suite": "actor-options-contract.test.cjs"
  },
  {
    "id": "value-name",
    "file": "entry/src/main/ets/utils/ActorOrder.ts",
    "old": "value: 'name'",
    "replacement": "value: 'drift-name'",
    "name": "actor options actual UI name",
    "suite": "actor-options-contract.test.cjs"
  },
  {
    "id": "caption-name",
    "file": "entry/src/main/ets/utils/ActorOrder.ts",
    "old": "caption: 'actor_order_name'",
    "replacement": "caption: 'drift-actor_order_name'",
    "name": "actor options actual UI playCount",
    "suite": "actor-options-contract.test.cjs"
  },
  {
    "id": "value-recommended",
    "file": "entry/src/main/ets/utils/ActorOrder.ts",
    "old": "value: 'recommended'",
    "replacement": "value: 'drift-recommended'",
    "name": "actor options actual UI recommended",
    "suite": "actor-options-contract.test.cjs"
  },
  {
    "id": "caption-recommended",
    "file": "entry/src/main/ets/utils/ActorOrder.ts",
    "old": "caption: 'actor_order_recommended'",
    "replacement": "caption: 'drift-actor_order_recommended'",
    "name": "actor options actual UI playCount",
    "suite": "actor-options-contract.test.cjs"
  },
  {
    "id": "default-drift",
    "file": "entry/src/main/ets/utils/ActorOrder.ts",
    "old": "defaultActorOrder: string = 'playCount'",
    "replacement": "defaultActorOrder: string = 'name'",
    "name": "actor options default remains play count",
    "suite": "actor-options-contract.test.cjs"
  },
  {
    "id": "validator-remove",
    "file": "entry/src/main/ets/utils/Experience.ts",
    "old": "actorOrders.some((choice: ActorOrderChoice) => choice.value === value.actorOrder)",
    "replacement": "true",
    "name": "actor options rejects persisted unknown",
    "suite": "actor-options-contract.test.cjs"
  },
  {
    "id": "selected-drift",
    "file": "entry/src/main/ets/pages/Index.ets",
    "old": "actorOrders.findIndex((choice: ActorOrderChoice) => choice.value === this.actorOrder)",
    "replacement": "0",
    "name": "actor options actual UI watched",
    "suite": "actor-options-contract.test.cjs"
  },
  {
    "id": "selection-drift",
    "file": "entry/src/main/ets/pages/Index.ets",
    "old": "this.actorOrder = actorOrders[index]?.value",
    "replacement": "this.actorOrder = actorOrders[0]?.value",
    "name": "actor options actual durable watched",
    "suite": "actor-options-contract.test.cjs"
  },
  {
    "id": "reset-default-drift",
    "file": "entry/src/main/ets/pages/Index.ets",
    "old": "state?.actorOrder ?? defaultActorOrder",
    "replacement": "state?.actorOrder ?? 'name'",
    "name": "actor options missing store reset uses original default",
    "suite": "actor-options-contract.test.cjs"
  }
];
const controls=[
  {
    "name": "actor options actual UI watched",
    "phase": "ui-compile",
    "scope": "actor-options",
    "suite": "actor-options-contract.test.cjs"
  },
  {
    "name": "actor options actual durable watched",
    "phase": "file-write",
    "requiredCalls": {
      "ui-compile": 1,
      "file-tryLock": 1
    },
    "details": {
      "filename": "experience.json.tmp",
      "stage": "business"
    },
    "scope": "actor-options",
    "suite": "actor-options-contract.test.cjs"
  },
  {
    "name": "actor options rejects persisted unknown",
    "phase": "setup",
    "scope": "actor-options",
    "suite": "actor-options-contract.test.cjs"
  }
];
module.exports={recipes,controls,extraScopes:['entry/src/main/resources'],scope:'actor-options',fixture:'tests/actor-options-fixture.cjs',earlyPhase:'file-write',earlyOld:'await t.action(check);',earlyReplacement:"f.trace().call('file-write',()=>{});await t.action(check);"};

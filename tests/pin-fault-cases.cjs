module.exports = {
  "recipes": [
    {
      "id": "minPinDigits-1",
      "file": "entry/src/main/ets/utils/LockPolicy.ts",
      "old": "minPinDigits: number = 6",
      "replacement": "minPinDigits: number = 5",
      "name": "facade PIN digits 5",
      "suite": "pin-contract.test.cjs"
    },
    {
      "id": "minPinDigits1",
      "file": "entry/src/main/ets/utils/LockPolicy.ts",
      "old": "minPinDigits: number = 6",
      "replacement": "minPinDigits: number = 7",
      "name": "facade PIN digits 6",
      "suite": "pin-contract.test.cjs"
    },
    {
      "id": "maxPinDigits-1",
      "file": "entry/src/main/ets/utils/LockPolicy.ts",
      "old": "maxPinDigits: number = 12",
      "replacement": "maxPinDigits: number = 11",
      "name": "facade PIN digits 12",
      "suite": "pin-contract.test.cjs"
    },
    {
      "id": "maxPinDigits1",
      "file": "entry/src/main/ets/utils/LockPolicy.ts",
      "old": "maxPinDigits: number = 12",
      "replacement": "maxPinDigits: number = 13",
      "name": "facade PIN digits 13",
      "suite": "pin-contract.test.cjs"
    },
    {
      "id": "gate-method-remove",
      "file": "entry/src/main/ets/components/PinGate.ets",
      "old": "this.pin.length < AppLockPolicy.minPinDigits",
      "replacement": "false",
      "name": "gate PIN digits 5",
      "suite": "pin-contract.test.cjs"
    },
    {
      "id": "gate-button-remove",
      "file": "entry/src/main/ets/components/PinGate.ets",
      "old": "this.pin.length >= AppLockPolicy.minPinDigits",
      "replacement": "true",
      "name": "gate PIN digits 5",
      "suite": "pin-contract.test.cjs"
    },
    {
      "id": "gate-method-comparator",
      "file": "entry/src/main/ets/components/PinGate.ets",
      "old": "this.pin.length < AppLockPolicy.minPinDigits",
      "replacement": "this.pin.length <= AppLockPolicy.minPinDigits",
      "name": "gate PIN digits 6",
      "suite": "pin-contract.test.cjs"
    },
    {
      "id": "gate-button-comparator",
      "file": "entry/src/main/ets/components/PinGate.ets",
      "old": "this.pin.length >= AppLockPolicy.minPinDigits",
      "replacement": "this.pin.length > AppLockPolicy.minPinDigits",
      "name": "gate PIN digits 6",
      "suite": "pin-contract.test.cjs"
    },
    {
      "id": "gate-method-consumer",
      "file": "entry/src/main/ets/components/PinGate.ets",
      "old": "this.pin.length < AppLockPolicy.minPinDigits",
      "replacement": "this.pin.length < AppLockPolicy.minPinDigits + 1",
      "name": "gate PIN digits 6",
      "suite": "pin-contract.test.cjs"
    },
    {
      "id": "input-pin-consumer",
      "file": "entry/src/main/ets/components/PinGate.ets",
      "old": "      TextInput({ text: this.pin, placeholder: $r('app.string.lock_pin') }).height(UiLayout.buttonHeight(this.fontScale)).type(InputType.NUMBER_PASSWORD).maxLength(AppLockPolicy.maxPinDigits).enabled(!this.busy)",
      "replacement": "      TextInput({ text: this.pin, placeholder: $r('app.string.lock_pin') }).height(UiLayout.buttonHeight(this.fontScale)).type(InputType.NUMBER_PASSWORD).maxLength(AppLockPolicy.maxPinDigits + 1).enabled(!this.busy)",
      "name": "gate PIN digits 6",
      "suite": "pin-contract.test.cjs"
    },
    {
      "id": "input-currentPin-consumer",
      "file": "entry/src/main/ets/pages/Settings.ets",
      "old": "                  TextInput({ text: this.currentPin, placeholder: $r('app.string.lock_current_pin') }).height(UiLayout.buttonHeight(this.fontScale)).type(InputType.NUMBER_PASSWORD).maxLength(AppLockPolicy.maxPinDigits).fontColor(this.palette.foreground).placeholderColor(this.palette.muted).backgroundColor((this.amoled ? this.palette.amoledBackground : this.palette.surface)).borderRadius(12).enabled(!this.busy).onChange((v: string) => { this.currentPin = v; })",
      "replacement": "                  TextInput({ text: this.currentPin, placeholder: $r('app.string.lock_current_pin') }).height(UiLayout.buttonHeight(this.fontScale)).type(InputType.NUMBER_PASSWORD).maxLength(AppLockPolicy.maxPinDigits + 1).fontColor(this.palette.foreground).placeholderColor(this.palette.muted).backgroundColor((this.amoled ? this.palette.amoledBackground : this.palette.surface)).borderRadius(12).enabled(!this.busy).onChange((v: string) => { this.currentPin = v; })",
      "name": "settings PIN digits 6",
      "suite": "pin-contract.test.cjs"
    },
    {
      "id": "input-nextPin-consumer",
      "file": "entry/src/main/ets/pages/Settings.ets",
      "old": "                TextInput({ text: this.nextPin, placeholder: $r('app.string.lock_new_pin') }).height(UiLayout.buttonHeight(this.fontScale)).type(InputType.NUMBER_PASSWORD).maxLength(AppLockPolicy.maxPinDigits).fontColor(this.palette.foreground).placeholderColor(this.palette.muted).backgroundColor((this.amoled ? this.palette.amoledBackground : this.palette.surface)).borderRadius(12).enabled(!this.busy).onChange((v: string) => { this.nextPin = v; })",
      "replacement": "                TextInput({ text: this.nextPin, placeholder: $r('app.string.lock_new_pin') }).height(UiLayout.buttonHeight(this.fontScale)).type(InputType.NUMBER_PASSWORD).maxLength(AppLockPolicy.maxPinDigits + 1).fontColor(this.palette.foreground).placeholderColor(this.palette.muted).backgroundColor((this.amoled ? this.palette.amoledBackground : this.palette.surface)).borderRadius(12).enabled(!this.busy).onChange((v: string) => { this.nextPin = v; })",
      "name": "settings PIN digits 6",
      "suite": "pin-contract.test.cjs"
    },
    {
      "id": "input-confirmation-consumer",
      "file": "entry/src/main/ets/pages/Settings.ets",
      "old": "                TextInput({ text: this.confirmation, placeholder: $r('app.string.lock_confirm_pin') }).height(UiLayout.buttonHeight(this.fontScale)).type(InputType.NUMBER_PASSWORD).maxLength(AppLockPolicy.maxPinDigits).fontColor(this.palette.foreground).placeholderColor(this.palette.muted).backgroundColor((this.amoled ? this.palette.amoledBackground : this.palette.surface)).borderRadius(12).enabled(!this.busy).onChange((v: string) => { this.confirmation = v; })",
      "replacement": "                TextInput({ text: this.confirmation, placeholder: $r('app.string.lock_confirm_pin') }).height(UiLayout.buttonHeight(this.fontScale)).type(InputType.NUMBER_PASSWORD).maxLength(AppLockPolicy.maxPinDigits + 1).fontColor(this.palette.foreground).placeholderColor(this.palette.muted).backgroundColor((this.amoled ? this.palette.amoledBackground : this.palette.surface)).borderRadius(12).enabled(!this.busy).onChange((v: string) => { this.confirmation = v; })",
      "name": "settings PIN digits 6",
      "suite": "pin-contract.test.cjs"
    },
    {
      "id": "regex-min-consumer",
      "file": "entry/src/main/ets/utils/LockPolicy.ts",
      "old": "${AppLockPolicy.minPinDigits}",
      "replacement": "${AppLockPolicy.minPinDigits + 1}",
      "name": "facade PIN digits 6",
      "suite": "pin-contract.test.cjs"
    },
    {
      "id": "regex-max-consumer",
      "file": "entry/src/main/ets/utils/LockPolicy.ts",
      "old": "${AppLockPolicy.maxPinDigits}",
      "replacement": "${AppLockPolicy.maxPinDigits + 1}",
      "name": "facade PIN digits 13",
      "suite": "pin-contract.test.cjs"
    },
    {
      "id": "format-protection-remove",
      "file": "entry/src/main/ets/service/AppLock.ets",
      "old": "next && !AppLockPolicy.pinPattern.test(next)",
      "replacement": "false",
      "name": "facade PIN digits 5",
      "suite": "pin-contract.test.cjs"
    },
    {
      "id": "format-digits-remove",
      "file": "entry/src/main/ets/utils/LockPolicy.ts",
      "old": "`^\\\\d{",
      "replacement": "`^.{",
      "name": "facade PIN mixed",
      "suite": "pin-contract.test.cjs"
    },
    {
      "id": "settings-button-remove",
      "file": "entry/src/main/ets/pages/Settings.ets",
      "old": "this.nextPin.length >= AppLockPolicy.minPinDigits",
      "replacement": "true",
      "name": "settings PIN digits 5",
      "suite": "pin-contract.test.cjs"
    },
    {
      "id": "settings-button-comparator",
      "file": "entry/src/main/ets/pages/Settings.ets",
      "old": "this.nextPin.length >= AppLockPolicy.minPinDigits",
      "replacement": "this.nextPin.length > AppLockPolicy.minPinDigits",
      "name": "settings PIN digits 6",
      "suite": "pin-contract.test.cjs"
    },
    {
      "id": "settings-button-consumer",
      "file": "entry/src/main/ets/pages/Settings.ets",
      "old": "this.nextPin.length >= AppLockPolicy.minPinDigits",
      "replacement": "this.nextPin.length >= AppLockPolicy.minPinDigits + 1",
      "name": "settings PIN digits 6",
      "suite": "pin-contract.test.cjs"
    }
  ],
  "controls": [
    {
      "phase": "random-create",
      "name": "facade PIN digits 6",
      "suite": "pin-contract.test.cjs",
      "scope": "pin-contract",
      "nativeInit": "random-create",
      "requiredCalls": {
        "configure": 1
      }
    },
    {
      "phase": "kdf-create",
      "name": "facade PIN digits 6",
      "suite": "pin-contract.test.cjs",
      "scope": "pin-contract",
      "nativeInit": "kdf-create",
      "requiredCalls": {
        "random-generate": 1
      }
    },
    {
      "phase": "asset-add",
      "name": "facade PIN digits 6",
      "suite": "pin-contract.test.cjs",
      "scope": "pin-contract",
      "nativeInit": "asset-add",
      "requiredCalls": {
        "kdf-secret": 1
      }
    },
    {
      "phase": "asset-query",
      "name": "gate PIN digits 6",
      "suite": "pin-contract.test.cjs",
      "scope": "pin-contract",
      "nativeInit": "asset-query"
    },
    {
      "phase": "ui-compile",
      "name": "settings PIN digits 6",
      "suite": "pin-contract.test.cjs",
      "scope": "pin-contract",
      "requiredCalls": {
        "asset-query": 1
      }
    },
    {
      "phase": "setup",
      "name": "facade PIN digits 6",
      "suite": "pin-contract.test.cjs",
      "scope": "pin-contract"
    }
  ],
  "scope": "pin-contract",
  "extraScopes": [
    "entry/src/main/resources"
  ],
  "fixture": "tests/pin-contract-fixture.cjs",
  "earlyPhase": "asset-add",
  "earlyOld": "return original.configure.apply(A, args);",
  "earlyReplacement": "trace.call('asset-add', () => {}); return original.configure.apply(A, args);",
  "selfFaults": [
    {
      "id": "native-random-create-observer-remove",
      "phase": "random-create",
      "file": "tests/pin-contract-fixture.cjs",
      "old": "trace.call('random-create', () => {",
      "replacement": "((phase, operation) => operation())('random-create', () => {",
      "status": "detected"
    },
    {
      "id": "native-asset-add-observer-remove",
      "phase": "asset-add",
      "file": "tests/pin-contract-fixture.cjs",
      "old": "trace.call('asset-add', () => {",
      "replacement": "((phase, operation) => operation())('asset-add', () => {",
      "status": "detected"
    },
    {
      "id": "native-asset-query-observer-remove",
      "phase": "asset-query",
      "file": "tests/pin-contract-fixture.cjs",
      "old": "trace.call('asset-query', () => {",
      "replacement": "((phase, operation) => operation())('asset-query', () => {",
      "status": "detected"
    }
  ]
};

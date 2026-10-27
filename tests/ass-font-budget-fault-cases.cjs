const recipes=[
  {
    "id": "maximumDirectories-drift--1",
    "file": "entry/src/main/ets/utils/AssFontConfig.ts",
    "old": "maximumDirectories: number = 32",
    "replacement": "maximumDirectories: number = 31",
    "name": "font budget service directories 32",
    "suite": "ass-font-budget-contract.test.cjs"
  },
  {
    "id": "maximumDirectories-drift-1",
    "file": "entry/src/main/ets/utils/AssFontConfig.ts",
    "old": "maximumDirectories: number = 32",
    "replacement": "maximumDirectories: number = 33",
    "name": "font budget service directories 33",
    "suite": "ass-font-budget-contract.test.cjs"
  },
  {
    "id": "maximumGenericFamilies-drift--1",
    "file": "entry/src/main/ets/utils/AssFontConfig.ts",
    "old": "maximumGenericFamilies: number = 128",
    "replacement": "maximumGenericFamilies: number = 127",
    "name": "font budget service generic 128",
    "suite": "ass-font-budget-contract.test.cjs"
  },
  {
    "id": "maximumGenericFamilies-drift-1",
    "file": "entry/src/main/ets/utils/AssFontConfig.ts",
    "old": "maximumGenericFamilies: number = 128",
    "replacement": "maximumGenericFamilies: number = 129",
    "name": "font budget service generic 129",
    "suite": "ass-font-budget-contract.test.cjs"
  },
  {
    "id": "maximumAliasesPerFamily-drift--1",
    "file": "entry/src/main/ets/utils/AssFontConfig.ts",
    "old": "maximumAliasesPerFamily: number = 128",
    "replacement": "maximumAliasesPerFamily: number = 127",
    "name": "font budget service aliases 128",
    "suite": "ass-font-budget-contract.test.cjs"
  },
  {
    "id": "maximumAliasesPerFamily-drift-1",
    "file": "entry/src/main/ets/utils/AssFontConfig.ts",
    "old": "maximumAliasesPerFamily: number = 128",
    "replacement": "maximumAliasesPerFamily: number = 129",
    "name": "font budget service aliases 129",
    "suite": "ass-font-budget-contract.test.cjs"
  },
  {
    "id": "maximumFallbackGroups-drift--1",
    "file": "entry/src/main/ets/utils/AssFontConfig.ts",
    "old": "maximumFallbackGroups: number = 64",
    "replacement": "maximumFallbackGroups: number = 63",
    "name": "font budget service groups 64",
    "suite": "ass-font-budget-contract.test.cjs"
  },
  {
    "id": "maximumFallbackGroups-drift-1",
    "file": "entry/src/main/ets/utils/AssFontConfig.ts",
    "old": "maximumFallbackGroups: number = 64",
    "replacement": "maximumFallbackGroups: number = 65",
    "name": "font budget service groups 65",
    "suite": "ass-font-budget-contract.test.cjs"
  },
  {
    "id": "maximumFallbacksPerGroup-drift--1",
    "file": "entry/src/main/ets/utils/AssFontConfig.ts",
    "old": "maximumFallbacksPerGroup: number = 512",
    "replacement": "maximumFallbacksPerGroup: number = 511",
    "name": "font budget service fallbacks 512",
    "suite": "ass-font-budget-contract.test.cjs"
  },
  {
    "id": "maximumFallbacksPerGroup-drift-1",
    "file": "entry/src/main/ets/utils/AssFontConfig.ts",
    "old": "maximumFallbacksPerGroup: number = 512",
    "replacement": "maximumFallbacksPerGroup: number = 513",
    "name": "font budget service fallbacks 513",
    "suite": "ass-font-budget-contract.test.cjs"
  },
  {
    "id": "directories-compare",
    "file": "entry/src/main/ets/utils/AssFontConfig.ts",
    "old": "config.fontDir.length > AssFontConfigLimits.maximumDirectories",
    "replacement": "config.fontDir.length >= AssFontConfigLimits.maximumDirectories",
    "name": "font budget lower directories 32",
    "suite": "ass-font-budget-contract.test.cjs"
  },
  {
    "id": "directories-remove",
    "file": "entry/src/main/ets/utils/AssFontConfig.ts",
    "old": "config.fontDir.length > AssFontConfigLimits.maximumDirectories",
    "replacement": "false",
    "name": "font budget service directories 33",
    "suite": "ass-font-budget-contract.test.cjs"
  },
  {
    "id": "generic-compare",
    "file": "entry/src/main/ets/utils/AssFontConfig.ts",
    "old": "config.generic.length > AssFontConfigLimits.maximumGenericFamilies",
    "replacement": "config.generic.length >= AssFontConfigLimits.maximumGenericFamilies",
    "name": "font budget lower generic 128",
    "suite": "ass-font-budget-contract.test.cjs"
  },
  {
    "id": "generic-remove",
    "file": "entry/src/main/ets/utils/AssFontConfig.ts",
    "old": "config.generic.length > AssFontConfigLimits.maximumGenericFamilies",
    "replacement": "false",
    "name": "font budget service generic 129",
    "suite": "ass-font-budget-contract.test.cjs"
  },
  {
    "id": "aliases-compare",
    "file": "entry/src/main/ets/utils/AssFontConfig.ts",
    "old": "generic.alias.length > AssFontConfigLimits.maximumAliasesPerFamily",
    "replacement": "generic.alias.length >= AssFontConfigLimits.maximumAliasesPerFamily",
    "name": "font budget lower aliases 128",
    "suite": "ass-font-budget-contract.test.cjs"
  },
  {
    "id": "aliases-remove",
    "file": "entry/src/main/ets/utils/AssFontConfig.ts",
    "old": "generic.alias.length > AssFontConfigLimits.maximumAliasesPerFamily",
    "replacement": "false",
    "name": "font budget service aliases 129",
    "suite": "ass-font-budget-contract.test.cjs"
  },
  {
    "id": "groups-compare",
    "file": "entry/src/main/ets/utils/AssFontConfig.ts",
    "old": "config.fallbackGroups.length > AssFontConfigLimits.maximumFallbackGroups",
    "replacement": "config.fallbackGroups.length >= AssFontConfigLimits.maximumFallbackGroups",
    "name": "font budget lower groups 64",
    "suite": "ass-font-budget-contract.test.cjs"
  },
  {
    "id": "groups-remove",
    "file": "entry/src/main/ets/utils/AssFontConfig.ts",
    "old": "config.fallbackGroups.length > AssFontConfigLimits.maximumFallbackGroups",
    "replacement": "false",
    "name": "font budget service groups 65",
    "suite": "ass-font-budget-contract.test.cjs"
  },
  {
    "id": "fallbacks-compare",
    "file": "entry/src/main/ets/utils/AssFontConfig.ts",
    "old": "group.fallback.length > AssFontConfigLimits.maximumFallbacksPerGroup",
    "replacement": "group.fallback.length >= AssFontConfigLimits.maximumFallbacksPerGroup",
    "name": "font budget lower fallbacks 512",
    "suite": "ass-font-budget-contract.test.cjs"
  },
  {
    "id": "fallbacks-remove",
    "file": "entry/src/main/ets/utils/AssFontConfig.ts",
    "old": "group.fallback.length > AssFontConfigLimits.maximumFallbacksPerGroup",
    "replacement": "false",
    "name": "font budget service fallbacks 513",
    "suite": "ass-font-budget-contract.test.cjs"
  },
  {
    "id": "maximumDirectoryCodeUnits-drift--1",
    "file": "entry/src/main/ets/utils/AssFontConfig.ts",
    "old": "maximumDirectoryCodeUnits: number = 4096",
    "replacement": "maximumDirectoryCodeUnits: number = 4095",
    "name": "font budget lower directory code units 4096",
    "suite": "ass-font-budget-contract.test.cjs"
  },
  {
    "id": "maximumDirectoryCodeUnits-drift-1",
    "file": "entry/src/main/ets/utils/AssFontConfig.ts",
    "old": "maximumDirectoryCodeUnits: number = 4096",
    "replacement": "maximumDirectoryCodeUnits: number = 4097",
    "name": "font budget lower cache code units 4097",
    "suite": "ass-font-budget-contract.test.cjs"
  },
  {
    "id": "maximumFamilyCodeUnits-drift--1",
    "file": "entry/src/main/ets/utils/AssFontConfig.ts",
    "old": "maximumFamilyCodeUnits: number = 512",
    "replacement": "maximumFamilyCodeUnits: number = 511",
    "name": "font budget lower generic name 512 unicode true",
    "suite": "ass-font-budget-contract.test.cjs"
  },
  {
    "id": "maximumFamilyCodeUnits-drift-1",
    "file": "entry/src/main/ets/utils/AssFontConfig.ts",
    "old": "maximumFamilyCodeUnits: number = 512",
    "replacement": "maximumFamilyCodeUnits: number = 513",
    "name": "font budget lower fontSetName name 513 unicode true",
    "suite": "ass-font-budget-contract.test.cjs"
  },
  {
    "id": "path-guard-remove",
    "file": "entry/src/main/ets/utils/AssFontConfig.ts",
    "old": "value.length > AssFontConfigLimits.maximumDirectoryCodeUnits",
    "replacement": "false",
    "name": "font budget lower directory code units 4097",
    "suite": "ass-font-budget-contract.test.cjs"
  },
  {
    "id": "family-guard-remove",
    "file": "entry/src/main/ets/utils/AssFontConfig.ts",
    "old": "value.length > AssFontConfigLimits.maximumFamilyCodeUnits",
    "replacement": "false",
    "name": "font budget lower fallback name 513 unicode true",
    "suite": "ass-font-budget-contract.test.cjs"
  },
  {
    "id": "generic-name-guard-remove",
    "file": "entry/src/main/ets/utils/AssFontConfig.ts",
    "old": "generic.family.length > AssFontConfigLimits.maximumFamilyCodeUnits",
    "replacement": "false",
    "name": "font budget lower secondary-generic name 513 unicode false",
    "suite": "ass-font-budget-contract.test.cjs"
  },
  {
    "id": "alias-name-guard-remove",
    "file": "entry/src/main/ets/utils/AssFontConfig.ts",
    "old": "alias.name.length > AssFontConfigLimits.maximumFamilyCodeUnits",
    "replacement": "false",
    "name": "font budget lower alias name 513 unicode true",
    "suite": "ass-font-budget-contract.test.cjs"
  },
  {
    "id": "XML-drift--1",
    "file": "entry/src/main/ets/utils/AssFontConfig.ts",
    "old": "maximumConfigurationCodeUnits: number = 128 * 1024",
    "replacement": "maximumConfigurationCodeUnits: number = 128 * 1024 - 1",
    "name": "font budget renderer actual XML code units 131072",
    "suite": "ass-font-budget-contract.test.cjs"
  },
  {
    "id": "XML-drift-1",
    "file": "entry/src/main/ets/utils/AssFontConfig.ts",
    "old": "maximumConfigurationCodeUnits: number = 128 * 1024",
    "replacement": "maximumConfigurationCodeUnits: number = 128 * 1024 + 1",
    "name": "font budget actual MPV font configuration code units 131073",
    "suite": "ass-font-budget-contract.test.cjs"
  },
  {
    "id": "XML-compare",
    "file": "entry/src/main/ets/utils/AssFontConfig.ts",
    "old": "result.length > AssFontConfigLimits.maximumConfigurationCodeUnits",
    "replacement": "result.length >= AssFontConfigLimits.maximumConfigurationCodeUnits",
    "name": "font budget service actual XML code units 131072",
    "suite": "ass-font-budget-contract.test.cjs"
  },
  {
    "id": "XML-guard-remove",
    "file": "entry/src/main/ets/utils/AssFontConfig.ts",
    "old": "result.length > AssFontConfigLimits.maximumConfigurationCodeUnits",
    "replacement": "false",
    "name": "font budget renderer actual XML code units 131073",
    "suite": "ass-font-budget-contract.test.cjs"
  }
];
const controls=[
  {
    "name": "font budget service directories 32",
    "phase": "font-config",
    "nativeInit": "font",
    "scope": "ass-font-budget",
    "suite": "ass-font-budget-contract.test.cjs"
  },
  {
    "name": "font budget service directories 32",
    "phase": "font-face",
    "requiredCalls": {
      "font-config": 1
    },
    "scope": "ass-font-budget",
    "suite": "ass-font-budget-contract.test.cjs"
  },
  {
    "name": "font budget renderer actual XML code units 131072",
    "phase": "ass-create",
    "nativeInit": "ass",
    "requiredCalls": {
      "file-rename": 1
    },
    "scope": "ass-font-budget",
    "suite": "ass-font-budget-contract.test.cjs"
  },
  {
    "name": "font budget actual MPV font configuration code units 131072",
    "phase": "mpv-create",
    "nativeInit": "mpv-font",
    "requiredCalls": {
      "file-rename": 1
    },
    "scope": "ass-font-budget",
    "suite": "ass-font-budget-contract.test.cjs"
  },
  {
    "name": "font budget service actual XML code units 131072",
    "phase": "file-write",
    "requiredCalls": {
      "font-config": 1,
      "font-face": 1
    },
    "details": {
      "filename": "fonts.conf.tmp"
    },
    "scope": "ass-font-budget",
    "suite": "ass-font-budget-contract.test.cjs"
  },
  {
    "name": "font budget service actual XML code units 131072",
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
    "suite": "ass-font-budget-contract.test.cjs"
  },
  {
    "name": "font budget lower directories 32",
    "phase": "setup",
    "scope": "ass-font-budget",
    "suite": "ass-font-budget-contract.test.cjs"
  }
];
module.exports={recipes,controls,scope:'ass-font-budget',fixture:'tests/ass-font-budget-fixture.cjs',earlyPhase:'file-rename',earlyOld:'try{await test.action(check);',earlyReplacement:"try{f.trace().call('file-rename',()=>{});await test.action(check);",selfFaults:[{id:'native-font-init-capture',phase:'font-config',file:'tests/ass-font-budget-fixture.cjs',old:"f.trace().call('font-config',()=>{",replacement:"((phase,operation)=>operation())('font-config',()=>{",status:'detected'}]};

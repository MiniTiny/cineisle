// Transpile the product's pure layout policy; no duplicate test implementation.
const fs = require('node:fs'), vm = require('node:vm');
const ts = require('/Applications/DevEco-Studio.app/Contents/tools/hvigor/hvigor/node_modules/typescript');
const moduleValue = { exports: {} };
vm.runInNewContext(ts.transpileModule(fs.readFileSync('entry/src/main/ets/utils/UiLayout.ts', 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 }
}).outputText, { exports: moduleValue.exports, module: moduleValue });
module.exports = moduleValue.exports;

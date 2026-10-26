// IDE, SDK and host Node are separate roots; callers select the owned tool they need.
const path=require('node:path'),defaults=require('../config/deveco.json');
function resolveDeveco(env=process.env,{emptyIsDefault=true}={}) {
  const option=(key,fallback)=>emptyIsDefault?(env[key]||fallback):(env[key]===undefined?fallback:env[key]);
  const contents=option('DEVECO_CONTENTS',defaults.defaultContents),sdkHome=option('DEVECO_SDK_HOME',contents+'/sdk'),bundledNodeHome=contents+'/tools/node',nodeHome=option('NODE_HOME',bundledNodeHome),nativeHome=option('OHOS_NDK_HOME',sdkHome+'/default/openharmony/native');
  return {contents,sdkHome,nodeHome,bundledNodeHome,nativeHome,typescript:path.join(contents,'tools/hvigor/hvigor/node_modules/typescript'),etsLoader:path.join(sdkHome,'default/openharmony/ets/build-tools/ets-loader')};
}
module.exports={resolveDeveco,...resolveDeveco()};

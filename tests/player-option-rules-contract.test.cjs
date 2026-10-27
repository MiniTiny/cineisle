const f=require('./catalog-contract-fixture.cjs').make('player-options'),{assert,h}=f,{PlayerOptionRules:R}=h.load('utils/PlayerOptions.ts');
const tests=[],test=(name,action)=>tests.push({name,action});
for(const [value,valid]of [[999,false],[1000,true],[1001,true],[299999,true],[300000,true],[300001,false],[NaN,false],[Infinity,false],[1.5,false]])test('player rules independent seek range '+value,async check=>check(()=>assert.equal(R.validSeekRange(value),valid)));
for(const [value,valid]of [[1000,true],[1001,false],[2000,true]])test('player rules independent seek step '+value,async check=>check(()=>assert.equal(R.validSeekStep(value),valid)));
if(require.main===module)f.run(tests).catch(error=>{console.error(error);process.exitCode=1;});module.exports=tests;

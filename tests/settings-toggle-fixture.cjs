const f=require('./catalog-contract-fixture.cjs').make('settings-toggle');
module.exports={...f,ui:()=>f.trace().call('ui-compile',()=>require('./brand-forms.test.cjs')),run:tests=>f.run(tests.map(t=>({...t,async action(check){await t.action(check);}})))};

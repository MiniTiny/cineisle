const f=require('./catalog-contract-fixture.cjs').make('menu-navigation');
module.exports={...f,menu:()=>f.trace().call('ui-compile',()=>require('./button-layout.test.cjs')),tree:menu=>f.trace().call('ui-render',()=>menu.render(menu.method)),run:tests=>f.run(tests.map(test=>({...test,async action(check){await test.action(check);}})))};

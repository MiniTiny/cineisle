const layout = 'entry/src/main/ets/utils/UiLayout.ts';
const dialog = 'entry/src/main/ets/components/CompactDialog.ets';
const recipes = [
  ['dialog-button-index-drift',dialog,'this.data.choose(index)','this.data.choose(index === 0 ? 1 : 0)','action account-remove'],
  ['height-drift',layout,'compactDialogHeightVp: number = 440','compactDialogHeightVp: number = 441','entry account-remove'],
  ['height-compare',layout,'height < UiLayout.compactDialogHeightVp','height <= UiLayout.compactDialogHeightVp','entry account-remove'],
  ['wide-drift',layout,'wideDialogWidthVp: number = 600','wideDialogWidthVp: number = 601','bottom 600 439 2'],
  ['wide-compare',layout,'width >= UiLayout.wideDialogWidthVp','width > UiLayout.wideDialogWidthVp','bottom 600 439 2'],
  ['width-drift',layout,'maximumDialogWidthVp: number = 720','maximumDialogWidthVp: number = 721','bottom 753 439 2'],
  ['insets-drift',layout,'dialogHorizontalInsetsVp: number = 32','dialogHorizontalInsetsVp: number = 31','bottom 31 439 2'],
  ['height-ratio-drift',layout,'dialogHeightRatio: number = 0.9','dialogHeightRatio: number = 0.89','entry account-remove'],
  ['width-cap-removed',layout,'Math.min(UiLayout.maximumDialogWidthVp, width - UiLayout.dialogHorizontalInsetsVp)','width - UiLayout.dialogHorizontalInsetsVp','bottom 753 439 2'],
  ['dispatch-compare',dialog,'height >= UiLayout.compactDialogHeightVp','height > UiLayout.compactDialogHeightVp','entry account-remove'],
  ['dispatch-native-only',dialog,'height >= UiLayout.compactDialogHeightVp','true','entry account-remove','native-alert'],
  ['dispatch-custom-only',dialog,'height >= UiLayout.compactDialogHeightVp','false','entry account-remove'],
  ['dispatch-nan-complement',dialog,'height >= UiLayout.compactDialogHeightVp','!UiLayout.compactDialog(height)','entry malformed height dispatch'],
  ['render-width-drift',dialog,'UiLayout.dialogWidth(this.data.width)','UiLayout.dialogWidth(this.data.width) - 1','bottom 600 439 2'],
  ['render-height-drift',dialog,'UiLayout.dialogHeight(this.data.height)','UiLayout.dialogHeight(this.data.height) - 1','bottom 600 439 2'],
  ['single-action-guard-removed',dialog,'UiLayout.wideDialog(this.data.width) && this.data.actions.length > 1','UiLayout.wideDialog(this.data.width)','bottom 600 439 1'],
  ['wide-message-branch-removed',dialog,'if (UiLayout.wideDialog(this.data.width))','if (false)','bottom 600 439 2'],
  ['repeated-action-guard-removed',dialog,'closing || released ||','released ||','bottom ordered close release action disposal'],
  ['retired-action-guard-removed',dialog,'closing || released ||','closing ||','bottom disappearance retires action and disposes once'],
  ['index-integer-guard-removed',dialog,'!Number.isInteger(index) ||','', 'bottom ordered close release action disposal'],
  ['index-range-guard-removed',dialog,'index < 0 || index >= actions.length','false','bottom ordered close release action disposal'],
  ['dispose-once-guard-removed',dialog,'if (!released) {','if (true) {','bottom disappearance retires action and disposes once'],
  ['action-before-close',dialog,'closing = true;','closing = true; actions[index].action();','bottom ordered close release action disposal'],
  ['release-before-close',dialog,'closing = true;','closing = true; release();','bottom ordered close release action disposal'],
  ['open-error-presentation-drift',dialog,'prompt.showToast({ message: errorText(e) }); });\n}',"prompt.showToast({ message: 'wrong error' }); });\n}",'bottom error dialog-open'],
  ['close-error-presentation-drift',dialog,'release(); actions[index].action(); }).catch((e: Error) => { prompt.showToast({ message: errorText(e) });','release(); actions[index].action(); }).catch((e: Error) => { prompt.showToast({ message: \'wrong error\' });','bottom error dialog-close']
].map(([id,file,old,replacement,name,phase]) => ({id,file,old,replacement,name,phase:phase||'content-create'}));
// Select a unique production call line, then mutate one consumer within that line.
const consumers = [
 ['account-remove','Accounts',"title: text('remove_saved_account')"],
 ['server-remove','Accounts',"title: text('remove_saved_server')"],
 ['accounts-reset','Accounts',"title: text('reset_saved_accounts')"],
 ['detail-download','Detail','title: record ?'],
 ['detail-delete','Detail',"title: $r('app.string.server_delete')"],
 ['detail-batch','Detail',"title: $r('app.string.batch_download')"],
 ['downloads-remove','Downloads',"title: $r('app.string.remove_download')"],
 ['favorites-remove','Favorites',"title: $r('app.string.batch_unfavorite')"],
 ['posters-clear','Settings','showBrandDialog(() => this.getUIContext(), { width:'],
 ['index-reason','Index',"title: $r('app.string.discovery_reason')"],
 ['index-remove','Index',"title: $r('app.string.remove_download')"],
 ['index-logout','Index',"title: $r('app.string.change_account')"]
];
for(const [id,page,line] of consumers)for(const [property,old,replacement] of [
 ['width','UiLayout.dialogWidth(this.viewportWidth)','UiLayout.dialogWidth(this.viewportWidth) - 1'],
 ['height','UiLayout.dialogHeightPercent()',"'89%'"]
])recipes.push({id:id+'-'+property,file:'entry/src/main/ets/pages/'+page+'.ets',line,old,replacement,name:'entry '+id,phase:'content-create'});
// Each real page and the independent export must detect a confirmed action lost
// when the lifecycle release races the pending close continuation.
for (const [id] of consumers.filter(([id]) => id !== 'index-reason')) recipes.push({
 id: id+'-pending-close-action-lost', file: dialog,
 old: 'then(() => { release(); actions[index].action(); })',
 replacement: 'then(() => { if (released) { return; } release(); actions[index].action(); })',
 name: 'pending close disappearance '+id, phase: 'dialog-close'
});
for (const [id,old,replacement] of [
 ['bottom-pending-close-action-lost','then(() => { release(); actions[index].action(); })','then(() => { if (released) { return; } release(); actions[index].action(); })'],
 ['bottom-pending-close-action-duplicated','then(() => { release(); actions[index].action(); })','then(() => { release(); actions[index].action(); if (released) { actions[index].action(); } })'],
 ['bottom-pending-close-dispose-guard-removed','if (!released) {','if (true) {']
]) recipes.push({id,file:dialog,old,replacement,name:'bottom pending close disappearance preserves confirmed action',phase:'dialog-close'});
module.exports={recipes};

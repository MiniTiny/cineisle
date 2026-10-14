// Preserve legacy business callback assertions while exposing the unmodified native options.
function dialogFixture(options) {
  return { ...options, nativeOptions: options,
    primaryButton: options.buttons?.[0] ?? options.primaryButton,
    secondaryButton: options.buttons?.[1] ?? options.secondaryButton };
}
module.exports = { dialogFixture };

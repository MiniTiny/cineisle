// Real Node PBKDF2/randomness behind an explicit Harmony crypto fixture; not a native Asset claim.
const crypto = require('node:crypto');
function install(platform) {
  platform.set('@ohos.security.cryptoFramework', {
    createRandom: () => ({ async generateRandom(size) { return { data: new Uint8Array(crypto.randomBytes(size)) }; } }),
    createKdf: algorithm => { if (algorithm !== 'PBKDF2|SHA256') throw Error('unexpected algorithm'); return {
      async generateSecret(spec) { return { data: new Uint8Array(await new Promise((resolve, reject) => crypto.pbkdf2(spec.password, spec.salt, spec.iterations, spec.keySize, 'sha256', (error, value) => error ? reject(error) : resolve(value)))) }; }
    }; }
  });
  global.AppStorage ||= { values: new Map(), setOrCreate(key, value) { this.values.set(key, value); } };
}
module.exports = { install };

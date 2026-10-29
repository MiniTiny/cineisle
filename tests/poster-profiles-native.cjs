// B01-owned Harmony API stand-ins. Failures originate inside the actual factories,
// before any resource exists; observers only delegate to these functions.
const prefix = 'POSTER_PROFILE_NATIVE_ENTRY ';
function installHttp(h) {
  const calls = {}, state = { httpFailure: false, imageFailure: false };
  const entered = (api, failed) => {
    calls[api] = (calls[api] || 0) + 1;
    console.error(prefix + JSON.stringify({ version: 1, api, call: calls[api], failed }));
  };
  const http = h.platform.get('@ohos.net.http');
  http.createHttp = function createHttp() {
    entered('@ohos.net.http.createHttp', state.httpFailure);
    if (state.httpFailure) throw Object.assign(Error('native HTTP factory initialization failed'), { code: 'EIO' });
    return {
      async request() { throw Error('HTTP request requires the explicit catalog provider'); },
      destroy() { calls['http.destroy'] = (calls['http.destroy'] || 0) + 1; }
    };
  };
  return {
    reset({ httpFailure = false, imageFailure = false } = {}) {
      for (const key of Object.keys(calls)) delete calls[key];
      state.httpFailure = httpFailure; state.imageFailure = imageFailure;
    },
    calls,
    installImage(image, imageState) {
      image.createImageSource = function createImageSource() {
        entered('@ohos.multimedia.image.createImageSource', state.imageFailure);
        ++imageState.created;
        if (state.imageFailure) throw Object.assign(Error('native image factory initialization failed'), { code: 'EIO' });
        return {
          async getImageInfo() { if (imageState.fail) throw Error('decode failed'); return imageState.info; },
          async createPixelMap(options) {
            imageState.decoded.push(options); if (imageState.defer) await imageState.defer;
            return { width: options.desiredSize.width, async release() { ++imageState.bitmapReleases; } };
          },
          async release() { ++imageState.sourceReleases; }
        };
      };
    }
  };
}
module.exports = { installHttp };

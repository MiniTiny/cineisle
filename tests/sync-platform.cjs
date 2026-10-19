// Explicit scheduler/network/file-lock fixtures. No OS persistence or background acceptance claim.
const fs = require('node:fs');
exports.install = platform => {
  if (!platform.has('@ohos.resourceschedule.workScheduler')) {
    const jobs = new Map(), calls = [];
    platform.set('@ohos.resourceschedule.workScheduler', { jobs, calls, NetworkType: { NETWORK_TYPE_ANY: 0 },
      startWork(work) { calls.push(['start', work]); jobs.set(work.workId, work); },
      async getWorkStatus(id) { if (!jobs.has(id)) throw Error('missing'); return jobs.get(id); },
      stopWork(work, cancel) { calls.push(['stop', work.workId, cancel]); jobs.delete(work.workId); } });
  }
  platform.set('@ohos.WorkSchedulerExtensionAbility', class {});
};
exports.files = api => {
  const open = api.openSync, close = api.closeSync, held = new Map(), waiting = new Map();
  api.OpenMode.READ_WRITE = fs.constants.O_RDWR;
  api.openSync = (name, flags) => {
    const file = name.endsWith('.lock') ? { fd: fs.openSync(name, fs.constants.O_CREAT | fs.constants.O_RDWR) } : open(name, flags);
    file.tryLock = () => { if (held.has(name)) throw Error('file_locked'); held.set(name, file); };
    file.lock = () => held.has(name) ? new Promise(resolve => { const q = waiting.get(name) || []; q.push(() => { held.set(name, file); resolve(); }); waiting.set(name, q); }) : Promise.resolve(file.tryLock());
    file.unlock = () => { if (held.get(name) === file) { held.delete(name); const next = waiting.get(name)?.shift(); if (next) next(); } };
    return file;
  };
  api.closeSync = file => { file.unlock?.(); close(file); };
};

const space = 'entry/src/main/ets/service/DownloadSpace.ets', app = 'entry/src/main/ets/service/AppService.ets';
const recipes = [], add = (id, file, old, replacement, name) => recipes.push({ id: 'space-' + id, file, old, replacement, name, suite: 'download-space-boundaries.test.cjs' });
add('optional-guard', space, 'bytes < 0 || free < needed', 'bytes < 0 || false', 'space optional margin -1');
add('optional-comparison', space, 'free < needed)', 'free <= needed)', 'space optional margin 0');
add('normal-guard', space, '!Number.isSafeInteger(reserved + needed) || free < reserved + needed', '!Number.isSafeInteger(reserved + needed) || false', 'space check margin -1');
add('normal-comparison', space, 'free < reserved + needed)', 'free <= reserved + needed)', 'space check margin 0');
add('optional-safe-total', space, '!Number.isSafeInteger(needed) ||', '', 'space invalid optional bytes NaN');
add('normal-safe-total', space, '!Number.isSafeInteger(reserved + needed) ||', '', 'space invalid new total retains insufficient identity');
for (const delta of [-1, 1]) for (const entry of ['check', 'optional']) add(`margin-${entry}-${delta}`, space, 'safetyMarginBytes: number = 8 * DownloadSpace.bytesPerMiB', `safetyMarginBytes: number = 8 * DownloadSpace.bytesPerMiB ${delta < 0 ? '-' : '+'} 1`, `space ${entry} margin ${delta < 0 ? -1 : 0}`);
add('video-reservation', space, "active.state === 'downloading' ?", 'false ?', 'space optional video -1');
add('pending-reservation', space, "active.subtitleState === 'pending' ?", 'false ?', 'space optional pending -1');
add('claims-reservation', space, 'Math.max(0, ...(DownloadSpace.subtitleReservations.get(active) ?? []))', '0', 'space optional claim -1');
add('claims-double-count', space, 'Math.max(subtitles, reserved)', '(subtitles + reserved)', 'space optional combined 0');
for (const entry of ['check', 'optional']) {
  add('cross-record-sum-' + entry, space, 'return sum + video + Math.max(subtitles, reserved);', 'return video + Math.max(subtitles, reserved);', `space multiple videos ${entry} -1`);
  add('maximum-claim-' + entry, space, 'Math.max(0, ...(DownloadSpace.subtitleReservations.get(active) ?? []))', '((DownloadSpace.subtitleReservations.get(active) ?? [0])[0] ?? 0)', `space multiple claims ${entry} -1`);
  for (const delta of [-1, 1]) add(`claim-budget-${entry}-${delta}`, space, 'claims.push(count * SubtitleTransferLimits.maxBytes)', `claims.push(count * SubtitleTransferLimits.maxBytes ${delta < 0 ? '-' : '+'} 1)`, `space multiple claims ${entry} ${delta < 0 ? -1 : 0}`);
}
add('release-idempotence', space, 'if (released) { return; } released = true;', 'released = true;', 'space composite optional release-max -1');
add('release-claim', space, 'claims.splice(claims.indexOf(count * SubtitleTransferLimits.maxBytes), 1);', '', 'space composite check release-max 0');
add('ready-subtitle', space, "sub.state !== 'ready' || !fs.accessSync(sub.path)", "sub.state !== 'ready'", 'space new subtitleOnly=true -1');
add('video-budget', space, '(subtitleOnly ? 0 : record.expectedSize ?? 0)', '0', 'space video production legacy -1');
add('required-rounding', space, 'Math.ceil((reserved + needed)', 'Math.floor((reserved + needed)', 'space display keeps ceil floor and captured language through the real Downloads retry');
add('available-rounding', space, 'Math.floor(free /', 'Math.ceil(free /', 'space display keeps ceil floor and captured language through the real Downloads retry');
for (const delta of [-1, 1]) add('bif-budget-' + delta, app, 'checkOptional(local.directory, BIF_LIMIT,', `checkOptional(local.directory, BIF_LIMIT ${delta < 0 ? '-' : '+'} 1,`, `space BIF actual cache ${delta < 0 ? -1 : 0}`);
const controls = [
  ['space check margin 0', 'statvfs'],
  ['space video production legacy 0', 'legacy-create'],
  ['space video production agent 0', 'agent-create'],
  ['space video production agent 0', 'agent-start'],
  ['space video production agent 0', 'file-open'],
  ['space video production legacy 0', 'file-rename'],
  ['space BIF actual cache 0', 'statvfs']
].map(([name, phase]) => ({ name, phase, suite: 'download-space-boundaries.test.cjs' }));
module.exports = { recipes, controls };

const file = 'entry/src/main/ets/service/PersistentDownload.ets';
const recipes = [], add = (id, old, replacement, name) => recipes.push({ id: 'persistent-' + id, file, old, replacement, name, suite: 'persistent-download-boundaries.test.cjs' });
add('throttle-removed', 'finished || Date.now() - lastSave >= PersistentDownload.progressSaveIntervalMs', 'true', 'persistent first event 0');
add('throttle-comparison', 'lastSave >= PersistentDownload.progressSaveIntervalMs', 'lastSave > PersistentDownload.progressSaveIntervalMs', 'persistent interval 1000');
for (const [value, name] of [[999, 'persistent interval 999'], [1001, 'persistent interval 1000']]) add('interval-' + value, 'progressSaveIntervalMs: number = 1000', 'progressSaveIntervalMs: number = ' + value, name);
add('terminal-immediacy', 'finished || Date.now() - lastSave', 'Date.now() - lastSave', 'persistent terminal 64 at 0');
add('finished-guard', 'if (!owned() || finished)', 'if (!owned())', 'persistent terminal 64 at 0');
add('owner-guard', 'if (!owned() || finished)', 'if (finished)', 'persistent lost owner event cannot mutate or save');
add('restore-save', "PersistentDownload.apply(record, info.progress); save();\n    if (record.state", "PersistentDownload.apply(record, info.progress);\n    if (record.state", 'persistent restore saves without event throttle');
add('poll-save', 'if (owned()) { PersistentDownload.apply(record, info.progress); save(); }', 'if (owned()) { PersistentDownload.apply(record, info.progress); }', 'persistent poll saves without event throttle');
for (const [value, count] of [[255, 256], [257, 257]]) add('title-' + value, 'maxTitleCodeUnits: number = 256', 'maxTitleCodeUnits: number = ' + value, 'persistent title x ' + count);
add('title-consumer', 'slice(0, PersistentDownload.maxTitleCodeUnits)', 'slice(0, 255)', 'persistent title x 256');
const options = 'persistent SDK options {"mobile":true,"roaming":true}';
for (const [id, old, replacement] of [
  ['action', 'action: request.agent.Action.DOWNLOAD', 'action: 0'],
  ['mode', 'mode: request.agent.Mode.BACKGROUND', 'mode: 0'],
  ['path', 'saveas: record.path', "saveas: record.path + '.other'"],
  ['overwrite', 'overwrite: true', 'overwrite: false'],
  ['network', 'network: policy.mobile ? request.agent.Network.ANY : request.agent.Network.WIFI', 'network: request.agent.Network.WIFI'],
  ['metered', 'metered: policy.mobile', 'metered: false'],
  ['roaming', 'roaming: policy.mobile && policy.roaming', 'roaming: false'],
  ['retry', 'retry: true', 'retry: false'],
  ['redirect', 'redirect: false', 'redirect: true']
]) add('SDK-' + id, old, replacement, options);
const controls = [
  ['persistent interval 1000', 'agent-create'], ['persistent interval 1000', 'agent-start'],
  ['persistent restore saves without event throttle', 'agent-show'], ['persistent restore saves without event throttle', 'agent-getTask'],
  ['persistent title x 256', 'file-open'], ['persistent title x 256', 'file-rename']
].map(([name, phase]) => ({ name, phase, suite: 'persistent-download-boundaries.test.cjs' }));
module.exports = { recipes, controls };

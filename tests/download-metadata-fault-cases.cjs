const identity = 'entry/src/main/ets/utils/DownloadIdentity.ts', app = 'entry/src/main/ets/service/AppService.ets', cache = 'entry/src/main/ets/utils/Cache.ts';
const recipes = [], add = (id, file, old, replacement, name) => recipes.push({ id: 'metadata-' + id, file, old, replacement, name, suite: 'download-metadata-boundaries.test.cjs' });
for (const [cap, count] of [[255, 256], [257, 257]]) {
  add('writer-limit-' + cap, identity, 'maxSourceNameCodeUnits: number = 256', 'maxSourceNameCodeUnits: number = ' + cap, 'metadata write legacy x ' + count);
  add('reader-limit-' + cap, identity, 'maxSourceNameCodeUnits: number = 256', 'maxSourceNameCodeUnits: number = ' + cap, 'metadata independent reader ' + count);
}
add('writer-consumer', app, '.slice(0, DownloadMetadataLimits.maxSourceNameCodeUnits)', '.slice(0, 255)', 'metadata write legacy x 256');
add('writer-guard', app, ".slice(0, DownloadMetadataLimits.maxSourceNameCodeUnits)", '', 'metadata write legacy x 257');
add('reader-guard', cache, 'record.sourceName.length > DownloadMetadataLimits.maxSourceNameCodeUnits', 'false', 'metadata independent reader 257');
add('reader-comparison', cache, 'record.sourceName.length > DownloadMetadataLimits.maxSourceNameCodeUnits', 'record.sourceName.length >= DownloadMetadataLimits.maxSourceNameCodeUnits', 'metadata independent reader 256');
add('fallback', app, "(source.Name || source.Container || '')", "(source.Container || source.Name || '')", 'metadata fallback preferred mkv');
add('title-coupling', app, "(source.Name || source.Container || '').slice(0, DownloadMetadataLimits.maxSourceNameCodeUnits)", 'item.Name.slice(0, DownloadMetadataLimits.maxSourceNameCodeUnits)', 'metadata source name and platform title use independent inputs');
const controls = [
  ['metadata write legacy x 256', 'legacy-create'], ['metadata write agent x 256', 'agent-create'],
  ['metadata write agent x 256', 'agent-start'], ['metadata write legacy x 256', 'file-open'],
  ['metadata write legacy x 256', 'file-rename'], ['metadata write legacy x 256', 'file-read']
].map(([name, phase]) => ({ name, phase, suite: 'download-metadata-boundaries.test.cjs' }));
module.exports = { recipes, controls };

const f = require('./detail-presentation-fixture.cjs'), { assert } = f, tests = [], test = (name, action) => tests.push({ name, action });
const checked = (check, result, action) => check(() => { assert.ifError(result.unexpected); action(result.value); });
const vectors = [
  ['4k width below', 3839, 1, '3839×1'], ['4k width at', 3840, 1, '4K'], ['4k width above', 3841, 1, '4K'],
  ['4k height below', 1, 2159, '1×2159'], ['4k height at', 1, 2160, '4K'], ['4k height above', 1, 2161, '4K'],
  ['8k width below', 7679, 1, '4K'], ['8k width at', 7680, 1, '8K'], ['8k width above', 7681, 1, '8K'],
  ['8k height below', 1, 4319, '4K'], ['8k height at', 1, 4320, '8K'], ['8k height above', 1, 4321, '8K'],
  ['both below 8k', 7679, 4319, '4K'], ['both at 8k', 7680, 4320, '8K'], ['8k width priority', 7680, 2160, '8K'], ['8k height priority', 3840, 4320, '8K']
];
for (const mode of ['helper', 'page']) for (const [label, width, height, chip] of vectors) test(mode + ' metadata ' + label, async check => checked(check, f.invoke(mode, f.item(width, height)), r => assert.deepEqual(r.chips, [chip])));
for (const [label, width, height, chip] of vectors.filter(v => v[0].endsWith(' at'))) test('panel metadata ' + label, async check => checked(check, f.invoke('panel', f.item(width, height)), r => assert.deepEqual(r.chips, [chip])));
for (const mode of ['helper', 'page']) for (const [width, height] of [[0, 4320], [7680, 0], [-1, 4320], [7680, -1], [undefined, 4320], [7680, undefined], [NaN, 4320], [7680, NaN]]) test(mode + ' metadata positive axes ' + width + ',' + height, async check => {
  const item = f.item(); item.MediaSources[0].MediaStreams[0] = { Type: 'Video', Width: width, Height: height };
  checked(check, f.invoke(mode, item), r => assert.deepEqual(r.chips, []));
});
const times = [[599999999, 'runtime_minutes:0'], [600000000, 'runtime_minutes:1'], [600000001, 'runtime_minutes:1'], [1199999999, 'runtime_minutes:1'], [1200000000, 'runtime_minutes:2'], [1200000001, 'runtime_minutes:2'], [.5, 'runtime_minutes:0']];
for (const mode of ['helper', 'page']) for (const [ticks, summary] of times) test(mode + ' metadata runtime ticks ' + ticks, async check => checked(check, f.invoke(mode, f.item(1, 1, undefined, ticks)), r => assert.equal(r.summary, summary)));
for (const mode of ['helper', 'page']) for (const ticks of [0, -1, NaN, Infinity, undefined, '600000000']) test(mode + ' metadata invalid runtime ' + ticks, async check => checked(check, f.invoke(mode, f.item(1, 1, undefined, ticks)), r => assert.equal(r.summary, '')));
const sizes = [[1048575, '1048575 B'], [1048576, '1.0 MiB'], [1048577, '1.0 MiB'], [1073741823, '1024.0 MiB'], [1073741824, '1.00 GiB'], [1073741825, '1.00 GiB'], [1101004, '1.0 MiB'], [1101005, '1.1 MiB'], [1079110533, '1.00 GiB'], [1079110534, '1.01 GiB']];
for (const mode of ['helper', 'panel', 'page']) for (const [size, expected] of sizes) test(mode + ' metadata size bytes ' + size, async check => checked(check, f.invoke(mode, f.item(1, 1, size)), r => assert.equal(r.rows.find(row => row.key === 'size')?.value, expected)));
for (const mode of ['helper', 'page']) for (const size of [0, -1, .5, NaN, Infinity, undefined, '1048576', 9007199254740992]) test(mode + ' metadata invalid size ' + size, async check => checked(check, f.invoke(mode, f.item(1, 1, size)), r => assert.equal(r.rows.some(row => row.key === 'size'), false)));
for (const mode of ['helper', 'panel', 'page']) test(mode + ' metadata source selection and unknown source preserve fallback', async check => {
  const item = f.item(3840, 1, 1048576); item.MediaSources.push({ Id: 'other', Size: 1073741824, MediaStreams: [{ Type: 'Video', Width: 1, Height: 4320 }] }); item.MediaStreams = [{ Type: 'Video', Width: 1920, Height: 1080 }];
  const first = f.invoke(mode, item, ''), selected = f.invoke(mode, item, 'other'), missing = f.invoke(mode, item, 'missing');
  check(() => { for (const r of [first, selected, missing]) assert.ifError(r.unexpected); assert.deepEqual(first.value.chips, ['4K']); assert.equal(first.value.rows.find(r => r.key === 'size')?.value, '1.0 MiB'); assert.deepEqual(selected.value.chips, ['8K']); assert.equal(selected.value.rows.find(r => r.key === 'size')?.value, '1.00 GiB'); assert.deepEqual(missing.value.chips, []); assert.equal(missing.value.rows.some(r => r.key === 'size'), false); });
});
for (const mode of ['helper', 'panel', 'page']) test(mode + ' metadata item stream fallback only when source is unspecified', async check => {
  const item = { Id: 'movie', Name: 'Fixture movie', Type: 'Movie', MediaStreams: [{ Type: 'Video', Width: 3840, Height: 1 }] }, first = f.invoke(mode, item, ''), selected = f.invoke(mode, item, 'missing');
  check(() => { assert.ifError(first.unexpected); assert.ifError(selected.unexpected); assert.deepEqual(first.value.chips, ['4K']); assert.deepEqual(selected.value.chips, []); });
});
for (const mode of ['helper', 'page']) for (const [label, width, height, chip] of [['infinite width', Infinity, 1, '8K'], ['infinite height', 1, Infinity, '8K'], ['numeric string width', '3840', 1, '4K']]) test(mode + ' metadata legacy ' + label, async check => checked(check, f.invoke(mode, f.item(width, height)), r => assert.deepEqual(r.chips, [chip])));
for (const mode of ['helper', 'page']) test(mode + ' metadata chip and row ordering remains unchanged', async check => {
  const item = f.item(3840, 2160, 1048576, 600000000); Object.assign(item.MediaSources[0].MediaStreams[0], { Codec: 'h264', VideoRangeType: 'HDR10Plus', BitDepth: 10 }); item.MediaSources[0].MediaStreams.push({ Type: 'Audio', Codec: 'aac', Channels: 2, DisplayTitle: 'Dolby Atmos', AudioSpatialFormat: 'DolbyAtmos' }, { Type: 'Subtitle', Codec: 'srt' }); item.Genres = ['Genre A', 'Genre B']; item.People = [{ Id: 'd', Name: 'Director', Type: 'Director' }, { Id: 'w', Name: 'Writer', Type: 'Writer' }];
  checked(check, f.invoke(mode, item), r => { assert.deepEqual(r.chips, ['4K', 'H264', 'HDR10+', 'AAC', 'channel_count:2', 'Atmos', 'subtitle_chip']); assert.deepEqual(r.rows.map(v => v.key), mode === 'helper' ? ['size', 'video', 'audio', 'subtitles', 'genres', 'directors', 'writers'] : ['genres', 'directors', 'writers', 'size', 'video', 'audio', 'subtitles']); assert.equal(r.summary, 'runtime_minutes:1'); });
});
f.run(tests).catch(error => { console.error(error); process.exitCode = 1; });

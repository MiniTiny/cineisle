// Real generated client -> native HTTP adapter -> business facade, with explicit HTTP fixtures.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const vm = require('node:vm');
const { spawnSync } = require('node:child_process');
const crypto = require('node:crypto');
const root = path.resolve(__dirname, '..');
const sourceRoot = path.join(root, 'entry/src/main/ets');
const ts = require(path.join(process.env.DEVECO_CONTENTS || '/Applications/DevEco-Studio.app/Contents', 'tools/hvigor/hvigor/node_modules/typescript'));
const cache = new Map(), queue = [], requests = [];
let destroyed = 0;
const platform = new Map([
  ['@ohos.util', { generateRandomUUID: () => 'probe-device' }],
  ['@ohos.resourceManager', {}],
  ['@ohos.net.http', { RequestMethod: { GET: 'GET', POST: 'POST', DELETE: 'DELETE' }, HttpDataType: { STRING: 'STRING' }, createHttp() {
    return { async request(url, options) {
      requests.push({ url, options });
      assert.ok(queue.length, 'An explicit HTTP fixture is required');
      const result = queue.shift(); if (result instanceof Error) throw result; return result;
    }, destroy() { destroyed++; } };
  } }]
]);
function load(file) {
  file = path.resolve(sourceRoot, file);
  if (cache.has(file)) return cache.get(file).exports;
  const js = ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, esModuleInterop: true, target: ts.ScriptTarget.ES2020 } }).outputText;
  const output = { exports: {} }; cache.set(file, output);
  const requireLocal = id => {
    if (platform.has(id)) return platform.get(id);
    assert.ok(id.startsWith('.'), 'No external JavaScript runtime dependency: ' + id);
    const base = path.resolve(path.dirname(file), id);
    return load(fs.existsSync(base + '.ts') ? base + '.ts' : base + '.ets');
  };
  vm.runInThisContext(`(function(require, module, exports) {${js}\n})`, { filename: file })(requireLocal, output, output.exports);
  return output.exports;
}
const { JellyfinClient } = load('service/JellyfinClient.ets');
const { JellyfinApi } = load('api/generated/JellyfinApi.ets');
const { NativeHttpTransport } = load('api/NativeHttpTransport.ets');
const models = load('api/generated/Models.ets');
const spec = JSON.parse(fs.readFileSync(path.join(root, 'openapi/jellyfin-10.10.0.json')));
const config = JSON.parse(fs.readFileSync(path.join(root, 'openapi/client-config.json')));
const manifest = JSON.parse(fs.readFileSync(path.join(sourceRoot, 'api/generated/manifest.json')));
const session = () => ({ server: 'https://example.invalid/jellyfin', userId: 'account-a', serverId: 'server-a', token: 'fixture-token', deviceId: 'fixture-device' });
const response = (value, status = 200) => ({ responseCode: status, result: typeof value === 'string' ? value : JSON.stringify(value) });
const film = { Id: 'movie', Name: '电影', Type: 'Movie' };
const page = items => ({ Items: items, TotalRecordCount: items.length });
const tests = [], covered = new Set();
const test = (name, fn) => tests.push([name, fn]);
const last = () => requests.at(-1);
const url = () => new URL(last().url);
const param = key => url().searchParams.get(key);
function route(operation, expected, method = 'GET') {
  covered.add(operation);
  assert.equal(url().pathname, '/jellyfin' + expected);
  assert.equal(last().options.method, method);
  assert.ok(!last().url.includes('fixture-token'));
  assert.ok(last().options.header.Authorization.includes('Token="fixture-token"'));
}
test('login uses generated public/auth operations and updates the same transport session', async () => {
  queue.push(response({ Id: 'server-a', Version: '10.10.0' }), response({ User: { Id: 'account-a', Name: null }, AccessToken: 'fixture-token' }));
  const client = await JellyfinClient.login(' https://example.invalid/jellyfin/// ', ' user ', 'fixture-password');
  covered.add('GetPublicSystemInfo'); covered.add('AuthenticateUserByName');
  assert.equal(new URL(requests[0].url).pathname, '/jellyfin/System/Info/Public');
  assert.equal(new URL(requests[1].url).pathname, '/jellyfin/Users/AuthenticateByName');
  assert.equal(requests[1].options.method, 'POST');
  assert.deepEqual(JSON.parse(requests[1].options.extraData), { Username: 'user', Pw: 'fixture-password' });
  assert.ok(!requests[1].options.header.Authorization.includes('Token='));
  assert.equal(client.session.userName, '');
  queue.push(response(page([film]))); await client.libraries();
  assert.ok(last().options.header.Authorization.includes('Token="fixture-token"'));
});
test('libraries preserve nullable DTO fields and use explicit user context', async () => {
  const client = new JellyfinClient(session(), '10.10.0');
  queue.push(response(page([{ ...film, Overview: null, UserData: { Played: false, PlayCount: 0 }, ImageTags: { Primary: 'tag' }, People: null }])));
  const result = await client.libraries(); route('GetUserViews', '/UserViews');
  assert.equal(param('userId'), 'account-a'); assert.equal(result[0].Overview, undefined);
  assert.equal(result[0].UserData.PlayCount, 0); assert.equal(result[0].UserData.Played, false); assert.equal(result[0].ImageTags.Primary, 'tag');
});

for (const version of ['10.8.13', '10.10.0']) test(version + ' next-up is generated, authenticated and scoped to the current user', async () => {
  queue.push(response(page([{ Id: 'episode', Name: 'Next', Type: 'Episode', SeriesId: 'show' }])));
  const items = await new JellyfinClient(session(), version).nextUp();
  route('GetNextUp', '/Shows/NextUp'); assert.equal(param('userId'), 'account-a'); assert.equal(param('limit'), '9');
  assert.equal(param('enableUserData'), 'true'); assert.equal(items[0].Type, 'Episode');
});
for (const version of ['10.8.13', '10.10.0']) test(version + ' per-library latest keeps grouping and includes episodes', async () => {
  queue.push(response([{ Id: 'episode', Name: 'New', Type: 'Episode', SeriesId: 'show' }]));
  await new JellyfinClient(session(), version).latest('tv-library');
  assert.equal(param('parentId'), 'tv-library'); assert.equal(param('limit'), '12'); assert.equal(param('includeItemTypes'), null);
  assert.equal(param('enableUserData'), 'true'); assert.equal(param('groupItems'), null);
  assert.equal(url().pathname, version === '10.8.13' ? '/jellyfin/Users/account-a/Items/Latest' : '/jellyfin/Items/Latest');
});
test('library CollectionType survives DTO mapping for supported feed selection', async () => {
  queue.push(response(page([{ ...film, Type: 'CollectionFolder', CollectionType: 'movies' }])));
  assert.equal((await new JellyfinClient(session(), '10.10.0').libraries())[0].CollectionType, 'movies');
});
test('malformed login identities or credentials are rejected without persisting a session', async () => {
  for (const result of [{ User: { Id: 'account-a' }, AccessToken: 123 }, { User: { Id: 123 }, AccessToken: 'fixture-token' },
    { User: { Id: 'account-a', Name: {} }, AccessToken: 'fixture-token' }, { User: { Id: 'account-a' }, AccessToken: 'bad\r\nheader' }]) {
    queue.push(response({ Id: 'server-a', Version: '10.10.0' }), response(result));
    await assert.rejects(JellyfinClient.login('https://example.invalid/jellyfin', 'user', 'fixture-password'), /login_response_invalid/);
  }
});
test('items translate legacy facade filters using generated parameter names/types and explode', async () => {
  queue.push(response(page([film])));
  const result = await new JellyfinClient(session(), '10.10.0').items([
    { key: 'SearchTerm', value: '电影 & /?#' }, { key: 'IncludeItemTypes', value: 'Movie,Series,Episode' },
    { key: 'Filters', value: 'IsFavorite' }, { key: 'PersonIds', value: 'person-a,person-b' },
    { key: 'StartIndex', value: '0' }, { key: 'Limit', value: '60' }, { key: 'Recursive', value: 'false' },
    { key: 'SortBy', value: 'SortName' }, { key: 'SortOrder', value: 'Ascending' }, { key: 'ParentId', value: 'library' },
    { key: 'UserId', value: 'other-account' }
  ]);
  route('GetItems', '/Items'); assert.equal(result.TotalRecordCount, 1);
  assert.equal(param('userId'), 'account-a'); assert.equal(param('searchTerm'), '电影 & /?#');
  assert.equal(param('recursive'), 'false'); assert.equal(param('startIndex'), '0'); assert.equal(param('limit'), '60');
  assert.deepEqual(url().searchParams.getAll('includeItemTypes'), ['Movie', 'Series', 'Episode']);
  assert.deepEqual(url().searchParams.getAll('fields'), ['Overview', 'People', 'Genres', 'MediaSources', 'SortName', 'DateCreated']);
  assert.deepEqual(url().searchParams.getAll('personIds'), ['person-a', 'person-b']);
  assert.equal(param('filters'), 'IsFavorite'); assert.equal(param('parentId'), 'library');
});
test('detail path is generated/escaped and DTO metadata survives domain mapping', async () => {
  queue.push(response({ ...film, SeriesId: 'series', SeriesName: '剧集', SeasonId: 'season', IndexNumber: 2, ParentIndexNumber: 1,
    ProductionYear: 2026, CommunityRating: 8.5, RunTimeTicks: 120000000, BackdropImageTags: ['backdrop'],
    People: [{ Id: 'person', Name: '演员', Type: 'Actor', Role: null }], MediaSources: [{ Id: 'source', Container: 'mp4' }] }));
  const result = await new JellyfinClient(session(), '10.10.0').detail('movie/ &');
  route('GetItem', '/Items/movie%2F%20%26'); assert.equal(param('userId'), 'account-a');
  assert.equal(result.SeriesName, '剧集'); assert.equal(result.RunTimeTicks, 120000000); assert.equal(result.People[0].Role, undefined);
  assert.equal(result.MediaSources[0].Container, 'mp4'); assert.equal(result.ParentIndexNumber, 1);
});
for (const version of ['10.8.13', '10.10.0']) {
  test(version + ' detail next-up uses series scope and a single result', async () => {
    queue.push(response(page([{ Id: 'episode', Name: 'Next', Type: 'Episode', SeriesId: 'series' }])));
    await new JellyfinClient(session(), version).nextUp('series');
    route('GetNextUp', '/Shows/NextUp'); assert.equal(param('seriesId'), 'series'); assert.equal(param('limit'), '1'); assert.equal(param('userId'), 'account-a');
  });
  test(version + ' generated delete operation encodes the item path and accepts 204', async () => {
    queue.push(response('', 204)); await new JellyfinClient(session(), version).removeItem('movie/ &');
    route('DeleteItem', '/Items/movie%2F%20%26', 'DELETE'); assert.equal(param('userId'), null);
  });
}
test('detail fields and technical metadata survive generated DTO to domain mapping', async () => {
  queue.push(response({ ...film, OriginalTitle: 'Original', OfficialRating: 'PG', Genres: ['Drama'], PremiereDate: '2020-01-01T00:00:00Z', EndDate: null,
    Status: 'Continuing', CanDownload: true, CanDelete: false, PlayAccess: 'Full', RemoteTrailers: [{ Name: null, Url: 'https://example.invalid/trailer' }],
    MediaSources: [{ Id: 'source', Size: 1073741824, MediaStreams: [{ Type: 'Video', Index: 0, Width: 3840, Height: 1600, BitDepth: 10, VideoRangeType: 'HDR10' },
      { Type: 'Audio', Index: 1, Channels: 6, ChannelLayout: '5.1', AudioSpatialFormat: 'DolbyAtmos' }] }] }));
  const item = await new JellyfinClient(session(), '10.10.0').detail('movie'); assert.equal(item.OriginalTitle, 'Original'); assert.equal(item.CanDelete, false);
  assert.deepEqual(item.Genres, ['Drama']); assert.equal(item.EndDate, undefined); assert.equal(item.RemoteTrailers[0].Name, undefined);
  assert.equal(item.MediaSources[0].Size, 1073741824); assert.equal(item.MediaSources[0].MediaStreams[0].Height, 1600); assert.equal(item.MediaSources[0].MediaStreams[1].AudioSpatialFormat, 'DolbyAtmos');
});
test('resume is generated with a numeric limit and video media type', async () => {
  queue.push(response(page([film]))); assert.equal((await new JellyfinClient(session(), '10.10.0').resume())[0].Id, 'movie');
  route('GetResumeItems', '/UserItems/Resume'); assert.equal(param('limit'), '20'); assert.equal(param('mediaTypes'), 'Video');
});
test('latest preserves array response and typed movie/series filters', async () => {
  queue.push(response([film])); assert.equal((await new JellyfinClient(session(), '10.10.0').latest())[0].Id, 'movie');
  route('GetLatestMedia', '/Items/Latest'); assert.equal(param('limit'), '30');
  assert.deepEqual(url().searchParams.getAll('includeItemTypes'), ['Movie', 'Series']);
});
test('recommendations preserve watched-only behavior', async () => {
  queue.push(response([{ Items: [{ ...film, UserData: { Played: true } }, { ...film, Id: 'unwatched' }] }]));
  assert.deepEqual((await new JellyfinClient(session(), '10.10.0').recommend()).map(x => x.Id), ['movie']);
  route('GetMovieRecommendations', '/Movies/Recommendations'); assert.equal(param('categoryLimit'), '5'); assert.equal(param('itemLimit'), '8');
});
test('recommendation failure requests generated watched fallback with sorting', async () => {
  queue.push(response('', 404), response(page([{ ...film, UserData: { Played: true } }])));
  assert.equal((await new JellyfinClient(session(), '10.10.0').recommend()).length, 1);
  assert.equal(param('isPlayed'), 'true'); assert.equal(param('sortBy'), 'DatePlayed'); assert.equal(param('sortOrder'), 'Descending');
});
test('malformed recommendation group cannot retain partially accumulated recommendations', async () => {
  queue.push(response([{ Items: [{ ...film, Id: 'partial', UserData: { Played: true } }] }, { Items: {} }]), response(page([{ ...film, UserData: { Played: true } }])));
  assert.deepEqual((await new JellyfinClient(session(), '10.10.0').recommend()).map(x => x.Id), ['movie']);
});
test('series children use generated seasons with escaped path', async () => {
  queue.push(response(page([film]))); await new JellyfinClient(session(), '10.10.0').children({ ...film, Id: 'series/1', Type: 'Series' });
  route('GetSeasons', '/Shows/series%2F1/Seasons'); assert.equal(param('userId'), 'account-a');
});
test('season children and episode pagination share generated episode operation', async () => {
  const client = new JellyfinClient(session(), '10.10.0'); queue.push(response(page([film])));
  await client.children({ ...film, Id: 'season', Type: 'Season', SeriesId: 'series' });
  route('GetEpisodes', '/Shows/series/Episodes'); assert.equal(param('seasonId'), 'season');
  queue.push(response(page([]))); await client.episodePage('series', 200);
  assert.equal(param('startIndex'), '200'); assert.equal(param('limit'), '200'); assert.equal(param('isMissing'), 'false');
  assert.equal(param('fields'), 'MediaSources');
});
for (const [operation, methodName, enabled, expected, method] of [
  ['MarkFavoriteItem', 'favorite', true, '/UserFavoriteItems/movie%2F1', 'POST'],
  ['UnmarkFavoriteItem', 'favorite', false, '/UserFavoriteItems/movie%2F1', 'DELETE'],
  ['MarkPlayedItem', 'played', true, '/UserPlayedItems/movie%2F1', 'POST'],
  ['MarkUnplayedItem', 'played', false, '/UserPlayedItems/movie%2F1', 'DELETE']
]) test(operation + ' uses generated action and accepts returned user data', async () => {
  queue.push(response({ Played: enabled, IsFavorite: enabled }));
  await new JellyfinClient(session(), '10.10.0')[methodName]('movie/1', enabled);
  route(operation, expected, method); assert.equal(param('userId'), 'account-a');
});
test('playback maps the official text-subtitle flag and keeps independent server indexes', async () => {
  queue.push(response({ PlaySessionId: 'play', MediaSources: [{ Id: 'source', Name: null, MediaStreams: [
    { Type: 'Subtitle', Index: 20, Codec: 'custom', Language: 'zho', IsTextSubtitleStream: true, IsExternal: true },
    { Type: 'Audio', Index: 31, Codec: 'aac', Language: 'eng' }
  ] }] }));
  const result = await new JellyfinClient(session(), '10.10.0').playbackInfo('movie');
  route('GetPlaybackInfo', '/Items/movie/PlaybackInfo');
  assert.equal(result.MediaSources[0].MediaStreams[0].IsTextSubtitle, true);
  assert.equal(result.MediaSources[0].MediaStreams[0].Index, 20); assert.equal(result.PlaySessionId, 'play');
  assert.equal(result.MediaSources[0].Name, undefined);
});
test('subtitle text stays text, retains zero and sends header authorization', async () => {
  const srt = '1\n00:00:01,000 --> 00:00:02,000\n字幕\n'; queue.push(response(srt));
  assert.equal(await new JellyfinClient(session(), '10.10.0').subtitle('movie', 'source/ &', 20), srt);
  route('GetSubtitle', '/Videos/movie/source%2F%20%26/Subtitles/20/Stream.srt');
  assert.equal(param('startPositionTicks'), '0'); assert.equal(last().options.header.Accept, 'text/plain');
});
for (const [operation, event, expected] of [
  ['ReportPlaybackStart', '', '/Sessions/Playing'],
  ['ReportPlaybackProgress', 'Progress', '/Sessions/Playing/Progress'],
  ['ReportPlaybackStopped', 'Stopped', '/Sessions/Playing/Stopped']
]) test(operation + ' uses its own generated request DTO and handles 204', async () => {
  queue.push(response('ignored', 204)); await new JellyfinClient(session(), '10.10.0').report(event, 'movie', 'source', 'play', 12.25, true);
  route(operation, expected, 'POST');
  const body = JSON.parse(last().options.extraData);
  assert.equal(body.ItemId, 'movie'); assert.equal(body.MediaSourceId, 'source'); assert.equal(body.PlaySessionId, 'play'); assert.equal(body.PositionTicks, 122500000);
  if (event === 'Stopped') { assert.equal(body.PlayMethod, undefined); assert.equal(body.IsPaused, undefined); }
  else { assert.equal(body.PlayMethod, 'DirectPlay'); assert.equal(body.IsPaused, true); assert.equal(body.CanSeek, true); }
});
test('image URL operations delegate URL credentials and preserve escaping', () => {
  const client = new JellyfinClient(session(), '10.10.0'); covered.add('GetItemImage'); covered.add('GetItemImageByIndex');
  const primary = new URL(client.image('movie/1', 'tag&1'));
  assert.equal(primary.pathname, '/jellyfin/Items/movie%2F1/Images/Primary'); assert.equal(primary.searchParams.get('maxWidth'), '360');
  assert.equal(primary.searchParams.get('tag'), 'tag&1'); assert.equal(primary.searchParams.get('api_key'), 'fixture-token');
  const backdrop = new URL(client.image('movie', '', true));
  assert.equal(backdrop.pathname, '/jellyfin/Items/movie/Images/Backdrop/0'); assert.equal(backdrop.searchParams.get('maxWidth'), '960');
  assert.equal(backdrop.searchParams.has('tag'), false); assert.equal(requests.length, 0);
});
test('video URL comes from generated stream operation without eager binary downloads', () => {
  covered.add('GetVideoStream'); const result = new URL(new JellyfinClient(session(), '10.10.0').stream('movie/1', 'source&1'));
  assert.equal(result.pathname, '/jellyfin/Videos/movie%2F1/stream'); assert.equal(result.searchParams.get('static'), 'true');
  assert.equal(result.searchParams.get('mediaSourceId'), 'source&1'); assert.equal(result.searchParams.get('deviceId'), 'fixture-device');
  assert.equal(result.searchParams.get('api_key'), 'fixture-token'); assert.equal(requests.length, 0);
});
test('native transport retains timeouts and releases each connection on all failures', async () => {
  const client = new JellyfinClient(session(), '10.10.0');
  for (const [fixture, error] of [[response('', 401), /login_expired/], [response('', 403), /permission_denied/], [response('', 500), /http_failed/],
    [response('<html>proxy</html>'), /html_response/], [response('{broken'), /api_response_invalid/], [new Error('timeout'), /timeout/]]) {
    const before = destroyed; queue.push(fixture); await assert.rejects(client.libraries(), error); assert.equal(destroyed, before + 1);
    assert.equal(last().options.connectTimeout, 15000); assert.equal(last().options.readTimeout, 30000);
  }
});
test('native transport rejects unexpected binary data on a JSON operation', async () => {
  queue.push({ responseCode: 200, result: new ArrayBuffer(4) });
  await assert.rejects(new JellyfinClient(session(), '10.10.0').libraries(), /api_response_invalid/); assert.equal(destroyed, 1);
});
test('missing libraries cannot become an empty successful sync input', async () => {
  for (const value of [{}, null, { Items: {} }]) {
    queue.push(response(value)); await assert.rejects(new JellyfinClient(session(), '10.10.0').libraries(), /api_response_invalid/);
  }
});
test('missing or malformed totals and media identities are rejected at the DTO boundary', async () => {
  for (const value of [{ Items: [film] }, { Items: [], TotalRecordCount: -1 }, { Items: [], TotalRecordCount: 1.5 }, page([null]), page([{ Name: 'bad', Type: 'Movie' }])]) {
    queue.push(response(value)); await assert.rejects(new JellyfinClient(session(), '10.10.0').items(), /api_response_invalid/);
  }
});
test('unsafe incoming integers including nested ticks fail instead of silently rounding', async () => {
  queue.push(response('{"Items":[{"Id":"movie","Name":"Movie","Type":"Movie","UserData":{"PlaybackPositionTicks":9007199254740993}}],"TotalRecordCount":1}'));
  await assert.rejects(new JellyfinClient(session(), '10.10.0').items(), /api_numeric_range/);
  queue.push(response('{"Items":[],"TotalRecordCount":1e400}')); await assert.rejects(new JellyfinClient(session(), '10.10.0').items(), /api_numeric_range/);
});
test('malformed optional domain data cannot become a successful cached item', async () => {
  for (const extra of [{ People: false }, { MediaSources: {} }, { UserData: 'invalid' }, { UserData: { Played: 'yes' } }, { Overview: 123 }]) {
    queue.push(response(page([{ ...film, ...extra }])));
    await assert.rejects(new JellyfinClient(session(), '10.10.0').items(), /api_response_invalid/);
  }
});
test('unsafe outgoing ticks and unsupported events never dispatch HTTP', async () => {
  const client = new JellyfinClient(session(), '10.10.0');
  await assert.rejects(client.report('Progress', 'movie', 'source', 'play', Number.MAX_SAFE_INTEGER, false), /api_numeric_range/);
  await assert.rejects(client.report('other', 'movie', 'source', 'play', 1, false), /api_parameter_invalid/); assert.equal(requests.length, 0);
});
test('generated query conversion rejects invalid names, enums, booleans and integers', async () => {
  const client = new JellyfinClient(session(), '10.10.0');
  for (const [key, value] of [['unknown', 'x'], ['IncludeItemTypes', 'Movie,Typo'], ['Recursive', 'yes'], ['Limit', 'NaN'], ['Limit', '1.5'], ['Limit', '2147483648']]) {
    await assert.rejects(client.items([{ key, value }]), /api_parameter_invalid/);
  }
  await assert.rejects(client.episodePage('series', NaN), /api_parameter_invalid/); assert.equal(requests.length, 0);
});
test('invalid subtitle indexes never reach HTTP', async () => {
  for (const index of [-1, 1.2, NaN]) await assert.rejects(new JellyfinClient(session(), '10.10.0').subtitle('movie', 'source', index), /subtitle_failed/);
  assert.equal(requests.length, 0);
});
test('session header injection is rejected before allocating a connection', async () => {
  const data = session(); data.token = 'bad\r\nheader';
  await assert.rejects(new JellyfinClient(data, '10.10.0').libraries(), /api_session_invalid/); assert.equal(requests.length, 0); assert.equal(destroyed, 0);
});
test('concurrent client instances retain their own user/token context', async () => {
  const a = new JellyfinClient(session(), '10.10.0'); const data = session(); data.userId = 'account-b'; data.token = 'other-fixture'; const b = new JellyfinClient(data, '10.10.0');
  queue.push(response(page([film])), response(page([film]))); await Promise.all([a.libraries(), b.libraries()]);
  assert.deepEqual(requests.map(r => new URL(r.url).searchParams.get('userId')), ['account-a', 'account-b']);
  assert.ok(requests[0].options.header.Authorization.includes('fixture-token')); assert.ok(!requests[0].options.header.Authorization.includes('other-fixture'));
  assert.ok(requests[1].options.header.Authorization.includes('other-fixture'));
});
test('generated optional queries keep false/zero and omit null/undefined', async () => {
  queue.push(response(page([]))); const api = new JellyfinApi(new NativeHttpTransport(session()));
  await api.getUserViews({ userId: undefined, includeExternalContent: false, includeHidden: null, presetViews: [models.CollectionType.movies, models.CollectionType.tvshows] });
  assert.equal(param('includeExternalContent'), 'false'); assert.equal(param('includeHidden'), null); assert.equal(param('userId'), null);
  assert.deepEqual(url().searchParams.getAll('presetViews'), ['movies', 'tvshows']);
});
test('Quick Connect and saved-account validation use all new generated operations', async () => {
  const api = new JellyfinApi(new NativeHttpTransport(session()));
  queue.push(response(true)); assert.equal(await api.getQuickConnectEnabled(), true); route('GetQuickConnectEnabled', '/QuickConnect/Enabled');
  queue.push(response({ Code: '123456', Secret: 'fixture-secret', Authenticated: false })); await api.initiateQuickConnect(); route('InitiateQuickConnect', '/QuickConnect/Initiate', 'POST'); assert.equal(Object.hasOwn(last().options, 'extraData'), false);
  queue.push(response({ Authenticated: true })); await api.getQuickConnectState({ secret: 'fixture secret&' }); route('GetQuickConnectState', '/QuickConnect/Connect'); assert.equal(param('secret'), 'fixture secret&');
  queue.push(response({ User: { Id: 'account-a' }, AccessToken: 'fixture-token' })); await api.authenticateWithQuickConnect({ body: { Secret: 'fixture-secret' } }); route('AuthenticateWithQuickConnect', '/Users/AuthenticateWithQuickConnect', 'POST'); assert.deepEqual(JSON.parse(last().options.extraData), { Secret: 'fixture-secret' });
  queue.push(response({ Id: 'account-a' })); await api.getCurrentUser(); route('GetCurrentUser', '/Users/Me');
});
test('10.8 Quick Connect initiation uses pinned GET method and operation aliases', async () => {
  const api = new JellyfinApi(new NativeHttpTransport(session())); api.setServerVersion('10.8.13'); queue.push(response({ Code: '123456' })); await api.initiateQuickConnect(); assert.equal(last().options.method, 'GET'); assert.equal(url().pathname, '/jellyfin/QuickConnect/Initiate');
});
test('selected operation routes/methods and schema hash match the vendored official specification', () => {
  assert.equal(crypto.createHash('sha256').update(fs.readFileSync(path.join(root, 'openapi', config.schema))).digest('hex'), config.schemaSha256);
  assert.equal(spec.info.version, '10.10.0');
  assert.deepEqual([...covered].sort(), [...config.operations].sort());
  for (const operation of manifest.operations) {
    assert.equal(spec.paths[operation.path][operation.method.toLowerCase()].operationId, operation.operationId);
  }
});
test('regeneration check passes and detects output drift, schema drift and unsupported schemas', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'cineisle-openapi-'));
  try {
    fs.mkdirSync(path.join(tmp, 'scripts')); fs.mkdirSync(path.join(tmp, 'openapi'));
    fs.copyFileSync(path.join(root, 'scripts/generate-jellyfin.py'), path.join(tmp, 'scripts/generate-jellyfin.py'));
    fs.copyFileSync(path.join(root, 'openapi/client-config.json'), path.join(tmp, 'openapi/client-config.json'));
    fs.copyFileSync(path.join(root, 'openapi', config.schema), path.join(tmp, 'openapi', config.schema));
    for (const profile of config.compatibilitySchemas) fs.copyFileSync(path.join(root, 'openapi', profile.schema), path.join(tmp, 'openapi', profile.schema));
    fs.cpSync(path.join(sourceRoot, 'api/generated'), path.join(tmp, config.output), { recursive: true });
    const run = (...args) => spawnSync('python3', [path.join(tmp, 'scripts/generate-jellyfin.py'), ...args], { encoding: 'utf8' });
    assert.equal(run('--check').status, 0);
    fs.appendFileSync(path.join(tmp, config.output, 'Models.ets'), '// drift\n'); assert.notEqual(run('--check').status, 0);
    assert.equal(run().status, 0); assert.equal(run('--check').status, 0);
    const legacyFile = path.join(tmp, 'openapi', config.compatibilitySchemas[0].schema);
    const originalLegacy = fs.readFileSync(legacyFile);
    fs.appendFileSync(legacyFile, '\n');
    const drift = run('--check'); assert.notEqual(drift.status, 0); assert.match(drift.stderr, /Compatibility schema fingerprint mismatch/);
    fs.writeFileSync(legacyFile, originalLegacy);
    const old = JSON.parse(originalLegacy); old.paths['/Users/{userId}/Items/Latest'].post = old.paths['/Users/{userId}/Items/Latest'].get;
    delete old.paths['/Users/{userId}/Items/Latest'].get; fs.writeFileSync(legacyFile, JSON.stringify(old));
    const badConfig = JSON.parse(JSON.stringify(config)); badConfig.compatibilitySchemas[0].schemaSha256 = crypto.createHash('sha256').update(fs.readFileSync(legacyFile)).digest('hex');
    fs.writeFileSync(path.join(tmp, 'openapi/client-config.json'), JSON.stringify(badConfig));
    const badMethod = run(); assert.notEqual(badMethod.status, 0); assert.match(badMethod.stderr, /Compatible method changed/);
    fs.writeFileSync(legacyFile, originalLegacy); fs.writeFileSync(path.join(tmp, 'openapi/client-config.json'), JSON.stringify(config));
    const schemaFile = path.join(tmp, 'openapi', config.schema); const changed = JSON.parse(fs.readFileSync(schemaFile));
    changed.components.schemas.PublicSystemInfo.properties.Unsupported = { oneOf: [{ type: 'string' }, { type: 'number' }] };
    fs.writeFileSync(schemaFile, JSON.stringify(changed)); assert.notEqual(run().status, 0);
    const changedConfig = { ...config, schemaSha256: crypto.createHash('sha256').update(fs.readFileSync(schemaFile)).digest('hex') };
    fs.writeFileSync(path.join(tmp, 'openapi/client-config.json'), JSON.stringify(changedConfig));
    const failed = run(); assert.notEqual(failed.status, 0); assert.match(failed.stderr, /Unsupported composition/);
  } finally { fs.rmSync(tmp, { recursive: true, force: true }); }
});
for (const [methodName, args, expected, fixture, method] of [
  ['libraries', [], '/Views', page([film]), 'GET'],
  ['detail', ['movie/1'], '/Items/movie%2F1', film, 'GET'],
  ['resume', [], '/Items/Resume', page([film]), 'GET'],
  ['latest', [], '/Items/Latest', [film], 'GET'],
  ['favorite', ['movie/1', true], '/FavoriteItems/movie%2F1', {}, 'POST'],
  ['favorite', ['movie/1', false], '/FavoriteItems/movie%2F1', {}, 'DELETE'],
  ['played', ['movie/1', true], '/PlayedItems/movie%2F1', {}, 'POST'],
  ['played', ['movie/1', false], '/PlayedItems/movie%2F1', {}, 'DELETE']
]) test(`10.8.13 ${methodName} ${method} uses the historical generated route`, async () => {
  const data = session(); data.userId = 'account/ &';
  queue.push(response(fixture)); await new JellyfinClient(data, '10.8.13')[methodName](...args);
  assert.equal(url().pathname, '/jellyfin/Users/account%2F%20%26' + expected);
  assert.equal(param('userId'), null); assert.equal(last().options.method, method);
  assert.ok(last().options.header.Authorization.includes('fixture-token')); assert.equal(requests.length, 1);
  if (methodName === 'latest') assert.deepEqual(url().searchParams.getAll('includeItemTypes'), ['Movie', 'Series']);
});
test('10.8 login selects compatibility before the first home request without another probe', async () => {
  queue.push(response({ Id: 'server-a', Version: '10.8.13' }), response({ User: { Id: 'account-a' }, AccessToken: 'fixture-token' }), response([film]));
  const client = await JellyfinClient.login(session().server, 'user', 'fixture-password'); await client.latest();
  assert.equal(url().pathname, '/jellyfin/Users/account-a/Items/Latest'); assert.equal(requests.length, 3);
});
test('restored session shares version discovery across concurrent home requests and reuses it', async () => {
  const client = new JellyfinClient(session());
  queue.push(response({ Id: 'server-a', Version: '10.8.13' }), response(page([film])), response([film]));
  await Promise.all([client.resume(), client.latest()]);
  assert.deepEqual(requests.map(r => new URL(r.url).pathname), ['/jellyfin/System/Info/Public', '/jellyfin/Users/account-a/Items/Resume', '/jellyfin/Users/account-a/Items/Latest']);
  queue.push(response(page([film]))); await client.libraries(); assert.equal(requests.length, 4);
});
test('failed discovery sends no action and can be retried without duplicate writes', async () => {
  const client = new JellyfinClient(session()); queue.push(new Error('offline'));
  await assert.rejects(client.favorite('movie', true), /offline/); assert.equal(requests.length, 1);
  queue.push(response({ Id: 'server-a', Version: '10.8.13' }), response({}, 204)); await client.favorite('movie', true);
  assert.deepEqual(requests.map(r => r.options.method), ['GET', 'GET', 'POST']);
  assert.equal(url().pathname, '/jellyfin/Users/account-a/FavoriteItems/movie');
});
test('a 405 does not cause alternate methods or route retries on either server version', async () => {
  for (const version of ['10.8.13', '10.10.0']) {
    const before = requests.length; queue.push(response('', 405));
    await assert.rejects(new JellyfinClient(session(), version).latest(), /http_failed/);
    assert.equal(requests.length, before + 1); assert.equal(last().options.method, 'GET');
    queue.push(response('', 405)); await assert.rejects(new JellyfinClient(session(), version).favorite('movie', true), /http_failed/);
    assert.equal(requests.length, before + 2); assert.equal(last().options.method, 'POST');
  }
});
test('malformed server versions fail before sending login credentials or media requests', async () => {
  for (const version of [undefined, null, {}, '10.8', 'not-jellyfin', '10.8.13\r\n']) {
    const before = requests.length; queue.push(response({ Id: 'server-a', Version: version }));
    await assert.rejects(JellyfinClient.login(session().server, 'user', 'fixture-password'), /api_response_invalid/);
    assert.equal(requests.length, before + 1); assert.equal(last().options.method, 'GET');
  }
  const client = new JellyfinClient(session()); queue.push(response({ Id: 'server-a', Version: 'invalid' }));
  await assert.rejects(client.latest(), /api_response_invalid/);
  queue.push(response({ Id: 'server-a', Version: '10.10.0' }), response([film])); await client.latest();
  assert.equal(url().pathname, '/jellyfin/Items/Latest');
});
test('version selection uses a complete minor prefix and remains local to each API instance', async () => {
  const api = new JellyfinApi(new NativeHttpTransport(session()));
  for (const [version, expected] of [['10.8.13+test', '/Users/account-a/Items/Latest'], ['10.10.0', '/Items/Latest'], ['10.80.0', '/Items/Latest'], ['10.8.9', '/Users/account-a/Items/Latest']]) {
    api.setServerVersion(version); queue.push(response([])); await api.getLatestMedia({ userId: 'account-a' });
    assert.equal(url().pathname, '/jellyfin' + expected);
  }
  queue.push(response([])); await new JellyfinApi(new NativeHttpTransport(session())).getLatestMedia({ userId: 'account-a' });
  assert.equal(url().pathname, '/jellyfin/Items/Latest');
});
test('legacy required user and unsupported newer parameters are rejected before HTTP', async () => {
  const api = new JellyfinApi(new NativeHttpTransport(session())); api.setServerVersion('10.8.13');
  await assert.rejects(api.getLatestMedia({}), /api_parameter_invalid/);
  await assert.rejects(api.getItems({ userId: 'account-a', indexNumber: 1 }), /api_parameter_invalid/);
  assert.throws(() => api.getVideoStreamUrl({ itemId: 'movie', enableAudioVbrEncoding: true }), /api_parameter_invalid/);
  assert.equal(requests.length, 0);
});
test('legacy common items, playback and reports retain canonical methods and domain mapping', async () => {
  const client = new JellyfinClient(session(), '10.8.13');
  queue.push(response(page([film]))); await client.items([{ key: 'SearchTerm', value: '电影' }]);
  assert.equal(url().pathname, '/jellyfin/Items'); assert.equal(param('userId'), 'account-a'); assert.equal(param('searchTerm'), '电影');
  queue.push(response({ MediaSources: [{ Id: 'source', MediaStreams: [{ Type: 'Subtitle', Index: 20, IsTextSubtitleStream: true }] }] }));
  const result = await client.playbackInfo('movie'); assert.equal(result.MediaSources[0].MediaStreams[0].IsTextSubtitle, true);
  assert.equal(url().pathname, '/jellyfin/Items/movie/PlaybackInfo');
  queue.push(response('', 204)); await client.report('Progress', 'movie', 'source', 'play', 1, false);
  assert.equal(url().pathname, '/jellyfin/Sessions/Playing/Progress'); assert.equal(last().options.method, 'POST');
});
test('compatibility manifest matches historical OpenAPI and its fingerprint', () => {
  assert.deepEqual(manifest.compatibilitySchemas, config.compatibilitySchemas);
  for (const profile of config.compatibilitySchemas) {
    const bytes = fs.readFileSync(path.join(root, 'openapi', profile.schema));
    assert.equal(crypto.createHash('sha256').update(bytes).digest('hex'), profile.schemaSha256);
    const old = JSON.parse(bytes);
    for (const operation of manifest.operations) {
      const route = operation.compatibility.find(r => r.serverVersionPrefix === profile.serverVersionPrefix);
      assert.equal(old.paths[route.path][route.method.toLowerCase()].operationId, profile.operationIdAliases?.[operation.operationId] || operation.operationId);
    }
    assert.equal(manifest.operations.filter(o => o.compatibility[0].path !== o.path).length, 8);
  }
});
test('bodyless POST and DELETE omit native extraData instead of sending empty string', async () => {
  const transport = new NativeHttpTransport(session());
  for (const method of ['POST', 'DELETE']) { queue.push(response('', 204)); await transport.request('/fixture', method, [], ''); assert.equal(Object.hasOwn(last().options, 'extraData'), false); }
});
(async () => {
  for (const [name, fn] of tests) {
    queue.length = 0; requests.length = 0; destroyed = 0; await fn(); assert.equal(queue.length, 0); console.log('PASS ' + name);
  }
  console.log(`${tests.length} OpenAPI regression tests passed; all ${covered.size} selected operations covered. Native HTTP is mocked; no real server/device proof.`);
})().catch(error => { console.error(error); process.exitCode = 1; });

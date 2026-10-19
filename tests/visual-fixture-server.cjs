// Isolated localhost Jellyfin-shaped fixture for native ArkUI visual checks.
// Never proxy requests or reuse a real server credential. Not a Jellyfin server acceptance test.
const http = require('node:http');
const fs = require('node:fs');
const port = Number(process.env.CINEISLE_VISUAL_PORT || 61820);
const id = n => n.toString(16).padStart(32, '0');
const [movieId, showId, seasonId, episodeId, moviesId, showsId] = [1, 2, 3, 4, 5, 6].map(id);
const userId = id(9), sourceId = id(10);
const stream = [{ Type: 'Video', Index: 0, Codec: 'h264', Width: 1920, Height: 1080, BitDepth: 8 },
  { Type: 'Audio', Index: 1, Codec: 'aac', Language: 'zho', DisplayTitle: '中文 · AAC · Stereo', Channels: 2 },
  { Type: 'Subtitle', Index: 2, Codec: 'srt', Language: 'eng', DisplayTitle: 'English · SRT', IsExternal: true }];
const videoFile=process.env.CINEISLE_VISUAL_VIDEO;
const videoSize=videoFile?fs.statSync(videoFile).size:0;
if(videoFile)stream.splice(2,0,{Type:'Audio',Index:2,Codec:'aac',Language:'eng',DisplayTitle:'English · AAC · Mono'});
const source = { Id: sourceId, Name: '原始版本 · 1080p', Container: 'mp4', Size: 1024 * 1024 * 700,
  RunTimeTicks: 54000000000, MediaStreams: stream, SupportsDirectPlay: true, SupportsDirectStream: true };
if(videoFile){source.Name='映屿布局测试 · H.264 / AAC';source.Size=videoSize;source.RunTimeTicks=6000000000;stream[0].Width=640;stream[0].Height=360;stream[1].Channels=1;stream[1].DisplayTitle='中文 · AAC · Mono';stream.at(-1).Index=3;}
const item = (Id, Name, Type, extra = {}) => ({ Id, Name, Type, Overview: '这是隔离的界面回归测试数据，用于检查映屿图标、配色、元数据与操作入口。',
  Genres: ['剧情', '冒险'], ProductionYear: 2024, CommunityRating: 8.6, OfficialRating: 'PG-13',
  PremiereDate: '2024-01-01T00:00:00Z', Studios: [{ Name: '映屿测试工作室' }], People: [],
  UserData: { Played: false, IsFavorite: false, PlaybackPositionTicks: 0 }, ...extra });
const movie = item(movieId, '光影之岛 · 电影视觉回归', 'Movie', { OriginalTitle: 'Island of Light',
  RunTimeTicks: source.RunTimeTicks, MediaSources: [source, { ...source, Id: id(11), Name: '兼容版本 · 720p' }],
  CanDownload: true, CanDelete: true, PlayAccess: 'Full', RemoteTrailers: [{ Url: 'https://example.invalid/trailer' }],
  UserData: { Played: true, IsFavorite: true, PlaybackPositionTicks: 600000000 } });
const show = item(showId, '潮汐之间 · 剧集视觉回归', 'Series', { OriginalTitle: 'Between the Tides', Status: 'Continuing',
  EndDate: '2025-12-01T00:00:00Z', ChildCount: 1, RecursiveItemCount: 1, PlayAccess: 'Full',
  RemoteTrailers: [{ Url: 'https://example.invalid/trailer' }] });
const season = item(seasonId, '第一季', 'Season', { IndexNumber: 1, SeriesId: showId, SeriesName: show.Name, ChildCount: 1 });
const episode = item(episodeId, '岛屿的清晨', 'Episode', { SeriesId: showId, SeriesName: show.Name, SeasonId: seasonId,
  ParentIndexNumber: 1, IndexNumber: 1, RunTimeTicks: 27000000000, MediaSources: [{ ...source, Id: id(12) }],
  CanDownload: true, PlayAccess: 'Full' });
const libraries = [item(moviesId, '电影 · UI 测试', 'CollectionFolder', { CollectionType: 'movies' }),
  item(showsId, '剧集 · UI 测试', 'CollectionFolder', { CollectionType: 'tvshows' })];
const actorId = id(50); const person = item(actorId, '潮汐 · 演员测试', 'Person', { Overview: '隔离人物简介：用于验证演员作品先显示、标签证据和关注入口。' });
const cast = [{ Id: actorId, Name: person.Name, Type: 'Actor', Role: '侦探' }];
movie.People = cast; movie.Genres = ['犯罪', '悬疑']; show.People = cast; show.Genres = ['Crime'];
const extraMovie = item(id(51), '岛屿谜案 · 新发现', 'Movie', { People: cast, Genres: ['Crime'], CanDownload: true, MediaSources: [source], UserData: { IsFavorite: true, Played: false } });
const catalog = [movie, show, extraMovie, season, episode];
const boxId=id(70), boxesId=id(71), box=item(boxId,'光影与潮汐 · 合集回归','BoxSet');
if(process.env.CINEISLE_VISUAL_COLLECTIONS==='1')libraries.push(item(boxesId,'合集 · UI 测试','CollectionFolder',{CollectionType:'boxsets'}));
const data = new Map([...catalog, person, ...libraries].map(x => [x.Id, x]));
if(process.env.CINEISLE_VISUAL_COLLECTIONS==='1')data.set(boxId,box);
const page = Items => ({ Items, TotalRecordCount: Items.length, StartIndex: 0 });
const routes = [];
const server = http.createServer((req, res) => {
  const url = new URL(req.url, `http://127.0.0.1:${port}`), p = url.pathname;
  const q = new Map(); for (const [key, value] of url.searchParams) { const k = key.toLowerCase(); q.set(k, q.has(k) ? q.get(k) + ',' + value : value); }
  routes.push({ method: req.method, path: p }); // No headers, query strings, login body or credentials.
  let result;
  if (p === '/System/Info/Public') result = { Id: id(20), ServerName: 'CineIsle Visual Fixture', Version: '10.10.0' };
  else if (p === '/Users/Me') result = { Id: userId, Name: 'UI 测试', Configuration: { EnableNextEpisodeAutoPlay: process.env.CINEISLE_VISUAL_AUTONEXT === '1' } };
  else if (p === '/QuickConnect/Enabled') result = true;
  else if (p === '/QuickConnect/Initiate' || p === '/QuickConnect/Connect') result = { Code: '246810', Secret: 'local-layout-quick-secret', Authenticated: false };
  else if (p === '/Users/AuthenticateByName') result = { User: { Id: userId, Name: 'UI 测试', Policy: { EnableContentDeletion: true } }, AccessToken: 'local-fixture-token' };
  else if (p.endsWith('/Views') || p === '/UserViews') result = page(libraries);
  else if (p === '/Shows/NextUp') result = page([episode]);
  else if (p.endsWith('/Seasons')) result = page([season]);
  else if (p.endsWith('/Episodes')) result = page([episode]);
  else if (p.endsWith('/Items/Resume') || p === '/UserItems/Resume') result = page([movie]);
  else if (p.endsWith('/Items/Latest')) result = q.get('parentid') === boxesId ? [box] : q.get('parentid') === showsId ? [show] : q.get('parentid') === moviesId ? [movie] : [movie, show];
  else if (p === '/Movies/Recommendations') result = process.env.CINEISLE_VISUAL_EMPTY_CATALOG === '1' ? [] : [{ Items: [movie] }];
  else if (p === '/Persons') result = page([]);
  else if (p.endsWith('/PlaybackInfo')) result = { MediaSources: videoFile?[source,{...source,Id:id(11),Name:'备用媒体源 · 同一测试视频'}]:[source], PlaySessionId: id(21) };
  else if (/\/(?:User)?(FavoriteItems|PlayedItems)\//.test(p) || /\/Sessions\/Playing/.test(p)) { res.writeHead(204); res.end(); return; }
  else if (p === '/Items' || p === `/Users/${userId}/Items`) {
    let items = q.get('parentid') === showsId ? [show, season, episode] : q.get('parentid') === moviesId ? [movie, extraMovie] : catalog;
    if(process.env.CINEISLE_VISUAL_COLLECTIONS==='1' && q.get('parentid')===boxesId)items=[box];
    if(process.env.CINEISLE_VISUAL_COLLECTIONS==='1' && q.get('parentid')===boxId)items=[movie,show,episode];
    if (q.get('personids')) items = items.filter(x => x.People.some(p => p.Id === q.get('personids')));
    if (q.get('filters') === 'IsFavorite') items = items.filter(x => x.UserData.IsFavorite);
    if (q.get('filters') === 'IsUnplayed') items = items.filter(x => !x.UserData.Played);
    if (q.get('searchterm')) items = items.filter(x => x.Name.includes(q.get('searchterm')));
    if (q.get('includeitemtypes')) items = items.filter(x => q.get('includeitemtypes').split(',').includes(x.Type));
    if (process.env.CINEISLE_VISUAL_EMPTY_CATALOG === '1') items = [];
    const sort = q.get('sortby'); const direction = q.get('sortorder') === 'Descending' ? -1 : 1;
    if (sort) items = [...items].sort((a,b) => {
      const value = item => sort === 'DatePlayed' ? item.UserData.LastPlayedDate : sort === 'SortName' ? item.SortName ?? item.Name : item[sort];
      const left = value(a), right = value(b);
      return direction * (typeof left === 'number' && typeof right === 'number' ? left-right : String(left ?? '').localeCompare(String(right ?? '')));
    });
    const start = Number(q.get('startindex') || 0), limit = Number(q.get('limit') || items.length); result = { Items: items.slice(start, start + limit), TotalRecordCount: items.length, StartIndex: start };
  } else if (/\/Images\//.test(p)) { res.writeHead(404); res.end(); return; }
  else if (/\/Subtitles\/\d+\/Stream\.srt$/.test(p) && videoFile) {
    res.writeHead(200,{'Content-Type':'text/plain'});res.end('1\n00:00:00,000 --> 00:10:00,000\n映屿 · 字幕布局验证\n');return;
  }
  else if (p.endsWith('/Download') || /\/Videos\/[^/]+\/stream$/.test(p)) {
    if(videoFile){
      const range=req.headers.range?.match(/^bytes=(\d+)-(\d*)$/);let start=range?Number(range[1]):0,end=range&&range[2]?Math.min(Number(range[2]),videoSize-1):videoSize-1;
      if(start>=videoSize||end<start){res.writeHead(416,{'Content-Range':`bytes */${videoSize}`});res.end();return;}
      res.writeHead(range?206:200,{'Content-Type':'video/mp4','Accept-Ranges':'bytes','Content-Length':end-start+1,...(range?{'Content-Range':`bytes ${start}-${end}/${videoSize}`}:{})});fs.createReadStream(videoFile,{start,end}).pipe(res);return;
    }
    res.writeHead(200, { 'Content-Type': 'application/octet-stream', 'Content-Length': '4096' }); res.end(Buffer.alloc(4096)); return;
  }
  else {
    const match = p.match(/(?:\/Users\/[^/]+)?\/Items\/([^/]+)$/);
    if (match && data.has(match[1])) result = data.get(match[1]);
  }
  if (result === undefined) { res.writeHead(404, { 'Content-Type': 'application/json' }); res.end(JSON.stringify({ error: 'unhandled local fixture path' })); return; }
  if (process.env.CINEISLE_VISUAL_EMPTY_ALL === '1') {
    if (Array.isArray(result)) result = [];
    else if (Array.isArray(result.Items)) result = page([]);
  }
  const delay = Math.max(0, Math.min(15000, Number(process.env.CINEISLE_VISUAL_RESPONSE_DELAY_MS) || 0));
  const send = () => { res.writeHead(200, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(result)); };
  if (delay && req.method === 'GET') setTimeout(send, delay); else send();
});
server.listen(port, '127.0.0.1', () => console.log(`Native UI fixture listening on localhost:${port}; no external connections.`));
function stop() {
  if (process.env.CINEISLE_VISUAL_ROUTES) fs.writeFileSync(process.env.CINEISLE_VISUAL_ROUTES, JSON.stringify(routes, null, 2));
  server.close(() => process.exit(0));
}
process.on('SIGTERM', stop); process.on('SIGINT', stop);

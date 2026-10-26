const usecase = 'entry/src/main/ets/service/RewatchRecommendations.ets', rules = 'entry/src/main/ets/utils/RewatchRules.ts', adapter = 'entry/src/main/ets/service/JellyfinClient.ets';
const plugin = 'rewatch plugin actual parameters 10.10.0 warm', fallback = 'rewatch fallback actual parameters 10.10.0 warm';
const recipes = [];
const add = (id, file, old, replacement, name) => recipes.push({ id, file, old, replacement, name, suite: 'rewatch-boundaries.test.cjs' });
for (const [key, value, name] of [['categoryLimit', 5, plugin], ['itemsPerCategory', 8, plugin], ['fallbackCandidates', 100, fallback]]) for (const delta of [-1, 1]) {
  add(`${key}-${delta}`, usecase, `private static readonly ${key}: number = ${value};`, `private static readonly ${key}: number = ${value + delta};`, name);
}
for (const [key, replacement] of [['categoryLimit', '4'], ['itemLimit', '7']]) add('adapter-bypass-' + key, adapter, `${key}: ${key},`, `${key}: ${replacement},`, plugin);
add('adapter-bypass-fallback', adapter, "{ key: 'Limit', value: String(limit) }", "{ key: 'Limit', value: '99' }", fallback);
for (const value of [14, 16]) add('output-limit-' + value, rules, 'maxFallbackItems: number = 15;', `maxFallbackItems: number = ${value};`, 'rewatch fallback size 16');
add('remove-output-limit', rules, 'return pool.slice(0, RewatchRules.maxFallbackItems);', 'return pool;', 'rewatch fallback size 16');
add('remove-watched-filter', rules, 'item.UserData?.Played === true', 'true', 'rewatch strict watched filtering precedes stable deduplication');
add('loosen-watched-comparison', rules, 'item.UserData?.Played === true', 'item.UserData?.Played !== false', 'rewatch strict watched filtering precedes stable deduplication');
add('remove-deduplication', rules, 'if (ids.has(item.Id)) { return false; }', 'if (false) { return false; }', 'rewatch strict watched filtering precedes stable deduplication');
add('remove-plugin-priority', rules, 'if (played.length > 0)', 'if (false)', 'rewatch plugin output is uncapped and bypasses fallback random');
add('wrong-plugin-comparison', rules, 'if (played.length > 0)', 'if (played.length >= 0)', 'rewatch fallback size 16');
add('cap-plugin-output', rules, 'return played;', 'return played.slice(0, 15);', 'rewatch plugin output is uncapped and bypasses fallback random');
add('skip-last-shuffle', rules, 'i > 0; i--', 'i > 1; i--', 'rewatch fractional draws preserve floor and descending swap order');
add('extra-random-call', rules, 'i > 0; i--', 'i >= 0; i--', 'rewatch fallback size 1');
add('wrong-random-range', rules, 'random() * (i + 1)', 'random() * i', 'rewatch fallback filters and deduplicates before shuffling');
add('ceil-random-index', rules, 'Math.floor(random()', 'Math.ceil(random()', 'rewatch fractional draws preserve floor and descending swap order');
add('shuffle-only-output-window', rules, 'let i = pool.length - 1;', 'let i = Math.min(pool.length, 15) - 1;', 'rewatch fallback size 16');
add('remove-optional-plugin-fallback', usecase, 'candidates = [];', 'throw e;', 'rewatch optional plugin status 404');
add('always-fallback', usecase, 'if (candidates.some((item: MediaItem) => item.UserData?.Played === true))', 'if (false)', 'rewatch real facade preserves uncapped plugin groups');
add('skip-required-fallback', usecase, 'const fallback = await source.watchedMovies(RewatchRecommendations.fallbackCandidates);', 'const fallback: MediaItem[] = [];', fallback);
add('swallow-initialization-error', adapter, 'async recommend(): Promise<MediaItem[]> {\n    await this.ready();', 'async recommend(): Promise<MediaItem[]> {\n    await this.ready().catch(() => {});', 'rewatch version failure remains outside optional plugin catch');
add('played-query-drift', adapter, "{ key: 'IsPlayed', value: 'true' }", "{ key: 'IsPlayed', value: 'false' }", fallback);
add('fallback-order-drift', adapter, "{ key: 'SortBy', value: 'DatePlayed' }", "{ key: 'SortBy', value: 'DateCreated' }", fallback);
const controls = [
  { name: 'rewatch plugin actual parameters 10.10.0 cold', phase: 'version', pathname: '/jellyfin/System/Info/Public' },
  { name: plugin, phase: 'plugin', pathname: '/jellyfin/Movies/Recommendations' },
  { name: fallback, phase: 'fallback', pathname: '/jellyfin/Items', requiredCalls: { plugin: 1 } },
  { name: 'rewatch fallback size 16', phase: 'random' },
  { name: fallback, phase: 'random', requiredCalls: { plugin: 1, fallback: 1 } },
  { name: 'rewatch Index load uses production facade and fallback', phase: 'plugin', pathname: '/jellyfin/Movies/Recommendations' },
  { name: 'rewatch real facade preserves uncapped plugin groups', phase: 'http-create', nativeInit: true },
  { name: 'rewatch Index load uses production facade and fallback', phase: 'http-create', nativeInit: true },
  { name: 'rewatch fallback size 16', phase: 'setup' }
].map(c => ({ ...c, suite: 'rewatch-boundaries.test.cjs' }));
module.exports = { recipes, controls };

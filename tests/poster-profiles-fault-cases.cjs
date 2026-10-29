const suite = 'poster-profiles-contract.test.cjs', cases = [];
const add = (id, file, old, replacement, name) => cases.push({ id, file: 'entry/src/main/ets/' + file, old, replacement, name, suite });
const producers = [
  ['default', 'components/CachedImage.ets', 'pixelWidth: number = PosterImagePolicy.mediumWidthPx;', 'pixelWidth: number = PosterImagePolicy.', 'mediumWidthPx', 'smallWidthPx', ';'],
  ['card', 'components/MediaCard.ets', 'pixelWidth: this.wide ? PosterImagePolicy.largeWidthPx : PosterImagePolicy.mediumWidthPx,', 'pixelWidth: this.wide ? PosterImagePolicy.largeWidthPx : PosterImagePolicy.', 'mediumWidthPx', 'smallWidthPx', ','],
  ['wide', 'components/MediaCard.ets', 'pixelWidth: this.wide ? PosterImagePolicy.largeWidthPx : PosterImagePolicy.mediumWidthPx,', 'pixelWidth: this.wide ? PosterImagePolicy.', 'largeWidthPx', 'mediumWidthPx', ' : PosterImagePolicy.mediumWidthPx,'],
  ['cast', 'components/DetailMetadata.ets', 'pixelWidth: PosterImagePolicy.smallWidthPx,', 'pixelWidth: PosterImagePolicy.', 'smallWidthPx', 'mediumWidthPx', ','],
  ['actor', 'pages/Index.ets', 'pixelWidth: PosterImagePolicy.smallWidthPx,', 'pixelWidth: PosterImagePolicy.', 'smallWidthPx', 'mediumWidthPx', ','],
  ['detail', 'pages/Detail.ets', 'pixelWidth: PosterImagePolicy.largeWidthPx,', 'pixelWidth: PosterImagePolicy.', 'largeWidthPx', 'mediumWidthPx', ',']
];
for (const [id, file, old, prefix, selected, alternate, suffix] of producers) {
  add(id + '-other-legal', file, old, prefix + alternate + suffix, 'poster profile actual producer ' + id);
  for (const delta of [-1, 1]) add(id + '-drift-' + delta, file, old, prefix + selected + (delta < 0 ? ' - 1' : ' + 1') + suffix, 'poster profile actual producer ' + id);
}
for (const [profile, width, name] of [['small', 160, 'cast'], ['medium', 480, 'default'], ['large', 1280, 'wide']]) for (const delta of [-1, 1]) {
  add(profile + '-policy-' + delta, 'utils/PosterOptions.ts', `${profile}WidthPx: number = ${width}`, `${profile}WidthPx: number = ${width + delta}`, 'poster profile actual producer ' + name);
}
add('cache-target-guard', 'service/PosterCache.ets', '!validPosterTarget(target)', 'false', 'poster profile independent cache width 161');
add('http-target-guard', 'api/PosterTransport.ets', '!validPosterTarget(target)', 'false', 'poster profile independent http width 161');
add('width-admission-remove', 'utils/PosterOptions.ts', '[PosterImagePolicy.smallWidthPx, PosterImagePolicy.mediumWidthPx, PosterImagePolicy.largeWidthPx].includes(value.width)', 'true', 'poster profile independent http width 161');
add('actual-http-width', 'api/PosterTransport.ets', 'ImageType.Primary, maxWidth: target.width,', 'ImageType.Primary, maxWidth: target.width + 1,', 'poster profile actual producer default');
add('actual-decode-width', 'components/CachedImage.ets', 'decodePoster(data.bytes, this.pixelWidth,', 'decodePoster(data.bytes, this.pixelWidth + 1,', 'poster profile actual producer default');
add('actual-cache-width', 'service/PosterCache.ets', "target.backdrop, target.width, 'jpeg-v1'", "target.backdrop, target.width + 1, 'jpeg-v1'", 'poster profile actual producer default');
module.exports = cases;

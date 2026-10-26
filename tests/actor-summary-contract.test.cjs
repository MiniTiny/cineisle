const f = require('./actor-summary-fixture.cjs'), { assert } = f, tests = [], test = (name, action) => tests.push({ name, action });
const checked = (check, result, expectation) => check(() => { assert.ifError(result.unexpected); expectation(result.value); });
for (const scale of [1, 2]) for (const [count, shown] of [[0, 0], [1, 1], [2, 2], [3, 3], [4, 3], [6, 3]]) test('SDK actor summary tags ' + count + ' at ' + scale + 'x', async check => {
  const result = f.invoke(() => { const p = f.profile(count), before = JSON.stringify(p.tags), r = f.render('Index', { ready: true, signedIn: true, tab: 3, profiles: [p], showTags: true }, scale); return { labels: r.buttons.map(n => n.attrs.accessibilityText[0]), before, after: JSON.stringify(p.tags), message: r.form.view.message }; });
  checked(check, result, r => { assert.deepEqual(r.labels, Array.from({ length: shown }, (_, i) => 'boundary' + i)); assert.equal(r.after, r.before); assert.equal(r.message, ''); });
});
test('SDK summary limit applies independently to each actor in original order', async check => {
  const result = f.invoke(() => { const first = f.profile(6, 'a'), second = f.profile(4, 'b'), r = f.render('Index', { ready: true, signedIn: true, tab: 3, profiles: [first, second], showTags: true }); return { labels: r.buttons.map(n => n.attrs.accessibilityText[0]), full: [first.tags.length, second.tags.length] }; });
  checked(check, result, r => { assert.deepEqual(r.labels, ['boundarya0', 'boundarya1', 'boundarya2', 'boundaryb0', 'boundaryb1', 'boundaryb2']); assert.deepEqual(r.full, [6, 4]); });
});
test('SDK summary hidden tags preserve full profile and previous error feedback', async check => {
  const result = f.invoke(() => { const p = f.profile(6), r = f.render('Index', { ready: true, signedIn: true, tab: 3, profiles: [p], showTags: false, message: 'existing feedback' }); return { labels: r.buttons.length, count: p.tags.length, message: r.form.view.message }; });
  checked(check, result, r => { assert.equal(r.labels, 0); assert.equal(r.count, 6); assert.equal(r.message, 'existing feedback'); });
});
for (const count of [4, 6]) test('SDK actor detail retains every profile tag ' + count, async check => {
  const result = f.invoke(() => { const p = f.profile(count), r = f.render('Actor', { person: p.person, profile: p, works: [] }); const select = r.compiled.flat(r.form.roots).find(n => n.type === 'Select' && n.args[0].some(v => v.value === 'boundary0')); const labels = Array.from(select.args[0], v => v.value); select.attrs.onSelect[0](count); return { labels, selected: r.form.view.tag, full: p.tags.length }; });
  checked(check, result, r => { assert.deepEqual(r.labels, ['all_tags', ...Array.from({ length: count }, (_, i) => 'boundary' + i)]); assert.equal(r.selected, 'genre:boundary' + (count - 1)); assert.equal(r.full, count); });
});
test('SDK summary tag action reaches actual profile refresh without business truncation', async check => {
  const result = f.invoke(() => { f.h.activate(); const person = { Id: 'person', Name: 'Actual Actor', Type: 'Actor' }; f.A.snapshot = f.h.snapshot(['one', 'two', 'three'].map(id => ({ ...f.h.film(id, [person]), Genres: ['boundary0', 'boundary1', 'boundary2', 'boundary3'] }))); const profiles = f.requireProfiles(f.actorProfiles(f.A.snapshot.items)), r = f.render('Index', { ready: true, signedIn: true, tab: 3, profiles, showTags: true, appService: f.A }); const before = profiles[0].tags.map(v => v.key), initial = r.buttons.map(n => n.attrs.accessibilityText[0]); r.buttons[0].attrs.onClick[0](); return { initial, before, afterInput: profiles[0].tags.map(v => v.key), selected: r.form.view.actorTag, refreshed: r.form.view.profiles.map(p => ({ id: p.person.Id, tags: p.tags.map(v => v.key) })) }; });
  checked(check, result, r => { assert.deepEqual(r.initial, ['boundary0', 'boundary1', 'boundary2']); assert.deepEqual(r.before, ['genre:boundary0', 'genre:boundary1', 'genre:boundary2', 'genre:boundary3']); assert.deepEqual(r.afterInput, r.before); assert.equal(r.selected, 'genre:boundary0'); assert.deepEqual(JSON.parse(JSON.stringify(r.refreshed)), [{ id: 'person', tags: r.before }]); });
});
test('SDK summary actor action preserves actual route identity', async check => {
  const result = f.invoke(() => { const p = f.profile(4), r = f.render('Index', { ready: true, signedIn: true, tab: 3, profiles: [p], showTags: true }); const button = r.compiled.flat(r.form.roots).find(n => n.type === 'Button' && n.attrs.accessibilityText?.[0] === p.person.Name); button.attrs.onClick[0](); return r.form.events.find(e => e[0] === 'route'); });
  checked(check, result, r => { assert.equal(r[1], 'pages/Actor'); assert.deepEqual(JSON.parse(JSON.stringify(r[2])), { personId: 'actor', personName: 'Actor' }); });
});
f.run(tests).catch(error => { console.error(error); process.exitCode = 1; });

"""Actual ASS source preparation entries; real small files and metadata-only quota fixtures."""
from pathlib import Path
import io
import json
import runpy
import tarfile

# Fresh source also prevents helper mutation probes from reading a stale pyc.
h = runpy.run_path(str(Path(__file__).with_name('source_preparation_fixture.py')))
expect, member = h['expect'], h['member']
cases = []


def captured(action):
    try:
        return action(), None
    except Exception as error:
        return None, error


def checked(error, action):
    def check():
        expect(error is None, 'unexpected production error: ' + str(error))
        action()
    return check


def real_tar(path, members):
    with h['_REAL_TAR_OPEN'](path, 'w:gz') as archive:
        for value, payload in members:
            archive.addfile(value, io.BytesIO(payload) if value.isfile() else None)


def fetch(f):
    def operation():
        f.begin()
        return f.source()
    destination, error = captured(operation)
    state = f.snapshot()
    data = (destination / 'file.txt').read_bytes() if destination else None
    index = json.loads((destination / '.source-files.json').read_text()) if destination else None
    def verify():
        argv = state['argv'][0]
        expected = ['curl', '--fail', '--location', '--connect-timeout', '30', '--max-time', '1800', '--max-filesize', '100000000', '--output', str(f.archive_path().with_suffix('.download')), 'https://fixture.invalid/source.tar.gz']
        expect(argv['args'] == expected, 'actual subprocess argv drift')
        expect(state['capture'] == expected[1:], 'actual executable argv drift')
        expect(argv['check'] is True and argv['environment'] is True)
        expect(data == b'actual small source fixture')
        expect(index == {'file.txt': __import__('hashlib').sha256(data).hexdigest()})
        expect(f.archive_path().exists())
        expect(not f.archive_path().with_suffix('.download').exists())
        expect(state['events'].index('curl-run') < state['events'].index('hash-read') < state['events'].index('tar-open'))
        expect(state['events'].index('member-extract') < state['events'].index('manifest-write'))
        expect(state['calls']['source-load'] == state['calls']['curl-run'] == state['calls']['tar-open'] == state['calls']['manifest-write'] == 1)
    return checked(error, verify)


cases.append(('ASS source invokes actual curl argv and preserves hash extract order', fetch))


def cached(f):
    def operation():
        f.begin()
        first = f.source()
        state = f.snapshot()
        original_index = (first / '.source-files.json').read_bytes()
        second = f.source(True)
        return first, second, state, original_index
    result, error = captured(operation)
    state = f.snapshot()
    def verify():
        first, second, before, index = result
        expect(first == second)
        expect((second / '.source-files.json').read_bytes() == index)
        expect(state['calls']['curl-run'] == before['calls']['curl-run'] == 1)
        expect(state['calls']['tar-open'] == before['calls']['tar-open'] == 1)
    return checked(error, verify)


cases.append(('ASS source cached reconstruction skips fetching and extracting', cached))


def offline(f):
    def operation():
        f.archive_path().write_bytes(f.payload.read_bytes())
        f.begin()
        return f.source(True)
    destination, error = captured(operation)
    state = f.snapshot()
    content = (destination / 'file.txt').read_bytes() if destination else None
    return checked(error, lambda: (expect(content == b'actual small source fixture'), expect(state['calls'].get('curl-run', 0) == 0), expect(state['calls'].get('tar-open', 0) == 1)))


cases.append(('ASS source offline cached archive uses actual digest and tar', offline))


def reject(f, mode):
    def operation():
        if mode == 'offline':
            f.begin()
            return f.source(True)
        if mode == 'checksum':
            f.record['sha256'] = 'x' * 64
            f.begin()
        elif mode == 'download-hash':
            f.record['sha256'] = '0' * 64
            f.begin()
        elif mode == 'cached-hash':
            f.archive_path().write_bytes(b'explicit wrong cached archive')
            f.begin()
        else:
            f.begin()
            destination = f.source()
            (destination / 'file.txt').write_bytes(b'tampered source')
        return f.source()
    result, error = captured(operation)
    state = f.snapshot()
    expected = {'offline': 'source archive unavailable offline: libass', 'checksum': 'missing pinned source fingerprint', 'download-hash': 'download fingerprint mismatch: libass', 'cached-hash': 'cached archive fingerprint mismatch: libass', 'tampered': 'extracted source changed: libass'}[mode]
    def verify():
        expect(type(error) is RuntimeError and str(error) == expected)
        expect(state['calls'].get('curl-run', 0) == (1 if mode in ('download-hash', 'tampered') else 0))
        expect(state['calls'].get('tar-open', 0) == (1 if mode == 'tampered' else 0))
        if mode == 'download-hash':
            expect(f.archive_path().with_suffix('.download').exists() and not f.archive_path().exists())
        if mode == 'tampered':
            expect(result is None)
            expect(any(path.name == 'file.txt' and path.read_bytes() == b'tampered source' for path in (f.cache / 'sources').rglob('file.txt')))
    return verify


for mode in ['offline', 'checksum', 'download-hash', 'cached-hash', 'tampered']:
    cases.append(('ASS source rejects ' + mode + ' without reordering work', lambda f, mode=mode: reject(f, mode)))


def stale(f):
    def operation():
        partial = f.cache / 'sources' / ('libass-' + f.payload_hash[:16] + '.extracting')
        partial.mkdir()
        (partial / 'stale.txt').write_bytes(b'stale')
        f.begin()
        return f.source()
    destination, error = captured(operation)
    exists = bool(destination and (destination / 'stale.txt').exists())
    return checked(error, lambda: expect(not exists))


cases.append(('ASS source clears stale extracting directory before actual extraction', stale))


def metadata_quota(f, sizes, expected=False, directory_first=False, discarded=False, root_size=0):
    destination = f.directory / 'extracted'
    def operation():
        f.begin()
        values = [member('package', root_size, tarfile.DIRTYPE)]
        if discarded:
            values.append(member('package/link', 1073741825, tarfile.SYMTYPE))
            values.append(member('package/device', 1073741825, tarfile.CHRTYPE))
        for i, size in enumerate(sizes):
            values.append(member('package/item-' + str(i), size, tarfile.DIRTYPE if directory_first and i == 0 else tarfile.REGTYPE))
        f.synthetic = values
        return f.module.extract(f.payload, destination)
    value, error = captured(operation)
    state = f.snapshot()
    manifest = (destination / '.source-files.json').exists()
    # The independent scenario vectors supply their declared expected cutoff.
    def verify():
        if expected:
            expect(type(error) is RuntimeError and str(error) == 'source archive exceeds extraction limit')
            expect(not manifest)
            expect(len(state['extracted']) == len(sizes) - 1)
        else:
            expect(error is None, 'unexpected metadata quota rejection: ' + str(error))
            expect(manifest)
            expect(len(state['extracted']) == len(sizes))
        expect(all(value[2] == 'data' for value in state['extracted']))
        expect(not any('link' in value[0] or 'device' in value[0] for value in state['extracted']))
    return verify


for size, rejected in [(1073741823, False), (1073741824, False), (1073741825, True)]:
    cases.append(('ASS extract single metadata bytes ' + str(size), lambda f, size=size, rejected=rejected: metadata_quota(f, [size], expected=rejected)))
for suffix, tail, rejected in [('below', 536870911, False), ('at', 536870912, False), ('above', 536870913, True)]:
    cases.append(('ASS extract combined metadata bytes ' + suffix, lambda f, tail=tail, rejected=rejected: metadata_quota(f, [536870912, tail], expected=rejected)))
    cases.append(('ASS extract directory metadata bytes ' + suffix, lambda f, tail=tail, rejected=rejected: metadata_quota(f, [536870912, tail], expected=rejected, directory_first=True)))
cases.append(('ASS extract root metadata remains excluded from budget', lambda f: metadata_quota(f, [1], root_size=1073741825)))
cases.append(('ASS extract links and devices retain original ignored behavior', lambda f: metadata_quota(f, [1], discarded=True)))


def real_extract(f, mode):
    archive_path, destination = f.directory / 'real.tar.gz', f.directory / 'real-extracted'
    values = [(member('package', kind=tarfile.DIRTYPE), b''), (member('package/a.txt', 1), b'A')]
    if mode == 'traversal':
        values.append((member('package/../escape.txt', 1), b'E'))
    elif mode == 'roots':
        values.append((member('second/b.txt', 1), b'B'))
    elif mode == 'ignored':
        link = member('package/link', kind=tarfile.SYMTYPE)
        link.linkname = '../escape.txt'
        values += [(link, b''), (member('package/device', kind=tarfile.CHRTYPE), b'')]
    real_tar(archive_path, values)
    def operation():
        f.begin()
        return f.module.extract(archive_path, destination)
    value, error = captured(operation)
    state = f.snapshot()
    content = (destination / 'a.txt').read_bytes() if (destination / 'a.txt').exists() else None
    def verify():
        expect(content == b'A')
        expect(not (f.directory / 'escape.txt').exists())
        if mode in ('traversal', 'roots'):
            expect(type(error) is RuntimeError and str(error) == ('unsafe source archive path' if mode == 'traversal' else 'source archive has multiple roots'))
            expect(not (destination / '.source-files.json').exists())
        else:
            expect(error is None, str(error))
            expect(json.loads((destination / '.source-files.json').read_text()) == {'a.txt': __import__('hashlib').sha256(b'A').hexdigest()})
            expect(not (destination / 'link').exists() and not (destination / 'device').exists())
        expect(state['calls']['tar-open'] == 1)
    return verify


for mode in ['regular', 'traversal', 'roots', 'ignored']:
    cases.append(('ASS actual small tar ' + mode + ' preserves extraction behavior', lambda f, mode=mode: real_extract(f, mode)))


def origin(f):
    tracker = h['Tracker']('isolated-origin', '')
    def fail():
        error = OSError(5, 'native origin fixture')
        error.contract_injected = True
        raise error
    _, error = captured(lambda: tracker.call('outer', lambda: tracker.call('inner', fail)))
    state = tracker.states[id(error)]
    return lambda: (expect(len(tracker.errors) == 1), expect(state['phase'] == 'inner'), expect(state['calls'] == {'outer': 1, 'inner': 1}), expect(state['injected'] is True))


cases.append(('Python tracker retains first originating native failure', origin))
h['run'](cases)

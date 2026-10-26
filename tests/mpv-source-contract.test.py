"""Actual MPV source preparation, native archive policy and independent resource budgets."""
from pathlib import Path
import hashlib
import io
import json
import runpy
import tarfile
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


def real_tar(path, values, mode='w:gz'):
    with h['_REAL_TAR_OPEN'](path, mode) as archive:
        for value, payload in values:
            archive.addfile(value, io.BytesIO(payload) if value.isfile() else None)


def fetch(f, xz=False):
    def operation():
        if xz:
            real_tar(f.payload, [(member('package', kind=tarfile.DIRTYPE), b''), (member('package/file.txt', 1), b'X')], 'w:xz')
            f.record.update(sha256=hashlib.sha256(f.payload.read_bytes()).hexdigest(), url='https://fixture.invalid/source.tar.xz')
        f.begin()
        return f.source()
    destination, error = captured(operation)
    state = f.snapshot()
    data = (destination / 'file.txt').read_bytes() if destination else None
    index = json.loads((destination / '.source-files.json').read_text()) if destination else None
    def verify():
        argv = state['argv'][0]
        expected = ['curl', '--fail', '--location', '--connect-timeout', '30', '--max-time', '1800', '--max-filesize', '100000000', '--output', str(f.archive_path().with_suffix('.download')), f.record['url']]
        expect(argv['args'] == expected and state['capture'] == expected[1:], 'actual subprocess argv drift')
        expect(argv['check'] is True and argv['environment'] is True)
        expect(data == (b'X' if xz else b'actual small source fixture'))
        expect(index == {'file.txt': hashlib.sha256(data).hexdigest()})
        expect(destination == f.cache / 'sources' / f.record['sha256'])
        expect(f.archive_path().exists() and not f.archive_path().with_suffix('.download').exists())
        expect(state['events'].index('curl-run') < state['events'].index('hash-read') < state['events'].index('tar-open'))
        expect(state['events'].index('member-extract') < state['events'].index('manifest-write'))
        expect(state['manifests'] == ['.source-files.json.tmp'])
        expect(not (destination / '.source-files.json.tmp').exists())
    return checked(error, verify)


cases.append(('MPV source invokes actual curl argv and atomic manifest', fetch))
cases.append(('MPV source xz archive naming and actual decoding remain compatible', lambda f: fetch(f, True)))


def cached(f):
    def operation():
        f.begin()
        first = f.source()
        before = f.snapshot()
        second = f.source(True)
        return first, second, before
    result, error = captured(operation)
    state = f.snapshot()
    def verify():
        first, second, before = result
        expect(first == second)
        expect(state['calls']['curl-run'] == before['calls']['curl-run'] == 1)
        expect(state['calls']['tar-open'] == before['calls']['tar-open'] == 1)
        expect(state['manifests'] == ['.source-files.json.tmp'])
    return checked(error, verify)


cases.append(('MPV cached reconstruction avoids fetch and extraction', cached))


def offline(f):
    def operation():
        f.archive_path().write_bytes(f.payload.read_bytes())
        f.begin()
        return f.source(True)
    destination, error = captured(operation)
    state = f.snapshot()
    data = (destination / 'file.txt').read_bytes() if destination else None
    return checked(error, lambda: (expect(data == b'actual small source fixture'), expect(state['calls'].get('curl-run', 0) == 0), expect(state['calls'].get('tar-open', 0) == 1)))


cases.append(('MPV offline cached archive uses real hash and extraction', offline))


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
            f.archive_path().write_bytes(b'wrong cached archive')
            f.begin()
        else:
            f.begin()
            destination = f.source()
            (destination / 'file.txt').write_bytes(b'tampered')
        return f.source()
    result, error = captured(operation)
    state = f.snapshot()
    expected = {'offline': 'pinned native source unavailable offline: mpv', 'checksum': 'invalid pinned native source fingerprint', 'download-hash': 'downloaded native source fingerprint mismatch', 'cached-hash': 'cached native source fingerprint mismatch', 'tampered': 'cached native source was modified'}[mode]
    def verify():
        expect(type(error) is RuntimeError and str(error) == expected)
        expect(state['calls'].get('curl-run', 0) == (1 if mode in ('download-hash', 'tampered') else 0))
        expect(state['calls'].get('tar-open', 0) == (1 if mode == 'tampered' else 0))
        if mode == 'download-hash':
            expect(f.archive_path().with_suffix('.download').exists() and not f.archive_path().exists())
        if mode == 'tampered':
            expect(any(p.read_bytes() == b'tampered' for p in (f.cache / 'sources').rglob('file.txt')))
    return verify


for mode in ['offline', 'checksum', 'download-hash', 'cached-hash', 'tampered']:
    cases.append(('MPV source rejects ' + mode + ' without reordering work', lambda f, mode=mode: reject(f, mode)))


def stale(f):
    def operation():
        directory = f.cache / 'sources' / (f.record['sha256'] + '.extracting')
        directory.mkdir()
        (directory / 'stale').write_bytes(b'stale')
        f.begin()
        return f.source()
    destination, error = captured(operation)
    return checked(error, lambda: expect(not (destination / 'stale').exists()))


cases.append(('MPV clears stale extracting directory before commit', stale))


def quota(f, sizes, rejected=False, directory_first=False, root_size=0):
    directory = f.directory / 'metadata'
    def operation():
        f.begin()
        f.synthetic = [member('package', root_size, tarfile.DIRTYPE)] + [member('package/item-' + str(i), n, tarfile.DIRTYPE if directory_first and i == 0 else tarfile.REGTYPE) for i, n in enumerate(sizes)]
        return f.module.extract(f.payload, directory)
    result, error = captured(operation)
    state = f.snapshot()
    def verify():
        if rejected:
            expect(type(error) is RuntimeError and str(error) == 'native source extraction exceeds limit')
            expect(not (directory / '.source-files.json').exists())
            expect(len(state['extracted']) == len(sizes) - 1)
        else:
            expect(error is None, str(error))
            expect((directory / '.source-files.json').exists())
            expect(len(state['extracted']) == len(sizes))
        expect(all(value[2] == 'data' for value in state['extracted']))
    return verify


for size, rejected in [(2147483647, False), (2147483648, False), (2147483649, True)]:
    cases.append(('MPV extract single metadata bytes ' + str(size), lambda f, size=size, rejected=rejected: quota(f, [size], rejected)))
for label, size, rejected in [('below', 1073741823, False), ('at', 1073741824, False), ('above', 1073741825, True)]:
    cases.append(('MPV extract combined metadata bytes ' + label, lambda f, size=size, rejected=rejected: quota(f, [1073741824, size], rejected)))
    cases.append(('MPV extract directory metadata bytes ' + label, lambda f, size=size, rejected=rejected: quota(f, [1073741824, size], rejected, directory_first=True)))
cases.append(('MPV extract root metadata size remains excluded', lambda f: quota(f, [1], root_size=2147483649)))


def count(f, amount, rejected):
    directory = f.directory / 'counted'
    supplied = [0]
    def values():
        for _ in range(amount):
            supplied[0] += 1
            yield member('package', kind=tarfile.DIRTYPE)
    def operation():
        f.begin()
        f.synthetic = values()
        return f.module.extract(f.payload, directory)
    result, error = captured(operation)
    state = f.snapshot()
    def verify():
        expect(supplied[0] == amount)
        expect(state['extracted'] == [])
        if rejected:
            expect(type(error) is RuntimeError and str(error) == 'invalid native source archive roots or member count')
            expect(not (directory / '.source-files.json').exists())
        else:
            expect(error is None, str(error))
            expect(json.loads((directory / '.source-files.json').read_text()) == {})
    return verify


for amount, rejected in [(199999, False), (200000, False), (200001, True)]:
    cases.append(('MPV extract member count including skipped roots ' + str(amount), lambda f, amount=amount, rejected=rejected: count(f, amount, rejected)))


def real_extract(f, mode):
    archive, directory = f.directory / 'real.tar.gz', f.directory / 'real'
    root = member('package', kind=tarfile.DIRTYPE)
    values = [(root, b''), (member('package/a.txt', 1), b'A')]
    if mode == 'root-file':
        values = [(member('package', 1), b'R')]
    elif mode == 'roots':
        values.append((member('other/b.txt', 1), b'B'))
    elif mode == 'traversal':
        values.append((member('package/../escape.txt', 1), b'E'))
    elif mode in ('hardlink', 'hardlink-root'):
        link = member('package/hard', kind=tarfile.LNKTYPE)
        link.linkname = 'package/a.txt' if mode == 'hardlink' else 'outside/a.txt'
        values.append((link, b''))
    elif mode in ('symlink', 'symlink-escape'):
        link = member('package/link', kind=tarfile.SYMTYPE)
        link.linkname = 'a.txt' if mode == 'symlink' else '../../escape.txt'
        values.append((link, b''))
    elif mode in ('device', 'fifo'):
        values.append((member('package/unsupported', kind=tarfile.CHRTYPE if mode == 'device' else tarfile.FIFOTYPE), b''))
    real_tar(archive, values)
    f.expected_tar_filter_error = mode == 'symlink-escape'
    def operation():
        f.begin()
        return f.module.extract(archive, directory)
    result, error = captured(operation)
    state = f.snapshot()
    expected = {'root-file': 'native archive root is not a directory', 'roots': 'invalid native source archive roots or member count', 'traversal': 'unsafe native dependency path', 'hardlink-root': 'invalid source hard link', 'device': 'unsupported native archive member', 'fifo': 'unsupported native archive member'}
    def verify():
        expect(not (f.directory / 'escape.txt').exists())
        expect(state['calls']['tar-open'] == 1)
        if mode in expected:
            expect(type(error) is RuntimeError and str(error) == expected[mode], 'wrong original rejection: ' + str(error))
            expect(not (directory / '.source-files.json').exists())
        elif mode == 'symlink-escape':
            expect(isinstance(error, tarfile.LinkOutsideDestinationError), str(error))
            expect(not (directory / '.source-files.json').exists())
        else:
            expect(error is None, str(error))
            manifest = json.loads((directory / '.source-files.json').read_text())
            expected_manifest = {'a.txt': hashlib.sha256(b'A').hexdigest()}
            if mode == 'hardlink':
                expect((directory / 'hard').read_bytes() == b'A')
                expected_manifest['hard'] = hashlib.sha256(b'A').hexdigest()
            if mode == 'symlink':
                expect((directory / 'link').is_symlink() and (directory / 'link').read_bytes() == b'A')
                expected_manifest['link'] = {'link': 'a.txt'}
            expect(manifest == expected_manifest)
    return verify


for mode in ['regular', 'root-file', 'roots', 'traversal', 'hardlink', 'hardlink-root', 'symlink', 'symlink-escape', 'device', 'fifo']:
    cases.append(('MPV actual small tar ' + mode + ' keeps original policy', lambda f, mode=mode: real_extract(f, mode)))


def snapshot_escape(f):
    directory = f.directory / 'snapshot'
    directory.mkdir()
    (f.directory / 'outside').write_bytes(b'outside')
    (directory / 'link').symlink_to('../outside')
    def operation():
        f.begin()
        return f.module.snapshot(directory)
    result, error = captured(operation)
    return lambda: expect(type(error) is RuntimeError and str(error) == 'native source symlink escapes its directory')


cases.append(('MPV snapshot independently rejects escaping symlink', snapshot_escape))
h['run'](cases, scope='mpv-source', script='build-native-mpv.py')

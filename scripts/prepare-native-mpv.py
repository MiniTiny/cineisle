#!/usr/bin/env python3
"""Prepare the complete pinned source runtime and its matching dependency notices."""
import argparse
import fcntl
import hashlib
import importlib.util
import json
from pathlib import Path, PurePosixPath
import shutil
import tempfile

ROOT = Path(__file__).resolve().parents[1]
CACHE = ROOT / '.local/native-mpv'
LIBRARIES = ('libmpv.so', 'libc++_shared.so')


def digest(path):
    with path.open('rb') as stream:
        return hashlib.file_digest(stream, 'sha256').hexdigest()


def relative(value):
    path = PurePosixPath(value)
    if not path.parts or path.is_absolute() or '..' in path.parts or any(c in value for c in '\x00\r\n\\'):
        raise RuntimeError('invalid native MPV notice path')
    return Path(*path.parts)


def files(directory):
    result = {}
    for path in sorted(directory.rglob('*')):
        if path.is_symlink():
            raise RuntimeError('published native MPV assets must not contain symbolic links')
        if path.is_file():
            result[str(path.relative_to(directory))] = digest(path)
    return result


def load_script(name):
    spec = importlib.util.spec_from_file_location('cineisle_' + name.replace('-', '_'), ROOT / 'scripts' / name)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def build_source(offline):
    module = load_script('build-native-mpv.py')
    module.CACHE.mkdir(parents=True, exist_ok=True)
    with (module.CACHE / 'build.lock').open('w') as lock:
        fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
        return module.build(offline=offline)


def collect_notices(artifact, offline):
    module = load_script('prepare-mpv-notices.py')
    with (module.source.CACHE / 'notices.lock').open('w') as lock:
        fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
        return module.prepare(artifact, offline=offline)


def verify_notices(directory, metadata, libraries):
    index = json.loads((directory / 'sources.json').read_text())
    if index['sourceRecipe'] != metadata or index['nativeLibraryHashes'] != libraries:
        raise RuntimeError('native MPV notices do not match their source/runtime')
    expected = {'sources/' + row['name'] for row in metadata['sources']}
    if not expected.issubset({row['component'] for row in index['components']}):
        raise RuntimeError('native MPV component notices are incomplete')
    for component in index['components']:
        if not component['noticeFiles']:
            raise RuntimeError('native MPV component has no notice files')
        for notice in component['noticeFiles']:
            path = directory / relative(notice['file'])
            if not path.is_file() or digest(path) != notice['sha256']:
                raise RuntimeError('native MPV notice file fingerprint mismatch')
    if not (directory / 'NOTICE.txt').is_file():
        raise RuntimeError('native MPV package notice is missing')


def write_prepared(result):
    temporary = CACHE / 'prepared.tmp'
    temporary.write_text(json.dumps(result, indent=2) + '\n')
    temporary.replace(CACHE / 'prepared.json')


def publish(artifact, notices, result):
    output = ROOT / 'entry/libs/arm64-v8a'
    notice_output = ROOT / 'entry/src/main/resources/rawfile/third_party/mpv'
    current = {name: digest(output / name) for name in LIBRARIES if (output / name).is_file()}
    unchanged = current == result['libraries'] and notice_output.is_dir() and files(notice_output) == result['notices']
    if unchanged:
        write_prepared(result)
        return
    with tempfile.TemporaryDirectory(prefix='publish-', dir=CACHE) as temporary:
        stage = Path(temporary)
        for name in LIBRARIES:
            shutil.copy2(artifact / name, stage / name)
            if digest(stage / name) != result['libraries'][name]:
                raise RuntimeError('native MPV changed while staging')
        shutil.copytree(notices, stage / 'notices')
        if files(stage / 'notices') != result['notices']:
            raise RuntimeError('native MPV notices changed while staging')
        targets = [(stage / name, output / name) for name in LIBRARIES] + [(stage / 'notices', notice_output)]
        changed = []
        try:
            for number, (candidate, target) in enumerate(targets):
                target.parent.mkdir(parents=True, exist_ok=True)
                backup = stage / ('backup-' + str(number))
                had_previous = target.exists()
                if had_previous:
                    target.replace(backup)
                changed.append((target, backup, had_previous))
                candidate.replace(target)
            write_prepared(result)
        except Exception:
            for target, backup, had_previous in reversed(changed):
                if target.is_dir():
                    shutil.rmtree(target)
                elif target.exists():
                    target.unlink()
                if had_previous:
                    backup.replace(target)
            raise


def prepare(offline=False):
    manifest = json.loads((ROOT / 'docs/native-mpv-runtime.json').read_text())
    if manifest.get('schema') != 2 or manifest['abi'] != 'arm64-v8a' or manifest['minimumApi'] != 15:
        raise RuntimeError('unsupported native MPV runtime target/schema')
    if manifest['sourceManifest'] != 'native-mpv-sources.json':
        raise RuntimeError('invalid native MPV source manifest path')
    source_path = ROOT / 'docs' / manifest['sourceManifest']
    if digest(source_path) != manifest['sourceManifestSha256']:
        raise RuntimeError('native MPV source manifest fingerprint mismatch')
    if manifest['noticeManifest'] != 'native-mpv-notices.json' or digest(ROOT / 'docs' / manifest['noticeManifest']) != manifest['noticeManifestSha256']:
        raise RuntimeError('native MPV notice manifest fingerprint mismatch')
    if digest(ROOT / 'entry/src/main/cpp/mpv/include/mpv/client.h') != manifest['clientHeaderSha256']:
        raise RuntimeError('native MPV client header fingerprint mismatch')
    metadata = json.loads(source_path.read_text())
    CACHE.mkdir(parents=True, exist_ok=True)
    with (CACHE / 'prepare.lock').open('w') as lock:
        fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
        artifact = build_source(offline)
        receipt = json.loads((artifact.parent / 'receipt.json').read_text())
        if receipt['recipe']['manifest'] != manifest['sourceManifestSha256'] or receipt['sourceManifest'] != metadata:
            raise RuntimeError('native MPV build/source binding mismatch')
        libraries = files(artifact)
        if set(libraries) != set(LIBRARIES) or libraries != receipt['files']:
            raise RuntimeError('native MPV built artifact fingerprint mismatch')
        for name in LIBRARIES:
            with (artifact / name).open('rb') as stream:
                header = stream.read(20)
            if header[:6] != b'\x7fELF\x02\x01' or int.from_bytes(header[18:20], 'little') != 183:
                raise RuntimeError('native MPV runtime must be little-endian AArch64 ELF')
        notices = collect_notices(artifact, offline)
        verify_notices(notices, metadata, libraries)
        result = {'schema': 2, 'version': manifest['version'], 'abi': manifest['abi'], 'minimumApi': manifest['minimumApi'],
                  'sourceManifestSha256': manifest['sourceManifestSha256'], 'sourceBuildFingerprint': receipt['fingerprint'],
                  'noticeBuilderSha256': digest(ROOT / 'scripts/prepare-mpv-notices.py'),
                  'libraries': libraries, 'notices': files(notices)}
        publish(artifact, notices, result)
        print('Complete pinned-source MPV runtime and dependency notices prepared;API12 shim remains independent')
        return result


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--offline', action='store_true')
    prepare(parser.parse_args().offline)

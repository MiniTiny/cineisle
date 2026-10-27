#!/usr/bin/env python3
"""Collect pinned MPV dependency notices separately from native compilation."""
import argparse
import fcntl
import hashlib
import importlib.util
import json
import os
import runpy
from pathlib import Path
import re
import shutil
import tomllib

ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location('cineisle_mpv_source_recipe', ROOT / 'scripts/build-native-mpv.py')
source = importlib.util.module_from_spec(spec)
spec.loader.exec_module(source)


def notice_names(directory, declared=None):
    names = [str(path.relative_to(directory)) for path in sorted(directory.iterdir())
             if path.is_file() and re.fullmatch(r'(LICENSE|COPYING|COPYRIGHT|NOTICE)([._-].*)?', path.name, re.I)
             and path.suffix.lower() not in ['.rs', '.py', '.cfg']]
    # Some crates, including crc-catalog, use an SPDX LICENSES directory.
    for folder in sorted(directory.iterdir()):
        if folder.is_dir() and folder.name.lower() in ['license', 'licenses', 'licence', 'licences']:
            names.extend(str(path.relative_to(directory)) for path in sorted(folder.rglob('*')) if path.is_file())
    if declared:
        declared = str(source.relative(declared))
        if declared not in names:
            names.append(declared)
    if not names:
        raise RuntimeError('dependency has no upstream notice files: ' + directory.name)
    return names


def package_notices(package, directory, supplements, offline):
    metadata = tomllib.loads((directory / 'Cargo.toml').read_text())['package']
    try:
        return directory, notice_names(directory, metadata.get('license-file', metadata.get('license_file'))), metadata
    except RuntimeError:
        matching = [row for row in supplements['supplements'] if row['name'] == package['name'] and row['version'] == package['version']]
        if len(matching) != 1:
            raise RuntimeError('missing pinned upstream notice supplement: ' + package['name'])
        row = matching[0]
        vcs = json.loads((directory / '.cargo_vcs_info.json').read_text())
        if vcs['git']['sha1'] != row['commit'] or metadata.get('repository', '').removesuffix('.git') != row['repository']:
            raise RuntimeError('upstream notice supplement differs from the original crate VCS record')
        original = source.source(row, offline, dict(os.environ, PYTHONDONTWRITEBYTECODE='1'))
        return original, row['noticeFiles'], metadata


def copy_notices(component, directory, names, output, entries, lua=False):
    copied = []
    for name in names:
        relative = source.relative(name)
        original = directory / relative
        if not original.is_file() or not original.resolve().is_relative_to(directory.resolve()):
            raise RuntimeError('dependency notice is missing or escapes its source: ' + name)
        data = original.read_bytes()
        if lua:
            text = data.decode('utf-8')
            beginning = text.rfind('/******************************************************************************')
            end = text.find('******************************************************************************/', beginning)
            if beginning < 0 or end < beginning or 'Permission is hereby granted' not in text[beginning:end]:
                raise RuntimeError('the pinned Lua license block was not found')
            data = (text[beginning:end + len('******************************************************************************/')] + '\n').encode()
            relative = Path('LICENSE.txt')
        if not data.strip():
            raise RuntimeError('dependency notice is empty: ' + name)
        destination = output / source.relative(component) / relative
        destination.parent.mkdir(parents=True, exist_ok=True)
        destination.write_bytes(data)
        copied.append({'sourceFile': name, 'file': str(destination.relative_to(output)),
                       'sourceSha256': source.digest(original), 'sha256': source.digest(destination)})
    entries.append({'component': component, 'noticeFiles': copied})


def cargo_source(package, offline):
    filename = package['name'] + '-' + package['version'] + '.crate'
    archives = list((source.CACHE / 'cargo-home/registry/cache').glob('*/' + filename))
    cached = source.CACHE / 'archives' / (package['checksum'] + '.tar.gz')
    if not cached.exists() and archives:
        if any(source.digest(path) != package['checksum'] for path in archives):
            raise RuntimeError('Cargo notice source archive fingerprint mismatch')
        shutil.copy2(archives[0], cached)
    record = {'name': package['name'], 'sha256': package['checksum'],
              'url': 'https://rsproxy.cn/api/v1/crates/' + package['name'] + '/' + package['version'] + '/download'}
    return source.source(record, offline, dict(os.environ, PYTHONDONTWRITEBYTECODE='1'))


def runtime_crates(workspace):
    lock = tomllib.loads((workspace / 'sources/dovi/dolby_vision/Cargo.lock').read_text())
    packages = [row for row in lock['package'] if 'checksum' in row]
    directory = workspace / 'build/dovi/aarch64-unknown-linux-ohos/release/deps'
    selected = []
    for artifact in sorted(directory.glob('lib*.rlib')):
        name = re.fullmatch(r'lib(.+)-[0-9a-f]+\.rlib', artifact.name)
        if not name:
            raise RuntimeError('unrecognized Rust runtime artifact')
        matches = [row for row in packages if row['name'].replace('-', '_') == name.group(1)]
        if len(matches) != 1:
            raise RuntimeError('ambiguous Rust runtime package identity')
        selected.append(matches[0])
    if not selected:
        raise RuntimeError('the compiled Rust runtime package inventory is unavailable')
    return selected


def prepare(artifact, offline=False):
    metadata = json.loads(source.MANIFEST.read_text())
    supplement_file = ROOT / 'docs/native-mpv-notices.json'
    supplements = json.loads(supplement_file.read_text())
    source.validate_manifest(metadata)
    workspace = artifact.parent
    receipt = json.loads((workspace / 'receipt.json').read_text())
    if receipt['sourceManifest'] != metadata or receipt['files'] != source.snapshot(artifact):
        raise RuntimeError('native artifact/source binding does not match the notice inputs')
    if json.loads((workspace / 'source-tree.json').read_text()) != source.snapshot(workspace / 'sources'):
        raise RuntimeError('native source tree changed before notice collection')
    toolchain = runpy.run_path(str(ROOT / 'scripts/deveco-runtime.py'))
    sdk_home = toolchain['resolve_deveco'](empty_is_default=False)['sdkHome']
    sdk = Path(os.environ.get('OHOS_NDK_HOME', sdk_home + '/default/openharmony/native')).resolve()
    existing = ROOT / 'entry/src/main/resources/rawfile/third_party/ass'
    inputs = {'sourceManifest': source.digest(source.MANIFEST), 'supplements': source.digest(supplement_file), 'script': source.digest(Path(__file__)),
              'nativeLibraries': source.snapshot(artifact), 'fontNotices': source.snapshot(existing),
              'sdkNotices': {name: source.digest(sdk / name) for name in ['NOTICE.txt', 'llvm/NOTICE']}}
    fingerprint = hashlib.sha256(json.dumps(inputs, sort_keys=True).encode()).hexdigest()
    output = source.CACHE / 'notices' / fingerprint[:24]
    stamp = output.with_suffix('.json')
    if stamp.exists():
        value = json.loads(stamp.read_text())
        if value['fingerprint'] != fingerprint or value['files'] != source.snapshot(output):
            raise RuntimeError('generated MPV notices were modified')
        print('Verified MPV dependency notices:', output)
        return output
    temporary = output.with_name(output.name + '.collecting')
    if temporary.exists():
        shutil.rmtree(temporary)
    temporary.mkdir(parents=True)
    entries, packages = [], []
    for row in metadata['sources']:
        directory = workspace / 'sources' / row['destination']
        names = list(row['noticeFiles'])
        for folder in directory.iterdir():
            if folder.is_dir() and folder.name.lower() in ['license', 'licenses', 'licence', 'licences']:
                names.extend(str(path.relative_to(directory)) for path in sorted(folder.rglob('*')) if path.is_file())
        copy_notices('sources/' + row['name'], directory, names,
                     temporary, entries, lua=row['name'] == 'lua')
    rust = source.install_rust(metadata, offline, dict(os.environ, PYTHONDONTWRITEBYTECODE='1'))
    copy_notices('rust/toolchain', rust / 'share/doc/rust', ['COPYRIGHT', 'LICENSE-APACHE', 'LICENSE-MIT'], temporary, entries)
    library = rust / 'lib/rustlib/src/rust/library'
    lock = library / 'Cargo.lock'
    if source.digest(lock) != metadata['rust']['stdlibLockSha256']:
        raise RuntimeError('Rust standard-library lock fingerprint mismatch')
    # These include the standard-library source's embedded backtrace/stdarch notices.
    for path in sorted(library.rglob('*')):
        if path.is_file() and re.fullmatch(r'(LICENSE|COPYING|COPYRIGHT|NOTICE)([._-].*)?', path.name, re.I) and path.suffix not in ['.rs', '.py']:
            copy_notices('rust/standard-library-source', library, [str(path.relative_to(library))], temporary, entries)
    for row in runtime_crates(workspace):
        directory = cargo_source(row, offline)
        directory, names, package = package_notices(row, directory, supplements, offline)
        component = 'cargo/runtime/' + row['name'] + '-' + row['version']
        copy_notices(component, directory, names, temporary, entries)
        packages.append({'name': row['name'], 'version': row['version'], 'sha256': row['checksum'],
                         'role': 'Compiled Dolby Vision static-library dependency', 'license': package.get('license', 'see license file')})
    std_packages = tomllib.loads(lock.read_text())['package']
    expected = {(row['name'], row['version']): row['checksum'] for row in std_packages if 'checksum' in row}
    declared = {(row['package'], row['version']): row['sha256'] for row in metadata['rust']['stdlibSources']}
    if declared != expected:
        raise RuntimeError('Rust standard-library source closure differs from its original lock')
    for row in metadata['rust']['stdlibSources']:
        directory = source.source(row, offline, dict(os.environ, PYTHONDONTWRITEBYTECODE='1'))
        directory, names, package = package_notices({'name': row['package'], 'version': row['version']}, directory, supplements, offline)
        component = 'cargo/rust-stdlib/' + row['package'] + '-' + row['version']
        copy_notices(component, directory, names, temporary, entries)
        packages.append({'name': row['package'], 'version': row['version'], 'sha256': row['sha256'],
                         'role': row['role'], 'license': package.get('license', 'see license file')})
    for name in ['NOTICE.txt', 'llvm/NOTICE']:
        copy_notices('sdk', sdk, [name], temporary, entries)
    for row in metadata['patches']:
        copy_notices('patches', ROOT, [row['path']], temporary, entries)
    public = {'schema': 1, 'sourceRecipe': metadata, 'upstreamNoticeSupplements': supplements, 'cargoPackages': packages,
              'sdkNoticeHashes': inputs['sdkNotices'], 'nativeLibraryHashes': inputs['nativeLibraries'],
              'fontNoticeFiles': {'../ass/' + name: checksum for name, checksum in inputs['fontNotices'].items()},
              'components': entries}
    source.write_json(temporary / 'sources.json', public)
    (temporary / 'NOTICE.txt').write_text(
        'CineIsle optional MPV runtime\n\n'
        'Pinned source revisions, archive checksums, local source changes and copied\n'
        'upstream notices are indexed in sources.json. The full source build retains\n'
        'OpenGL/Vulkan, shaderc, AV1, TLS, Lua, LCMS, Dolby Vision, and the shared\n'
        'libass/font stack. Font-stack notices are in the adjacent ass directory.\n\n'
        'Rust runtime notices include compiled Dolby Vision dependencies, the pinned\n'
        'Rust standard-library source, and its complete registry lock closure. That\n'
        'closure also describes build-only and other-platform packages; it is not\n'
        'a claim that all those packages are active on OHOS. SDK-provided notices\n'
        'cover the bundled C++ runtime and compiler support code.\n\n'
        'CineIsle is GPL-3.0-only. Binary redistributions must retain applicable\n'
        'notices and provide complete corresponding source, including the matching\n'
        'project build scripts, dependency archives and patches. This index lists\n'
        'those source inputs; it does not itself contain the source archives.\n')
    temporary.rename(output)
    source.write_json(stamp, {'fingerprint': fingerprint, 'inputs': inputs, 'files': source.snapshot(output)})
    print('Collected MPV dependency notices:', output, 'components:', len(entries), flush=True)
    return output


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--offline', action='store_true')
    options = parser.parse_args()
    source.CACHE.mkdir(parents=True, exist_ok=True)
    with (source.CACHE / 'notices.lock').open('w') as lock:
        fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
        prepare(source.build(offline=True, check=True), options.offline)

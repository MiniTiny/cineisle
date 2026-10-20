#!/usr/bin/env python3
"""Build pinned ASS dependencies with the local OHOS SDK; keep all outputs in .local."""
import argparse
import fcntl
import hashlib
import json
import os
from pathlib import Path
import shutil
import subprocess
import sys
import tarfile

ROOT = Path(__file__).resolve().parents[1]
MANIFEST = ROOT / 'docs/native-ass-sources.json'
CACHE = ROOT / '.local/native-ass'
NAMES = {'meson', 'pkgconf', 'freetype', 'fribidi', 'harfbuzz', 'libass', 'fontconfig', 'expat'}


def digest(path):
    with path.open('rb') as stream:
        return hashlib.file_digest(stream, 'sha256').hexdigest()


def run(args, env):
    subprocess.run([str(arg) for arg in args], env=env, check=True)


def meson_value(value):
    if isinstance(value, list):
        return '[' + ', '.join(meson_value(item) for item in value) + ']'
    value = str(value)
    if any(character in value for character in '\x00\r\n'):
        raise RuntimeError('invalid newline in native tool path')
    # Meson's machine-file parser accepts single-quoted strings, not JSON strings.
    return "'" + value.replace('\\', '\\\\').replace("'", "\\'") + "'"


def files(directory):
    return {str(p.relative_to(directory)): digest(p) for p in sorted(directory.rglob('*'))
            if p.is_file() and p.name != '.source-files.json' and
            not ('__pycache__' in p.parts and p.suffix == '.pyc')}


def activate(prefix):
    CACHE.mkdir(parents=True, exist_ok=True)
    active = CACHE / 'active-prefix.txt'
    expected = str(prefix) + '\n'
    if active.exists() and active.read_text() == expected:
        return
    temporary = CACHE / 'active-prefix.tmp'
    temporary.write_text(expected)
    temporary.replace(active)


def extract(archive, destination):
    # Archives are fingerprinted before extraction. Still reject paths and link escapes.
    destination.mkdir()
    total = 0
    root = None
    with tarfile.open(archive) as source:
        for member in source:
            parts = Path(member.name).parts
            if not parts or Path(member.name).is_absolute() or '..' in parts:
                raise RuntimeError('unsafe source archive path')
            if root is None:
                root = parts[0]
            if parts[0] != root:
                raise RuntimeError('source archive has multiple roots')
            if len(parts) == 1 or not (member.isfile() or member.isdir()):
                continue
            total += member.size
            if total > 1024 * 1024 * 1024:
                raise RuntimeError('source archive exceeds extraction limit')
            member.name = str(Path(*parts[1:]))
            source.extract(member, destination, filter='data')
    (destination / '.source-files.json').write_text(json.dumps(files(destination), sort_keys=True))


def source(record, offline, env):
    checksum = record['sha256']
    if len(checksum) != 64 or any(c not in '0123456789abcdef' for c in checksum):
        raise RuntimeError('missing pinned source fingerprint')
    archive = CACHE / 'archives' / (checksum + '.tar.gz')
    if not archive.exists():
        if offline:
            raise RuntimeError('source archive unavailable offline: ' + record['name'])
        partial = archive.with_suffix('.download')
        run(['curl', '--fail', '--location', '--connect-timeout', '30', '--max-time', '1800',
             '--max-filesize', '100000000', '--output', partial, record['url']], env)
        if digest(partial) != checksum:
            raise RuntimeError('download fingerprint mismatch: ' + record['name'])
        partial.replace(archive)
    if digest(archive) != checksum:
        raise RuntimeError('cached archive fingerprint mismatch: ' + record['name'])
    destination = CACHE / 'sources' / (record['name'] + '-' + checksum[:16])
    if not destination.exists():
        partial = destination.with_name(destination.name + '.extracting')
        if partial.exists():
            shutil.rmtree(partial)
        extract(archive, partial)
        partial.rename(destination)
    expected = json.loads((destination / '.source-files.json').read_text())
    if expected != files(destination):
        raise RuntimeError('extracted source changed: ' + record['name'])
    return destination


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--offline', action='store_true', help='require fingerprinted cached archives')
    parser.add_argument('--check', action='store_true', help='verify the current SDK build without downloading')
    options = parser.parse_args()
    if sys.version_info < (3, 12):
        raise RuntimeError('Python 3.12 or newer is required')
    metadata = json.loads(MANIFEST.read_text())
    records = {record['name']: record for record in metadata['sources']}
    if set(records) != NAMES or len(metadata['sources']) != len(NAMES):
        raise RuntimeError('native source manifest is incomplete')
    sdk_home = os.environ.get('DEVECO_SDK_HOME',
        os.environ.get('DEVECO_CONTENTS', '/Applications/DevEco-Studio.app/Contents') + '/sdk')
    sdk = Path(os.environ.get('OHOS_NDK_HOME', sdk_home + '/default/openharmony/native')).resolve()
    cmake = sdk / 'build-tools/cmake/bin/cmake'
    ninja = sdk / 'build-tools/cmake/bin/ninja'
    clang = sdk / 'llvm/bin/clang'
    env = dict(os.environ)
    env['PYTHONDONTWRITEBYTECODE'] = '1'
    env['PATH'] = str(ninja.parent) + os.pathsep + env.get('PATH', '')
    compiler = subprocess.check_output([str(clang), '--version'], text=True)
    fingerprint = hashlib.sha256((digest(MANIFEST) + digest(Path(__file__)) + str(sdk) + compiler +
        digest(sdk / 'build/cmake/ohos.toolchain.cmake') + digest(sdk / 'oh-uni-package.json')).encode()).hexdigest()
    workspace = CACHE / 'arm64-v8a' / fingerprint[:24]
    prefix = workspace / 'install'
    receipt = workspace / 'receipt.json'
    required = ['lib/libass.a', 'lib/libharfbuzz.a', 'lib/libfreetype.a', 'lib/libfribidi.a',
        'lib/libfontconfig.a', 'lib/libexpat.a', 'include/fontconfig/fontconfig.h',
        'include/ass/ass.h', 'include/harfbuzz/hb.h', 'include/freetype2/ft2build.h']
    if receipt.exists():
        record = json.loads(receipt.read_text())
        if (record['fingerprint'] != fingerprint or record['files'] != files(prefix) or
                any(not (prefix / name).is_file() for name in required)):
            raise RuntimeError('native install changed; inspect its recorded build before reusing it')
        print('Native ASS dependencies verified:', prefix)
    elif options.check:
        raise RuntimeError('native dependencies have not been built for this manifest and SDK')
    else:
        for directory in [CACHE / 'archives', CACHE / 'sources', workspace]:
            directory.mkdir(parents=True, exist_ok=True)
        sources = {name: source(records[name], options.offline, env) for name in sorted(NAMES)}
        build = workspace / 'build'
        host = workspace / 'host'
        meson = [sys.executable, sources['meson'] / 'meson.py']
        # An extracted dependency must not discover the containing product's Git SHA as its version.
        env['GIT_CEILING_DIRECTORIES'] = str(CACHE / 'sources')
        def meson_build(name, args, target_prefix, cross=None):
            directory = build / name
            command = meson + ['setup', directory, sources[name], '--prefix', target_prefix,
                '--libdir=lib', '--buildtype=release', '--default-library=static', '--wrap-mode=nofallback']
            if cross:
                command += ['--cross-file', cross]
            if not (directory / 'build.ninja').exists():
                run(command + args, env)
            run(meson + ['compile', '-C', directory, '-j', '4'], env)
            run(meson + ['install', '-C', directory], env)
        meson_build('pkgconf', ['-Dtests=disabled'], host)
        cross = workspace / 'ohos-arm64.ini'
        target_args = ['--target=aarch64-linux-ohos', '--sysroot=' + str(sdk / 'sysroot'), '-fPIC']
        cross.write_text('[binaries]\n' + '\n'.join(key + ' = ' + meson_value(value) for key, value in {
            'c': clang, 'cpp': sdk / 'llvm/bin/clang++', 'ar': sdk / 'llvm/bin/llvm-ar',
            'strip': sdk / 'llvm/bin/llvm-strip', 'pkg-config': host / 'bin/pkgconf'}.items()) +
            "\n[host_machine]\nsystem = 'linux'\ncpu_family = 'aarch64'\ncpu = 'armv8-a'\nendian = 'little'\n" +
            '[properties]\nneeds_exe_wrapper = true\n[built-in options]\n' +
            '\n'.join(key + ' = ' + meson_value(value) for key, value in {
                'c_args': target_args, 'cpp_args': target_args, 'c_link_args': target_args,
                'cpp_link_args': target_args + ['-static-libstdc++'],
                'pkg_config_path': [str(prefix / 'lib/pkgconfig')]}.items()) + '\n')
        env['PKG_CONFIG_LIBDIR'] = str(prefix / 'lib/pkgconfig')
        run([cmake, '-S', sources['freetype'], '-B', build / 'freetype', '-G', 'Ninja',
            '-DCMAKE_MAKE_PROGRAM=' + str(ninja), '-DCMAKE_TOOLCHAIN_FILE=' + str(sdk / 'build/cmake/ohos.toolchain.cmake'),
            '-DOHOS_ARCH=arm64-v8a', '-DOHOS_PLATFORM_LEVEL=12', '-DCMAKE_INSTALL_PREFIX=' + str(prefix),
            '-DCMAKE_BUILD_TYPE=Release', '-DCMAKE_POSITION_INDEPENDENT_CODE=ON', '-DBUILD_SHARED_LIBS=OFF',
            '-DFT_DISABLE_ZLIB=ON', '-DFT_DISABLE_BZIP2=ON', '-DFT_DISABLE_PNG=ON',
            '-DFT_DISABLE_HARFBUZZ=ON', '-DFT_DISABLE_BROTLI=ON'], env)
        run([cmake, '--build', build / 'freetype', '--parallel', '4'], env)
        run([cmake, '--install', build / 'freetype'], env)
        run([cmake, '-S', sources['expat'] / 'expat', '-B', build / 'expat', '-G', 'Ninja',
            '-DCMAKE_MAKE_PROGRAM=' + str(ninja), '-DCMAKE_TOOLCHAIN_FILE=' + str(sdk / 'build/cmake/ohos.toolchain.cmake'),
            '-DOHOS_ARCH=arm64-v8a', '-DOHOS_PLATFORM_LEVEL=12', '-DCMAKE_INSTALL_PREFIX=' + str(prefix),
            '-DCMAKE_BUILD_TYPE=Release', '-DCMAKE_POSITION_INDEPENDENT_CODE=ON', '-DEXPAT_SHARED_LIBS=OFF',
            '-DEXPAT_BUILD_TESTS=OFF', '-DEXPAT_BUILD_TOOLS=OFF', '-DEXPAT_BUILD_EXAMPLES=OFF',
            '-DEXPAT_BUILD_DOCS=OFF'], env)
        run([cmake, '--build', build / 'expat', '--parallel', '4'], env)
        run([cmake, '--install', build / 'expat'], env)
        if not shutil.which('gperf', path=env['PATH']):
            raise RuntimeError('the host gperf build tool is required for Fontconfig')
        meson_build('fontconfig', ['-Dauto_features=disabled', '-Dxml-backend=expat',
            '-Dtests=disabled', '-Dtests-external-fonts=disabled', '-Dtools=disabled',
            '-Ddoc=disabled', '-Dnls=disabled', '-Dcache-build=disabled',
            '-Ddefault-fonts-dirs=[]', '-Dadditional-fonts-dirs=[]'], prefix, cross)
        meson_build('fribidi', ['-Ddocs=false', '-Dtests=false', '-Dbin=false'], prefix, cross)
        meson_build('harfbuzz', ['-Dauto_features=disabled', '-Dfreetype=enabled', '-Dtests=disabled',
            '-Dutilities=disabled', '-Draster=disabled', '-Dvector=disabled', '-Dgpu=disabled',
            '-Dsubset=disabled'], prefix, cross)
        meson_build('libass', ['-Dtest=disabled', '-Dcompare=disabled', '-Dprofile=disabled',
            '-Dcheckasm=disabled', '-Dfuzz=disabled', '-Dfontconfig=enabled', '-Dcoretext=disabled',
            '-Ddirectwrite=disabled', '-Drequire-system-font-provider=true', '-Dlibunibreak=disabled'], prefix, cross)
        if any(not (prefix / name).is_file() for name in required):
            raise RuntimeError('native dependency build did not install all required outputs')
        receipt.write_text(json.dumps({'fingerprint': fingerprint, 'sources': metadata,
            'sdk': str(sdk), 'compiler': compiler, 'files': files(prefix)}, indent=2))
        print('Native ASS dependencies built:', prefix)
    # Publish only a complete verified prefix. The CMake build resolves this machine-local pointer.
    activate(prefix)


if __name__ == '__main__':
    CACHE.mkdir(parents=True, exist_ok=True)
    with (CACHE / 'build.lock').open('w') as lock:
        fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
        main()

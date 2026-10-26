#!/usr/bin/env python3
"""Build the pinned full MPV source recipe with the local OHOS SDK.

Only project-controlled build commands run. Downloaded installers, rustup,
cargo-install and upstream dependency synchronizers are never executed.
"""
import argparse
import fcntl
import hashlib
import json
import os
import runpy
from pathlib import Path, PurePosixPath
import platform
import re
import shutil
import subprocess
import sys
import tarfile
import time
import tomllib

ROOT = Path(__file__).resolve().parents[1]
MANIFEST = ROOT / 'docs/native-mpv-sources.json'
CACHE = ROOT / '.local/native-mpv/source-build'
COMPONENTS = {'mpv', 'ffmpeg', 'libplacebo', 'mbedtls', 'dav1d', 'lcms', 'shaderc', 'dovi', 'lua',
              'shaderc-glslang', 'shaderc-spirv-headers', 'shaderc-spirv-tools', 'libplacebo-vulkan-headers',
              'mbedtls-framework', 'cbindgen', 'fast_float', 'glad', 'jinja', 'markupsafe'}


def digest(path):
    with Path(path).open('rb') as stream:
        return hashlib.file_digest(stream, 'sha256').hexdigest()


def write_json(path, value):
    path.parent.mkdir(parents=True, exist_ok=True)
    temporary = path.with_name(path.name + '.tmp')
    temporary.write_text(json.dumps(value, indent=2, sort_keys=True) + '\n')
    temporary.replace(path)


def relative(value):
    path = PurePosixPath(value)
    if not value or not path.parts or path.is_absolute() or '..' in path.parts or any(c in value for c in '\x00\r\n\\'):
        raise RuntimeError('unsafe native dependency path')
    return Path(*path.parts)


def validate_manifest(metadata):
    records = metadata.get('sources', [])
    if len(records) != len(COMPONENTS) or {row.get('name') for row in records} != COMPONENTS:
        raise RuntimeError('native MPV source component manifest is incomplete')
    destinations = set()
    for row in records:
        destination = str(relative(row['destination']))
        if destination in destinations or not row.get('noticeFiles'):
            raise RuntimeError('native source destinations or notices are incomplete')
        destinations.add(destination)
        for name in row['noticeFiles']:
            relative(name)
    for row in records + metadata['rust']['packages'] + metadata['rust']['stdlibSources']:
        if not row.get('url', '').startswith('https://') or not re.fullmatch(r'[0-9a-f]{64}', row.get('sha256', '')):
            raise RuntimeError('native source download URL or fingerprint is incomplete')
    if len({row['name'] for row in metadata['ohosImports']}) != len(metadata['ohosImports']):
        raise RuntimeError('duplicate pinned OHOS import declarations')


def snapshot(directory):
    result = {}
    for path in sorted(directory.rglob('*')):
        if path == directory / '.source-files.json':
            continue
        key = str(path.relative_to(directory))
        if path.is_symlink():
            if not path.resolve().is_relative_to(directory.resolve()):
                raise RuntimeError('native source symlink escapes its directory')
            result[key] = {'link': os.readlink(path)}
        elif path.is_file():
            result[key] = digest(path)
    return result


def extract(archive, destination):
    """Strip one archive root; reject traversal, devices and oversized inputs."""
    destination.mkdir()
    root = None
    count = total = 0
    with tarfile.open(archive) as source:
        for member in source:
            count += 1
            path = relative(member.name.rstrip('/'))
            if root is None:
                root = path.parts[0]
            if path.parts[0] != root or count > 200000:
                raise RuntimeError('invalid native source archive roots or member count')
            if len(path.parts) == 1:
                if not member.isdir():
                    raise RuntimeError('native archive root is not a directory')
                continue
            if not (member.isfile() or member.isdir() or member.issym() or member.islnk()):
                raise RuntimeError('unsupported native archive member')
            total += member.size
            if total > 2 * 1024 * 1024 * 1024:
                raise RuntimeError('native source extraction exceeds limit')
            member.name = str(Path(*path.parts[1:]))
            if member.islnk():
                linked = relative(member.linkname)
                if linked.parts[0] != root or len(linked.parts) == 1:
                    raise RuntimeError('invalid source hard link')
                member.linkname = str(Path(*linked.parts[1:]))
            source.extract(member, destination, filter='data')
    write_json(destination / '.source-files.json', snapshot(destination))


def source(record, offline, env):
    checksum = record['sha256']
    if not re.fullmatch(r'[0-9a-f]{64}', checksum):
        raise RuntimeError('invalid pinned native source fingerprint')
    suffix = '.tar.xz' if record['url'].endswith('.tar.xz') else '.tar.gz'
    archive = CACHE / 'archives' / (checksum + suffix)
    archive.parent.mkdir(parents=True, exist_ok=True)
    if not archive.exists():
        if offline:
            raise RuntimeError('pinned native source unavailable offline: ' + record.get('name', record.get('package', '')))
        temporary = archive.with_suffix('.download')
        subprocess.run(['curl', '--fail', '--location', '--connect-timeout', '30', '--max-time', '1800',
                        '--max-filesize', '100000000', '--output', str(temporary), record['url']], env=env, check=True)
        if digest(temporary) != checksum:
            raise RuntimeError('downloaded native source fingerprint mismatch')
        temporary.replace(archive)
    if digest(archive) != checksum:
        raise RuntimeError('cached native source fingerprint mismatch')
    destination = CACHE / 'sources' / checksum
    if not destination.exists():
        destination.parent.mkdir(parents=True, exist_ok=True)
        temporary = destination.with_name(destination.name + '.extracting')
        if temporary.exists():
            shutil.rmtree(temporary)
        extract(archive, temporary)
        temporary.rename(destination)
    expected = json.loads((destination / '.source-files.json').read_text())
    if expected != snapshot(destination):
        raise RuntimeError('cached native source was modified')
    return destination


def meson_value(value):
    if isinstance(value, bool):
        return 'true' if value else 'false'
    if isinstance(value, list):
        return '[' + ', '.join(meson_value(item) for item in value) + ']'
    value = str(value)
    if any(c in value for c in '\x00\r\n'):
        raise RuntimeError('invalid native build path')
    return "'" + value.replace('\\', '\\\\').replace("'", "\\'") + "'"


def assemble(metadata, workspace, offline, env):
    sources = workspace / 'sources'
    stamp = workspace / 'source-tree.json'
    if stamp.exists():
        if json.loads(stamp.read_text()) != snapshot(sources):
            raise RuntimeError('native build source tree was modified')
        return sources
    if sources.exists():
        shutil.rmtree(sources)
    sources.mkdir(parents=True)
    for record in metadata['sources']:
        original = source(record, offline, env)
        destination = sources / relative(record['destination'])
        if destination.exists() and any(destination.iterdir()):
            raise RuntimeError('overlapping native source destinations')
        shutil.copytree(original, destination, dirs_exist_ok=True, symlinks=True,
                        ignore=shutil.ignore_patterns('.source-files.json'))
    for patch in metadata['patches']:
        path = ROOT / relative(patch['path'])
        if digest(path) != patch['sha256']:
            raise RuntimeError('native source patch fingerprint mismatch')
        directory = sources / relative(patch['component'])
        for dry in [True, False]:
            args = ['patch', '--batch', '--fuzz=0'] + (['--dry-run'] if dry else [])
            subprocess.run(args + ['-p1', '-i', str(path)], cwd=directory, env=env, check=True)
    write_json(stamp, snapshot(sources))
    return sources


def install_rust(metadata, offline, env):
    identity = hashlib.sha256(json.dumps(metadata['rust'], sort_keys=True).encode()).hexdigest()[:24]
    prefix = CACHE / 'tools' / identity
    receipt = prefix.parent / (identity + '.json')
    if receipt.exists():
        if json.loads(receipt.read_text()) != snapshot(prefix):
            raise RuntimeError('private Rust toolchain was modified')
        return prefix
    if prefix.exists():
        shutil.rmtree(prefix)
    prefix.mkdir(parents=True)
    for record in metadata['rust']['packages']:
        original = source(record, offline, env) / relative(record['component'])
        for line in (original / 'manifest.in').read_text().splitlines():
            kind, value = line.split(':', 1)
            path = relative(value)
            src, dst = original / path, prefix / path
            dst.parent.mkdir(parents=True, exist_ok=True)
            if kind == 'dir':
                shutil.copytree(src, dst, dirs_exist_ok=True, symlinks=True)
            elif kind == 'file':
                if dst.exists() and digest(dst) != digest(src):
                    raise RuntimeError('conflicting Rust component files')
                shutil.copy2(src, dst, follow_symlinks=False)
            else:
                raise RuntimeError('unsupported Rust component manifest entry')
    write_json(receipt, snapshot(prefix))
    return prefix


def verify_cargo_archives(sources, cargo_home):
    verified = []
    for name in ['dovi/dolby_vision', 'cbindgen']:
        lock = sources / name / 'Cargo.lock'
        for package in tomllib.loads(lock.read_text())['package']:
            if 'source' not in package:
                continue
            if package['source'] != 'registry+https://github.com/rust-lang/crates.io-index':
                raise RuntimeError('unreviewed Cargo dependency source')
            filename = package['name'] + '-' + package['version'] + '.crate'
            archives = list((cargo_home / 'registry/cache').glob('*/' + filename))
            if not archives or any(digest(path) != package['checksum'] for path in archives):
                raise RuntimeError('locked Cargo archive fingerprint mismatch: ' + filename)
            verified.append({'name': package['name'], 'version': package['version'], 'sha256': package['checksum']})
    return verified


class Build:
    def __init__(self, metadata, workspace, sdk, ass, offline):
        self.metadata, self.workspace, self.sdk, self.ass = metadata, workspace, sdk, ass
        self.prefix, self.build = workspace / 'install', workspace / 'build'
        self.env = dict(os.environ)
        self.env.update(PYTHONDONTWRITEBYTECODE='1', SOURCE_DATE_EPOCH=str(metadata['sourceDateEpoch']),
                        GIT_CEILING_DIRECTORIES=str(workspace / 'sources'))
        self.sources = assemble(metadata, workspace, offline, self.env)
        rust = install_rust(metadata, offline, self.env)
        self.rust = rust / 'bin'
        self.clang = sdk / 'llvm/bin/clang'
        self.cmake = sdk / 'build-tools/cmake/bin/cmake'
        self.pkgconf = ass.parent / 'host/bin/pkgconf'
        ass_metadata = json.loads((ROOT / 'docs/native-ass-sources.json').read_text())
        meson = next(row for row in ass_metadata['sources'] if row['name'] == 'meson')
        self.meson_command = [sys.executable, ROOT / ('.local/native-ass/sources/meson-' + meson['sha256'][:16]) / 'meson.py']
        if not self.meson_command[1].is_file() or not self.pkgconf.is_file():
            raise RuntimeError('verified native ASS build tools are unavailable')
        for path in [self.prefix / 'lib/pkgconfig', self.prefix / 'include', self.build]:
            path.mkdir(parents=True, exist_ok=True)
        pc = [str(self.prefix / 'lib/pkgconfig'), str(ass / 'lib/pkgconfig')]
        self.env.update(PATH=os.pathsep.join([str(self.rust), str(Path(sys.executable).parent), str(self.cmake.parent), str(self.pkgconf.parent), self.env.get('PATH', '')]),
                        PKG_CONFIG_LIBDIR=os.pathsep.join(pc), PKG_CONFIG_PATH=os.pathsep.join(pc),
                        CARGO_HOME=str(CACHE / 'cargo-home'), RUSTC=str(self.rust / 'rustc'),
                        CARGO_NET_OFFLINE='true' if offline else 'false')
        self.target = ['--target=aarch64-linux-ohos', '--sysroot=' + str(sdk / 'sysroot'), '-fPIC', '-D__MUSL__=1', '-D__OHOS_API__=15']
        self.links = self.target + ['-Wl,--no-as-needed', '-lc++_shared', '-Wl,--as-needed']
        self.cross = workspace / 'ohos-api15.ini'
        sections = {'binaries': {'c': self.clang, 'cpp': sdk / 'llvm/bin/clang++', 'ar': sdk / 'llvm/bin/llvm-ar',
                                'strip': sdk / 'llvm/bin/llvm-strip', 'pkg-config': self.pkgconf},
                    'host_machine': {'system': 'linux', 'cpu_family': 'aarch64', 'cpu': 'armv8-a', 'endian': 'little'},
                    'properties': {'needs_exe_wrapper': True},
                    'built-in options': {'c_args': self.target, 'cpp_args': self.target, 'c_link_args': self.links,
                                         'cpp_link_args': self.target + ['-lc++_shared'], 'pkg_config_path': pc}}
        self.cross.write_text('\n\n'.join('[' + section + ']\n' + '\n'.join(key + ' = ' + meson_value(value)
                              for key, value in values.items()) for section, values in sections.items()) + '\n')

    def run(self, args, cwd=None, extra_env=None):
        args = [str(arg) for arg in args]
        entry = {'argv': args, 'cwd': str(cwd or self.workspace), 'started': time.time()}
        with (self.workspace / 'commands.jsonl').open('a') as log:
            log.write(json.dumps(entry) + '\n')
        print('Building:', args[0], ' '.join(args[1:4]), flush=True)
        subprocess.run(args, cwd=cwd or self.workspace, env=self.env | (extra_env or {}), check=True)

    def meson(self, name, options, shared=False):
        directory = self.build / name
        reconfigure = ['--reconfigure', '--clearcache'] if (directory / 'build.ninja').exists() else []
        self.run(self.meson_command + ['setup'] + reconfigure + [directory, self.sources / name, '--prefix', self.prefix,
                 '--libdir=lib', '--cross-file', self.cross, '--buildtype=release', '--wrap-mode=nofallback',
                 '--default-library=' + ('shared' if shared else 'static'), '-Dauto_features=disabled',
                 '-Dc_link_args=' + meson_value(self.links)] + options)
        self.run(self.meson_command + ['compile', '-C', directory, '-j', '4'])
        self.run(self.meson_command + ['install', '-C', directory])

    def cmake_build(self, name, options):
        directory = self.build / name
        self.run([self.cmake, '-S', self.sources / name, '-B', directory, '-G', 'Ninja',
                  '-DCMAKE_MAKE_PROGRAM=' + str(self.cmake.parent / 'ninja'),
                  '-DCMAKE_TOOLCHAIN_FILE=' + str(self.sdk / 'build/cmake/ohos.toolchain.cmake'),
                  '-DOHOS_ARCH=arm64-v8a', '-DOHOS_PLATFORM=OHOS', '-DOHOS_PLATFORM_LEVEL=15', '-DOHOS_STL=c++_shared',
                  '-DCMAKE_BUILD_TYPE=Release', '-DCMAKE_POSITION_INDEPENDENT_CODE=ON',
                  '-DCMAKE_INSTALL_PREFIX=' + str(self.prefix), '-DCMAKE_INSTALL_LIBDIR=lib',
                  '-DFETCHCONTENT_FULLY_DISCONNECTED=ON'] + options)
        self.run([self.cmake, '--build', directory, '--parallel', '4'])
        self.run([self.cmake, '--install', directory])

    def pc(self, name, text):
        (self.prefix / ('lib/pkgconfig/' + name + '.pc')).write_text(text)

    def rust_build(self, offline):
        cargo_home = CACHE / 'cargo-home'
        cargo_home.mkdir(exist_ok=True)
        mirror = self.metadata['cargoRegistry']['mirror']
        (cargo_home / 'config.toml').write_text('[source.crates-io]\nreplace-with = "rsproxy"\n[source.rsproxy]\nregistry = ' + json.dumps(mirror) + '\n')
        cargo = self.rust / 'cargo'
        for name in ['dovi/dolby_vision', 'cbindgen']:
            self.run([cargo, 'fetch', '--locked'] + (['--offline'] if offline else []) +
                     ['--manifest-path', self.sources / name / 'Cargo.toml'])
        write_json(self.workspace / 'cargo-archives.json', verify_cargo_archives(self.sources, cargo_home))
        self.run([cargo, 'build', '--frozen', '--release', '--bin', 'cbindgen', '--manifest-path',
                  self.sources / 'cbindgen/Cargo.toml', '--target-dir', self.build / 'cbindgen', '-j', '4'])
        dovi = self.sources / 'dovi/dolby_vision'
        self.run([cargo, 'rustc', '--frozen', '--release', '--lib', '--features', 'capi', '--target', 'aarch64-unknown-linux-ohos',
                  '--manifest-path', dovi / 'Cargo.toml', '--target-dir', self.build / 'dovi', '-j', '4',
                  '--crate-type', 'staticlib', '--', '-Cpanic=abort', '--print=native-static-libs'],
                 extra_env={'CARGO_TARGET_AARCH64_UNKNOWN_LINUX_OHOS_LINKER': str(self.clang),
                            'CARGO_TARGET_AARCH64_UNKNOWN_LINUX_OHOS_RUSTFLAGS': '-Crelocation-model=pic -Cpanic=abort'})
        shutil.copy2(self.build / 'dovi/aarch64-unknown-linux-ohos/release/libdolby_vision.a', self.prefix / 'lib/libdovi.a')
        headers = self.prefix / 'include/libdovi'
        headers.mkdir(exist_ok=True)
        self.run([self.build / 'cbindgen/release/cbindgen', '--config', dovi / 'cbindgen.toml', '--crate', 'dolby_vision',
                  '--output', headers / 'rpu_parser.h', dovi])
        self.pc('dovi', 'prefix=' + str(self.prefix) + '\nlibdir=${prefix}/lib\nincludedir=${prefix}/include\n'
                'Name: dovi\nDescription: Dolby Vision metadata C API\nVersion: 3.3.2\n'
                'Libs: -L${libdir} -ldovi\nLibs.private: -lunwind -lc\nCflags: -I${includedir}\n')
        self.rust_prefix = self.rust.parent

    def media_build(self):
        directory = self.build / 'ffmpeg'
        directory.mkdir(exist_ok=True)
        args = [self.sources / 'ffmpeg/configure', '--prefix=' + str(self.prefix), '--arch=aarch64', '--cpu=armv8-a',
                '--target-os=linux', '--enable-cross-compile', '--cc=' + str(self.clang), '--cxx=' + str(self.sdk / 'llvm/bin/clang++'),
                '--ar=' + str(self.sdk / 'llvm/bin/llvm-ar'), '--ranlib=' + str(self.sdk / 'llvm/bin/llvm-ranlib'),
                '--nm=' + str(self.sdk / 'llvm/bin/llvm-nm'), '--strip=' + str(self.sdk / 'llvm/bin/llvm-strip'),
                '--pkg-config=' + str(self.pkgconf), '--pkg-config-flags=--static',
                '--extra-cflags=' + ' '.join(self.target + ['-I' + str(self.prefix / 'include')]),
                '--extra-ldflags=' + ' '.join(self.target + ['-L' + str(self.prefix / 'lib')]),
                '--disable-autodetect', '--enable-static', '--disable-shared', '--enable-version3', '--enable-pic',
                '--disable-doc', '--disable-programs', '--disable-debug', '--enable-libdav1d', '--enable-mbedtls',
                '--enable-zlib', '--enable-iconv', '--enable-v4l2-m2m', '--disable-vulkan', '--disable-avdevice',
                '--disable-devices', '--disable-muxers', '--disable-encoders', '--enable-encoder=png,mjpeg', '--enable-ohcodec']
        if not (directory / 'ffbuild/config.mak').exists():
            self.run(args, directory)
        self.run(['make', '-j4'], directory)
        self.run(['make', 'install'], directory)
        lua = self.sources / 'lua/src'
        objects = []
        (self.build / 'lua').mkdir(exist_ok=True)
        for file in sorted(lua.glob('*.c')):
            if file.name in ['lua.c', 'luac.c']:
                continue
            obj = self.build / 'lua' / (file.stem + '.o')
            self.run([self.clang] + self.target + ['-O2', '-DLUA_USE_POSIX', '-DLUA_USE_DLOPEN', '-c', file, '-o', obj])
            objects.append(obj)
        self.run([self.sdk / 'llvm/bin/llvm-ar', 'rcs', self.prefix / 'lib/liblua5.2.a'] + objects)
        include = self.prefix / 'include/lua5.2'
        include.mkdir(exist_ok=True)
        for name in ['lua.h', 'luaconf.h', 'lualib.h', 'lauxlib.h']:
            shutil.copy2(lua / name, include / name)
        self.pc('lua', 'prefix=' + str(self.prefix) + '\nlibdir=${prefix}/lib\nincludedir=${prefix}/include/lua5.2\n'
                'Name: Lua\nDescription: Lua 5.2.4 runtime\nVersion: 5.2.4\nLibs: -L${libdir} -llua5.2 -lm -ldl\nCflags: -I${includedir}\n')

    def compile(self, offline):
        self.cmake_build('mbedtls', ['-DENABLE_PROGRAMS=OFF', '-DENABLE_TESTING=OFF', '-DGEN_FILES=OFF',
                         '-DUSE_SHARED_MBEDTLS_LIBRARY=OFF', '-DUSE_STATIC_MBEDTLS_LIBRARY=ON',
                         '-DDISABLE_PACKAGE_CONFIG_AND_INSTALL=OFF', '-DMBEDTLS_FATAL_WARNINGS=OFF'])
        self.meson('dav1d', ['-Denable_tools=false', '-Denable_tests=false', '-Denable_examples=false', '-Denable_docs=false'])
        self.meson('lcms', ['-Dtests=disabled', '-Dutils=false', '-Dfastfloat=false', '-Dthreaded=false'])
        self.cmake_build('shaderc', ['-DSHADERC_SKIP_TESTS=ON', '-DSHADERC_SKIP_EXAMPLES=ON', '-DSHADERC_SKIP_EXECUTABLES=ON',
                         '-DSHADERC_SKIP_COPYRIGHT_CHECK=ON', '-DSHADERC_ENABLE_WERROR_COMPILE=OFF', '-DBUILD_SHARED_LIBS=OFF',
                         '-DSPIRV_SKIP_TESTS=ON', '-DSPIRV_SKIP_EXECUTABLES=ON', '-DENABLE_GLSLANG_BINARIES=OFF'])
        pc = self.prefix / 'lib/pkgconfig'
        shutil.copy2(pc / 'shaderc.pc', pc / 'shaderc_shared.pc')
        shutil.copy2(pc / 'shaderc_combined.pc', pc / 'shaderc.pc')
        self.rust_build(offline)
        self.media_build()
        # libplacebo uses its fixed 1.4 generator registry internally. MPV needs
        # the SDK's OHOS native-buffer extension in addition to standard Vulkan.
        for name, header, macro, library in [('vulkan', 'vulkan/vulkan_core.h', 'VK_HEADER_VERSION', 'vulkan'),
                                              ('zlib', 'zlib.h', 'ZLIB_VERSION', 'z')]:
            text = (self.sdk / 'sysroot/usr/include' / header).read_text()
            value = re.search(r'^#define ' + macro + r' "?([^"\s]+)', text, re.M).group(1)
            version = '1.4.' + value if name == 'vulkan' else value
            self.pc(name, 'includedir=' + str(self.sdk / 'sysroot/usr/include') + '\nlibdir=' +
                    str(self.sdk / 'sysroot/usr/lib/aarch64-linux-ohos') + '\nName: ' + name +
                    '\nDescription: OHOS SDK development interface\nVersion: ' + version +
                    '\nLibs: -L${libdir} -l' + library + '\nCflags: -I${includedir}\n')
        self.meson('libplacebo', ['-Dopengl=enabled', '-Dgl-proc-addr=enabled', '-Dvulkan=enabled', '-Dvk-proc-addr=enabled',
                   '-Dshaderc=enabled', '-Dlcms=enabled', '-Ddovi=enabled', '-Dlibdovi=enabled',
                   '-Ddemos=false', '-Dtests=false', '-Dprefer_static=true'])
        self.meson('mpv', ['-Dohos=enabled', '-Degl-ohos=enabled', '-Dgl=enabled', '-Dvulkan=enabled', '-Dshaderc=enabled',
                   '-Dcplugins=enabled', '-Diconv=enabled', '-Dlcms2=enabled', '-Dvector=enabled', '-Dzlib=enabled',
                   '-Dopensles=disabled', '-Dgpl=false', '-Dcplayer=false', '-Dlibmpv=true', '-Dbuild-date=false',
                   '-Dlua=lua', '-Dmanpage-build=disabled', '-Dprefer_static=true', '-Db_lundef=true'], shared=True)


def sdk_runtime(sdk):
    paths = []
    for path in sorted(sdk.rglob('libc++_shared.so')):
        header = path.read_bytes()[:20]
        if header[:6] == b'\x7fELF\x02\x01' and int.from_bytes(header[18:20], 'little') == 183:
            paths.append(path)
    if not paths or len({digest(path) for path in paths}) != 1:
        raise RuntimeError('SDK must provide one unambiguous AArch64 C++ shared runtime')
    return paths[0]


def verify_library(path, metadata, sdk):
    header = path.read_bytes()[:20]
    if header[:6] != b'\x7fELF\x02\x01' or int.from_bytes(header[18:20], 'little') != 183:
        raise RuntimeError('MPV source build did not produce little-endian AArch64 ELF')
    strings = subprocess.check_output([str(sdk / 'llvm/bin/llvm-strings'), str(path)], text=True)
    features = [line.split(': ', 1)[1].split() for line in strings.splitlines() if line.startswith('List of enabled features: ')]
    if len(features) != 1 or set(features[0]) != set(metadata['expectedFeatures']):
        raise RuntimeError('native source build feature set changed')
    symbols = subprocess.check_output([str(sdk / 'llvm/bin/llvm-readelf'), '--dyn-syms', '--wide', str(path)], text=True)
    imports = set(re.findall(r'\bUND\s+(OH_\w+)', symbols))
    expected = {row['name'] for row in metadata['ohosImports']}
    if imports != expected or max(row['introduced'] for row in metadata['ohosImports']) > metadata['minimumApi']:
        raise RuntimeError('native OH import set or SDK API floor changed')
    return {'features': sorted(features[0]), 'ohosImportCount': len(imports),
            'finiteSdkDeclarationMaximumApi': max(row['introduced'] for row in metadata['ohosImports']),
            'physicalDeviceCompatibilityVerified': False}


def build(offline=False, check=False):
    if sys.version_info < (3, 12):
        raise RuntimeError('Python 3.12 or newer is required')
    if (platform.system(), platform.machine()) != ('Darwin', 'arm64'):
        raise RuntimeError('the pinned source host toolchain currently requires macOS arm64')
    metadata = json.loads(MANIFEST.read_text())
    validate_manifest(metadata)
    if metadata['schema'] != 1 or metadata['abi'] != 'arm64-v8a' or metadata['minimumApi'] != 15:
        raise RuntimeError('unsupported native MPV source manifest target')
    if digest(ROOT / 'entry/src/main/cpp/mpv/include/mpv/client.h') != metadata['clientHeaderSha256']:
        raise RuntimeError('native MPV client header fingerprint mismatch')
    if digest(ROOT / 'docs/native-ass-sources.json') != metadata['nativeAssManifestSha256']:
        raise RuntimeError('native MPV font dependency source manifest changed')
    toolchain = runpy.run_path(str(ROOT / 'scripts/deveco-runtime.py'))
    sdk_home = toolchain['resolve_deveco'](empty_is_default=False)['sdkHome']
    sdk = Path(os.environ.get('OHOS_NDK_HOME', sdk_home + '/default/openharmony/native')).resolve()
    for name, checksum in metadata['sdkHeaders'].items():
        if digest(sdk / 'sysroot/usr/include' / relative(name)) != checksum:
            raise RuntimeError('SDK native declaration interface differs from the pinned source recipe')
    for row in metadata['ohosImports']:
        if row['name'] not in (sdk / 'sysroot/usr/include' / row['header']).read_text().splitlines()[row['line'] - 1]:
            raise RuntimeError('pinned SDK declaration location changed')
    runtime = sdk_runtime(sdk)
    subprocess.run([sys.executable, str(ROOT / 'scripts/prepare-native-ass.py'), '--check', '--offline'], check=True)
    ass = Path((ROOT / '.local/native-ass/active-prefix.txt').read_text().strip())
    recipe = {'manifest': digest(MANIFEST), 'script': digest(Path(__file__)), 'root': str(ROOT), 'sdk': str(sdk),
              'compiler': digest(sdk / 'llvm/bin/clang'), 'sdkPackage': digest(sdk / 'oh-uni-package.json'),
              'toolchain': digest(sdk / 'build/cmake/ohos.toolchain.cmake'), 'cppRuntime': digest(runtime),
              'assReceipt': digest(ass.parent / 'receipt.json'),
              'patches': {row['path']: digest(ROOT / row['path']) for row in metadata['patches']}}
    if any(recipe['patches'][row['path']] != row['sha256'] for row in metadata['patches']):
        raise RuntimeError('native MPV patch fingerprint mismatch')
    fingerprint = hashlib.sha256(json.dumps(recipe, sort_keys=True).encode()).hexdigest()
    workspace = CACHE / 'arm64-v8a' / fingerprint[:24]
    artifact = workspace / 'artifact'
    receipt = workspace / 'receipt.json'
    if receipt.exists():
        value = json.loads(receipt.read_text())
        if value['fingerprint'] != fingerprint or value['files'] != snapshot(artifact):
            raise RuntimeError('built native MPV artifact changed')
        print('Verified full-source MPV artifact:', artifact)
        return artifact
    if check:
        raise RuntimeError('full-source MPV has not been built for this recipe and SDK')
    workspace.mkdir(parents=True, exist_ok=True)
    builder = Build(metadata, workspace, sdk, ass, offline)
    builder.compile(offline)
    artifact.mkdir(exist_ok=True)
    compiled = builder.prefix / 'lib/libmpv.so'
    evidence = verify_library(compiled, metadata, sdk)
    subprocess.run([str(sdk / 'llvm/bin/llvm-strip'), '--strip-all', '-o', str(artifact / 'libmpv.so'), str(compiled)], check=True)
    shutil.copy2(runtime, artifact / 'libc++_shared.so')
    if json.loads((workspace / 'source-tree.json').read_text()) != snapshot(builder.sources):
        raise RuntimeError('source build modified its pinned input tree')
    write_json(receipt, {'fingerprint': fingerprint, 'recipe': recipe, 'evidence': evidence,
                        'files': snapshot(artifact), 'sourceManifest': metadata,
                        'installerHooksExecuted': False, 'nativePlaybackAcceptance': 'separate required gate'})
    print('Built full-source MPV artifact:', artifact)
    return artifact


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--offline', action='store_true', help='use only fingerprinted cached archives and locked Cargo packages')
    parser.add_argument('--check', action='store_true', help='verify an existing build without downloading or rebuilding')
    options = parser.parse_args()
    CACHE.mkdir(parents=True, exist_ok=True)
    with (CACHE / 'build.lock').open('w') as lock:
        fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
        build(options.offline, options.check)

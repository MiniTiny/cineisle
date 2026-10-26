"""Real source/extract functions with explicit curl/tar boundary fixtures; no large payloads."""
import errno
import hashlib
import importlib.util
import io
import json
import os
from pathlib import Path
import subprocess
import sys
import tarfile
import tempfile

ROOT = Path(__file__).resolve().parents[1]
_REAL_RUN, _REAL_TAR_OPEN, _REAL_WRITE_TEXT = subprocess.run, tarfile.open, Path.write_text


class FixtureFailure(Exception):
    def __init__(self, phase, cause):
        super().__init__('Source fixture ' + phase + ' failed')
        self.phase, self.cause = phase, cause


def code(error):
    return 'ERR_ASSERTION' if isinstance(error, AssertionError) else errno.errorcode.get(getattr(error, 'errno', None), type(error).__name__)


def native_cause_code(error):
    cause = error.__cause__
    if cause is None:
        return None
    while cause.__cause__ is not None:
        cause = cause.__cause__
    return code(cause)


class Tracker:
    def __init__(self, scope, fault):
        self.scope, self.fault = scope, fault
        self.calls, self.events, self.errors, self.states = {}, [], [], {}
        self.published = False

    def call(self, phase, operation, details=None):
        self.calls[phase] = self.calls.get(phase, 0) + 1
        self.events.append(phase)
        details = details or {}
        def snapshot(error):
            return dict(version=1, scope=self.scope, phase=phase, injected=getattr(error, 'contract_injected', False), calls=dict(self.calls), nativeCauseCode=native_cause_code(error), **details)
        if self.fault == phase:
            error = OSError(errno.EIO, 'injected ' + phase + ' external failure')
            error.contract_injected = True
            self.states[id(error)] = snapshot(error)
            self.errors.append(error)
            raise error
        try:
            return operation()
        except Exception as error:
            if id(error) not in self.states:
                self.states[id(error)] = snapshot(error)
                self.errors.append(error)
            raise

    def healthy(self):
        if self.errors:
            if not self.published:
                print('CONTRACT_EXTERNAL_STATE ' + json.dumps(self.states[id(self.errors[0])]), file=sys.stderr)
                self.published = True
            raise FixtureFailure(self.scope + '-external', self.errors[0])


def native_failure(phase, operation):
    try:
        return operation()
    except Exception as cause:
        if '--native-' + phase + '-init-failure' not in sys.argv:
            raise
        error = OSError(errno.EIO, 'native ' + phase + ' API failure')
        error.contract_injected = True
        raise error from cause


class DeclaredTarFailure:
    def __init__(self, error):
        self.error = error


class Archive:
    def __init__(self, owner, base=None, members=None):
        self.owner, self.base, self.members = owner, base, members

    def __enter__(self):
        return self

    def __exit__(self, *args):
        if self.base:
            self.base.close()

    def __iter__(self):
        return iter(self.base if self.base is not None else self.members)

    def extract(self, member, destination, **kwargs):
        owner = self.owner
        def body():
            owner.extracted.append((member.name, member.size, kwargs.get('filter')))
            if self.base is not None:
                target = destination
                if '--native-member-extract-init-failure' in sys.argv:
                    target = owner.directory / 'blocked-extract-target'
                    target.write_bytes(b'not a directory')
                try:
                    return native_failure('member-extract', lambda: self.base.extract(member, target, **kwargs))
                except tarfile.FilterError as error:
                    if owner.expected_tar_filter_error:
                        return DeclaredTarFailure(error)
                    raise
            # Synthetic TarInfo sizes exercise only the production metadata budget.
            # This stand-in does not claim to allocate/extract a GiB payload.
            target = Path(destination) / member.name
            if member.isdir():
                target.mkdir(parents=True, exist_ok=True)
            else:
                target.parent.mkdir(parents=True, exist_ok=True)
                target.write_bytes(b'explicit metadata-only payload fixture')
        result = owner.tracker.call('member-extract', body, {'member': member.name})
        if isinstance(result, DeclaredTarFailure):
            raise result.error
        return result


def member(name, size=0, kind=tarfile.REGTYPE):
    value = tarfile.TarInfo(name)
    value.size, value.type = size, kind
    return value


class SourceFixture:
    def __init__(self, scope='ass-source', script='prepare-native-ass.py'):
        self.tracker = Tracker(scope, next((a[8:] for a in sys.argv if a.startswith('--fault=')), ''))
        self.temp = tempfile.TemporaryDirectory(prefix='cineisle-source-')
        self.directory = Path(self.temp.name)
        self.cache = self.directory / 'cache'
        (self.cache / 'archives').mkdir(parents=True)
        (self.cache / 'sources').mkdir()
        self.bin = self.directory / 'bin'
        self.bin.mkdir()
        self.capture = self.directory / 'curl-argv.json'
        self.payload = self.directory / 'payload.tar.gz'
        with _REAL_TAR_OPEN(self.payload, 'w:gz') as archive:
            root = member('package', kind=tarfile.DIRTYPE)
            archive.addfile(root)
            value = member('package/file.txt', len(b'actual small source fixture'))
            archive.addfile(value, io.BytesIO(b'actual small source fixture'))
        self.payload_hash = hashlib.sha256(self.payload.read_bytes()).hexdigest()
        self.record = {'name': 'libass' if script == 'prepare-native-ass.py' else 'mpv', 'sha256': self.payload_hash, 'url': 'https://fixture.invalid/source.tar.gz'}
        self.environment = {**os.environ, 'PATH': str(self.bin), 'CINEISLE_TEST_CURL_PAYLOAD': str(self.payload), 'CINEISLE_TEST_CURL_CAPTURE': str(self.capture)}
        self.curl = self.bin / 'curl'
        self.curl.write_text('#!' + sys.executable + '\nimport os, sys, json\nfrom pathlib import Path\nargs=sys.argv[1:]\nPath(os.environ["CINEISLE_TEST_CURL_CAPTURE"]).write_text(json.dumps(args))\nPath(args[args.index("--output")+1]).write_bytes(Path(os.environ["CINEISLE_TEST_CURL_PAYLOAD"]).read_bytes())\n')
        self.curl.chmod(0o755)
        self.script, self.module = script, None
        self.synthetic, self.extracted, self.argv, self.hashes = None, [], [], []
        self.manifests, self.expected_tar_filter_error = [], False
        if '--fault=setup' in sys.argv:
            raise AssertionError('unrelated source preparation fixture setup')

    def load(self):
        def body():
            target = ROOT / 'scripts' / self.script
            if '--native-source-load-init-failure' in sys.argv:
                target = self.directory / 'missing-source-script.py'
            spec = importlib.util.spec_from_file_location('source_fixture_product', target)
            module = importlib.util.module_from_spec(spec)
            # Always compile the current file; same-size probe mutations must not reuse pyc.
            def execute_current():
                source = spec.loader.get_source(spec.name)
                exec(compile(source, str(target), 'exec'), module.__dict__)
            native_failure('source-load', execute_current)
            module.CACHE = self.cache
            digest = module.digest
            def hashing(path):
                self.hashes.append(Path(path).name)
                return self.tracker.call('hash-read', lambda: digest(path))
            module.digest = hashing
            return module
        self.module = self.tracker.call('source-load', body)
        return self.module

    def install(self):
        def curl_run(args, **kwargs):
            def body():
                self.argv.append({'args': list(args), 'check': kwargs.get('check'), 'environment': kwargs.get('env') is self.environment})
                if '--native-curl-run-init-failure' in sys.argv:
                    self.curl.chmod(0o644)
                return native_failure('curl-run', lambda: _REAL_RUN(args, **kwargs))
            return self.tracker.call('curl-run', body)
        def opening(path, *args, **kwargs):
            def body():
                if self.synthetic is not None:
                    return Archive(self, members=self.synthetic)
                target = self.directory if '--native-tar-open-init-failure' in sys.argv else path
                base = native_failure('tar-open', lambda: _REAL_TAR_OPEN(target, *args, **kwargs))
                return Archive(self, base=base)
            return self.tracker.call('tar-open', body)
        def write_text(path, *args, **kwargs):
            if path.name not in ('.source-files.json', '.source-files.json.tmp'):
                return _REAL_WRITE_TEXT(path, *args, **kwargs)
            def body():
                self.manifests.append(path.name)
                target = path.parent if '--native-manifest-write-init-failure' in sys.argv else path
                return native_failure('manifest-write', lambda: _REAL_WRITE_TEXT(target, *args, **kwargs))
            return self.tracker.call('manifest-write', body, {'filename': path.name})
        subprocess.run, tarfile.open, Path.write_text = curl_run, opening, write_text

    def begin(self):
        self.tracker.call('entry', lambda: None)
        module = self.load()
        self.install()
        return module

    def source(self, offline=False):
        return self.module.source(self.record, offline, self.environment)

    def archive_path(self):
        suffix = '.tar.xz' if self.script == 'build-native-mpv.py' and self.record['url'].endswith('.tar.xz') else '.tar.gz'
        return self.cache / 'archives' / (self.record['sha256'] + suffix)

    def snapshot(self):
        return {'calls': dict(self.tracker.calls), 'events': list(self.tracker.events), 'extracted': list(self.extracted), 'argv': list(self.argv), 'hashes': list(self.hashes), 'manifests': list(self.manifests), 'capture': json.loads(self.capture.read_text()) if self.capture.exists() else None}

    def close(self):
        subprocess.run, tarfile.open, Path.write_text = _REAL_RUN, _REAL_TAR_OPEN, _REAL_WRITE_TEXT
        self.temp.cleanup()


def expect(condition, message='contract mismatch'):
    assert condition, message


def run(cases, scope='ass-source', script='prepare-native-ass.py'):
    selected = sys.argv[1] if len(sys.argv) > 1 else None
    chosen = [case for case in cases if selected is None or case[0] == selected]
    assert chosen, 'No selected source preparation cases'
    for name, action in chosen:
        fixture = None
        failure, phase, boundary = None, None, None
        try:
            try:
                fixture = SourceFixture(scope, script)
            except Exception as error:
                raise FixtureFailure('setup', error) from error
            deferred, action_error = None, None
            try:
                deferred = action(fixture)
            except Exception as error:
                action_error = error
            fixture.tracker.healthy()
            if action_error:
                raise action_error
            assert callable(deferred), 'No contract boundary reached'
            try:
                deferred()
            except AssertionError as error:
                boundary = name
                raise error
            fixture.tracker.healthy()
        except Exception as error:
            failure = error
            phase = 'fixture' if isinstance(error, FixtureFailure) else 'expectation'
        finally:
            if fixture:
                try:
                    fixture.close()
                except Exception as error:
                    failure, phase, boundary = FixtureFailure('cleanup', error), 'fixture', None
        if failure:
            record = {'version': 1, 'name': name, 'status': 'failed', 'phase': phase, 'boundary': boundary,
                      'error': {'code': 'ERR_RESOURCE_FIXTURE' if isinstance(failure, FixtureFailure) else 'ERR_RESOURCE_BOUNDARY' if boundary else code(failure), 'message': str(failure)[:240]}}
            if isinstance(failure, FixtureFailure):
                record['fixturePhase'] = failure.phase
                record['error']['cause'] = {'code': code(failure.cause), 'message': str(failure.cause)[:240]}
            print('RESOURCE_CASE_RESULT ' + json.dumps(record), file=sys.stderr)
            raise SystemExit(1)
        print('RESOURCE_CASE_RESULT ' + json.dumps({'version': 1, 'name': name, 'status': 'passed'}))
        print('PASS ' + name)
    print(str(len(chosen)) + ' source preparation contract tests passed. Curl/tar fixtures do not prove a real download or large payload extraction.')

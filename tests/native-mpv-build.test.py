"""Source runtime publication integrity; no SDK, network or decoding claim."""
import contextlib
import hashlib
import importlib.util
import io
import json
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch

spec = importlib.util.spec_from_file_location('native_mpv_preparer',
    Path(__file__).resolve().parents[1] / 'scripts/prepare-native-mpv.py')
builder = importlib.util.module_from_spec(spec)
spec.loader.exec_module(builder)
sha = lambda data: hashlib.sha256(data).hexdigest()


class NativeMpvIntegrity(unittest.TestCase):
    def setUp(self):
        temporary = tempfile.TemporaryDirectory(prefix='cineisle-mpv-integrity-')
        self.addCleanup(temporary.cleanup)
        self.root = Path(temporary.name)
        self.addCleanup(patch.stopall)
        patch.object(builder, 'ROOT', self.root).start()
        patch.object(builder, 'CACHE', self.root / '.local/native-mpv').start()
        self.output = contextlib.redirect_stdout(io.StringIO())
        self.output.__enter__()
        self.addCleanup(self.output.__exit__, None, None, None)
        self.artifact = builder.CACHE / 'source-build/arm64-v8a/fixture/artifact'
        self.artifact.mkdir(parents=True)
        elf = b'\x7fELF\x02\x01' + b'\0' * 12 + (183).to_bytes(2, 'little')
        for name in builder.LIBRARIES:
            (self.artifact / name).write_bytes(elf + name.encode())
        header = self.root / 'entry/src/main/cpp/mpv/include/mpv/client.h'
        header.parent.mkdir(parents=True)
        header.write_bytes(b'pinned client API')
        self.header = header
        docs = self.root / 'docs'
        docs.mkdir()
        self.metadata = {'sources': [{'name': 'fixture'}]}
        (docs / 'native-mpv-sources.json').write_text(json.dumps(self.metadata))
        (docs / 'native-mpv-notices.json').write_text('{"schema":1,"supplements":[]}')
        self.manifest = {'schema': 2, 'version': 'fixture', 'abi': 'arm64-v8a', 'minimumApi': 15,
            'clientHeaderSha256': sha(header.read_bytes()), 'sourceManifest': 'native-mpv-sources.json',
            'sourceManifestSha256': builder.digest(docs / 'native-mpv-sources.json'),
            'noticeManifest': 'native-mpv-notices.json', 'noticeManifestSha256': builder.digest(docs / 'native-mpv-notices.json')}
        self.manifest_file = docs / 'native-mpv-runtime.json'
        self.save_manifest()
        script = self.root / 'scripts/prepare-mpv-notices.py'
        script.parent.mkdir()
        script.write_text('# fixture notice generator\n')
        self.receipt = {'fingerprint': 'fixture-inputs', 'recipe': {'manifest': self.manifest['sourceManifestSha256']},
                        'sourceManifest': self.metadata, 'files': builder.files(self.artifact)}
        self.save_receipt()
        self.notices = builder.CACHE / 'source-build/notices/fixture'
        self.notices.mkdir(parents=True)
        (self.notices / 'NOTICE.txt').write_text('CineIsle fixture notices\n')
        (self.notices / 'LICENSE.txt').write_text('Fixed upstream license\n')
        self.index = {'sourceRecipe': self.metadata, 'nativeLibraryHashes': self.receipt['files'],
            'components': [{'component': 'sources/fixture', 'noticeFiles': [
                {'file': 'LICENSE.txt', 'sha256': builder.digest(self.notices / 'LICENSE.txt')}]}]}
        self.save_index()
        self.build = patch.object(builder, 'build_source', return_value=self.artifact).start()
        self.collect = patch.object(builder, 'collect_notices', return_value=self.notices).start()

    def save_manifest(self):
        self.manifest_file.write_text(json.dumps(self.manifest))

    def save_receipt(self):
        (self.artifact.parent / 'receipt.json').write_text(json.dumps(self.receipt))

    def save_index(self):
        (self.notices / 'sources.json').write_text(json.dumps(self.index))

    def previous_output(self):
        libraries = self.root / 'entry/libs/arm64-v8a'
        libraries.mkdir(parents=True)
        for name in builder.LIBRARIES:
            (libraries / name).write_bytes(b'previous-' + name.encode())
        notices = self.root / 'entry/src/main/resources/rawfile/third_party/mpv'
        notices.mkdir(parents=True)
        (notices / 'sentinel').write_bytes(b'previous notices')
        return libraries, notices

    def test_verified_source_artifacts_and_matching_notices_are_published(self):
        value = builder.prepare(True)
        for name in builder.LIBRARIES:
            self.assertEqual((self.root / 'entry/libs/arm64-v8a' / name).read_bytes(), (self.artifact / name).read_bytes())
        published = self.root / 'entry/src/main/resources/rawfile/third_party/mpv'
        self.assertEqual(builder.files(published), builder.files(self.notices))
        self.assertEqual(value['schema'], 2)
        self.assertEqual(json.loads((builder.CACHE / 'prepared.json').read_text()), value)
        self.build.assert_called_once_with(True)

    def test_changed_source_manifest_is_rejected_before_building(self):
        (self.root / 'docs/native-mpv-sources.json').write_text('{}')
        with self.assertRaisesRegex(RuntimeError, 'source manifest fingerprint mismatch'):
            builder.prepare(True)
        self.build.assert_not_called()

    def test_changed_notice_manifest_and_client_header_are_rejected(self):
        path = self.root / 'docs/native-mpv-notices.json'
        previous = path.read_bytes()
        path.write_bytes(b'changed')
        with self.assertRaisesRegex(RuntimeError, 'notice manifest fingerprint mismatch'):
            builder.prepare(True)
        path.write_bytes(previous)
        self.header.write_bytes(b'changed API')
        with self.assertRaisesRegex(RuntimeError, 'client header fingerprint mismatch'):
            builder.prepare(True)
        self.build.assert_not_called()

    def test_changed_built_library_keeps_previous_product_outputs(self):
        libraries, notices = self.previous_output()
        (self.artifact / 'libmpv.so').write_bytes(b'changed')
        with self.assertRaisesRegex(RuntimeError, 'artifact fingerprint mismatch'):
            builder.prepare(True)
        self.assertEqual((libraries / 'libmpv.so').read_bytes(), b'previous-libmpv.so')
        self.assertEqual((notices / 'sentinel').read_bytes(), b'previous notices')
        self.collect.assert_not_called()

    def test_wrong_abi_is_rejected_even_when_its_fingerprint_is_declared(self):
        file = self.artifact / 'libmpv.so'
        data = file.read_bytes()
        file.write_bytes(data[:18] + (62).to_bytes(2, 'little') + data[20:])
        self.receipt['files'] = builder.files(self.artifact)
        self.save_receipt()
        with self.assertRaisesRegex(RuntimeError, 'AArch64 ELF'):
            builder.prepare(True)
        self.collect.assert_not_called()

    def test_mismatched_notice_library_binding_is_rejected(self):
        self.index['nativeLibraryHashes'] = {}
        self.save_index()
        with self.assertRaisesRegex(RuntimeError, 'notices do not match'):
            builder.prepare(True)
        self.assertFalse((self.root / 'entry/libs').exists())

    def test_missing_license_and_escaping_notice_paths_are_rejected(self):
        (self.notices / 'LICENSE.txt').unlink()
        with self.assertRaisesRegex(RuntimeError, 'notice file fingerprint mismatch'):
            builder.prepare(True)
        self.index['components'][0]['noticeFiles'][0]['file'] = '../escaped'
        self.save_index()
        with self.assertRaisesRegex(RuntimeError, 'notice path'):
            builder.prepare(True)
        self.assertFalse((self.root / 'entry/libs').exists())

    def test_wrong_target_and_unknown_build_binding_are_rejected(self):
        self.manifest['abi'] = 'x86_64'
        self.save_manifest()
        with self.assertRaisesRegex(RuntimeError, 'target/schema'):
            builder.prepare(True)
        self.manifest['abi'] = 'arm64-v8a'
        self.save_manifest()
        self.receipt['recipe']['manifest'] = 'wrong inputs'
        self.save_receipt()
        with self.assertRaisesRegex(RuntimeError, 'build/source binding mismatch'):
            builder.prepare(True)

    def test_failed_notice_collection_keeps_previous_product_outputs(self):
        libraries, notices = self.previous_output()
        self.collect.side_effect = RuntimeError('license archive unavailable offline')
        with self.assertRaisesRegex(RuntimeError, 'unavailable offline'):
            builder.prepare(True)
        self.assertEqual((libraries / 'libmpv.so').read_bytes(), b'previous-libmpv.so')
        self.assertEqual((notices / 'sentinel').read_bytes(), b'previous notices')

    def test_failed_multifile_publication_rolls_back_all_previous_outputs(self):
        libraries, notices = self.previous_output()
        original = Path.replace
        failed = False
        def replace(path, target):
            nonlocal failed
            if not failed and 'publish-' in str(path) and Path(target) == libraries / 'libc++_shared.so':
                failed = True
                raise OSError('simulated publication failure')
            return original(path, target)
        with patch.object(Path, 'replace', replace):
            with self.assertRaisesRegex(OSError, 'publication failure'):
                builder.prepare(True)
        for name in builder.LIBRARIES:
            self.assertEqual((libraries / name).read_bytes(), b'previous-' + name.encode())
        self.assertEqual((notices / 'sentinel').read_bytes(), b'previous notices')
        self.assertFalse((builder.CACHE / 'prepared.json').exists())


if __name__ == '__main__':
    unittest.main()

"""Pinned source acquisition boundaries; no SDK, network or media acceptance claim."""
import hashlib
import importlib.util
import io
import json
from pathlib import Path
import tarfile
import tempfile
import unittest
from unittest.mock import patch

spec = importlib.util.spec_from_file_location('native_mpv_source_builder',
    Path(__file__).resolve().parents[1] / 'scripts/build-native-mpv.py')
builder = importlib.util.module_from_spec(spec)
spec.loader.exec_module(builder)


class NativeMpvSourceIntegrity(unittest.TestCase):
    def setUp(self):
        temporary = tempfile.TemporaryDirectory(prefix='cineisle-mpv-source-integrity-')
        self.addCleanup(temporary.cleanup)
        self.root = Path(temporary.name)
        self.addCleanup(patch.stopall)
        patch.object(builder, 'ROOT', self.root).start()
        patch.object(builder, 'CACHE', self.root / 'cache').start()
        self.run = patch.object(builder.subprocess, 'run', side_effect=AssertionError('unexpected execution')).start()

    def archive(self, members=None):
        data = io.BytesIO()
        with tarfile.open(fileobj=data, mode='w:gz') as archive:
            for name, value in members or [('source/src/client.h', b'fixed API')]:
                item = tarfile.TarInfo(name)
                if isinstance(value, tuple):
                    item.type = tarfile.SYMTYPE
                    item.linkname = value[0]
                    archive.addfile(item)
                else:
                    item.size = len(value)
                    archive.addfile(item, io.BytesIO(value))
        content = data.getvalue()
        checksum = hashlib.sha256(content).hexdigest()
        destination = builder.CACHE / 'archives' / (checksum + '.tar.gz')
        destination.parent.mkdir(parents=True, exist_ok=True)
        destination.write_bytes(content)
        return {'name': 'sample', 'url': 'https://example.invalid/fixed.tar.gz',
                'sha256': checksum, 'destination': 'sample'}, destination

    def test_verified_offline_source_reuses_an_unchanged_tree(self):
        record, _ = self.archive()
        first = builder.source(record, True, {})
        self.assertEqual((first / 'src/client.h').read_bytes(), b'fixed API')
        self.assertEqual(builder.source(record, True, {}), first)
        self.run.assert_not_called()

    def test_missing_archive_offline_never_attempts_a_download(self):
        record, archive = self.archive()
        archive.unlink()
        with self.assertRaisesRegex(RuntimeError, 'unavailable offline'):
            builder.source(record, True, {})
        self.run.assert_not_called()

    def test_changed_archive_is_rejected_before_extracting(self):
        record, archive = self.archive()
        archive.write_bytes(b'changed bytes')
        with self.assertRaisesRegex(RuntimeError, 'source fingerprint mismatch'):
            builder.source(record, True, {})
        self.assertFalse((builder.CACHE / 'sources').exists())

    def test_changed_extracted_source_is_rejected(self):
        record, _ = self.archive()
        directory = builder.source(record, True, {})
        (directory / 'src/client.h').write_bytes(b'changed API')
        with self.assertRaisesRegex(RuntimeError, 'source was modified'):
            builder.source(record, True, {})

    def test_injected_bytecode_is_part_of_the_integrity_boundary(self):
        record, _ = self.archive()
        directory = builder.source(record, True, {})
        (directory / '__pycache__').mkdir()
        (directory / '__pycache__/generator.pyc').write_bytes(b'unreviewed code')
        with self.assertRaisesRegex(RuntimeError, 'source was modified'):
            builder.source(record, True, {})

    def test_archive_traversal_and_link_escape_cannot_write_outside_destination(self):
        for index, members in enumerate([
            [('source/../../escaped', b'bad')],
            [('source/link', ('../../escaped',))],
            [('/absolute/file', b'bad')],
        ]):
            _, archive = self.archive(members)
            with self.assertRaises((RuntimeError, tarfile.FilterError)):
                builder.extract(archive, self.root / ('out-' + str(index)))
        self.assertFalse((self.root / 'escaped').exists())

    def test_multiple_roots_and_overlapping_components_are_rejected(self):
        _, archive = self.archive([('one/file', b'one'), ('two/file', b'two')])
        with self.assertRaisesRegex(RuntimeError, 'archive roots'):
            builder.extract(archive, self.root / 'multiple')
        record, _ = self.archive()
        metadata = {'sources': [record, dict(record, name='second')], 'patches': []}
        with self.assertRaisesRegex(RuntimeError, 'overlapping'):
            builder.assemble(metadata, self.root / 'work', True, {})

    def test_changed_assembled_sources_are_not_silently_rebuilt(self):
        record, _ = self.archive()
        metadata = {'sources': [record], 'patches': []}
        workspace = self.root / 'work'
        directory = builder.assemble(metadata, workspace, True, {})
        (directory / 'sample/src/client.h').write_bytes(b'local edit')
        with self.assertRaisesRegex(RuntimeError, 'source tree was modified'):
            builder.assemble(metadata, workspace, True, {})
        self.assertEqual((directory / 'sample/src/client.h').read_bytes(), b'local edit')

    def test_changed_patch_is_rejected_without_execution(self):
        record, _ = self.archive()
        patch_file = self.root / 'fix.patch'
        patch_file.write_bytes(b'changed patch')
        metadata = {'sources': [record], 'patches': [{'component': 'sample', 'path': 'fix.patch', 'sha256': '0' * 64}]}
        with self.assertRaisesRegex(RuntimeError, 'patch fingerprint mismatch'):
            builder.assemble(metadata, self.root / 'work', True, {})
        self.run.assert_not_called()

    def test_noncanonical_cargo_sources_are_rejected_offline(self):
        directory = self.root / 'sources'
        for name in ['dovi/dolby_vision', 'cbindgen']:
            path = directory / name
            path.mkdir(parents=True)
            (path / 'Cargo.lock').write_text('[[package]]\nname="unreviewed"\nversion="1.0.0"\nsource="git+https://example.invalid/code"\n')
        with self.assertRaisesRegex(RuntimeError, 'unreviewed Cargo'):
            builder.verify_cargo_archives(directory, self.root / 'cargo-home')


if __name__ == '__main__':
    unittest.main()

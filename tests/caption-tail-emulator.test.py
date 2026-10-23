"""Compare controlled real native RGBA captures; requires an explicit local evidence directory.

This does not run an emulator or turn SDK/source fixtures into native playback proof.
"""
import hashlib
import json
import os
from pathlib import Path
import unittest

D = Path(os.environ.get('CINEISLE_CAPTION_CAPTURE_DIR', '.local/caption-tail-captures'))
NAMES = {'fit', 'fit-tail', 'overflow', 'overflow-tail', 'unicode', 'unicode-tail',
         'unicode-overflow', 'unicode-overflow-tail', 'split-tail'}


class CaptionTailPixels(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.bindings = {}
        cls.frames = {}
        for phase in ['baseline', 'final']:
            root = D / ('tail-' + phase)
            binding = json.loads((root / 'binding.json').read_text())
            records = json.loads((root / 'probes.json').read_text())
            assert binding['phase'] == phase and binding['cases'] == 9
            assert len(records) == 9 and {r['name'] for r in records} == NAMES
            cls.bindings[phase] = binding
            for record in records:
                assert record['outcome'] == 'success', record
                data = (root / 'frames' / (record['name'] + '.rgba')).read_bytes()
                width, height = record['width'], record['height']
                assert width > 0 and height > 0 and len(data) == width * height * 4
                cls.frames[phase, record['name']] = width, height, data

    def test_same_driver_and_inputs_different_native_candidate(self):
        before, after = self.bindings['baseline'], self.bindings['final']
        self.assertEqual(before['qaAbilitySha256'], after['qaAbilitySha256'])
        self.assertEqual(before['specsSha256'], after['specsSha256'])
        self.assertNotEqual(before['qaCppSourceSha256'], after['qaCppSourceSha256'])
        self.assertNotEqual(before['qaHapSha256'], after['qaHapSha256'])
        specs = (D / 'tail-probe-specs.json').read_bytes()
        self.assertEqual(hashlib.sha256(specs).hexdigest(), after['specsSha256'])
        self.assertEqual({x['name'] for x in json.loads(specs)}, NAMES)

    def test_baseline_reproduces_false_ellipsis_for_terminal_breaks(self):
        for name in ['fit', 'unicode']:
            with self.subTest(name=name):
                self.assertNotEqual(self.frames['baseline', name], self.frames['baseline', name + '-tail'])

    def test_content_without_terminal_breaks_is_pixel_identical(self):
        for name in ['fit', 'overflow', 'unicode', 'unicode-overflow']:
            with self.subTest(name=name):
                self.assertEqual(self.frames['baseline', name], self.frames['final', name])

    def test_terminal_empty_lines_do_not_alter_complete_ascii_glyphs(self):
        self.assertEqual(self.frames['final', 'fit'], self.frames['final', 'fit-tail'])

    def test_terminal_empty_lines_do_not_alter_complete_utf16_glyphs(self):
        self.assertEqual(self.frames['final', 'unicode'], self.frames['final', 'unicode-tail'])

    def test_real_ascii_overflow_keeps_original_truncation(self):
        self.assertEqual(self.frames['baseline', 'overflow-tail'], self.frames['final', 'overflow-tail'])
        self.assertEqual(self.frames['final', 'overflow'], self.frames['final', 'overflow-tail'])
        self.assertNotEqual(self.frames['final', 'fit'], self.frames['final', 'overflow-tail'])

    def test_real_utf16_overflow_keeps_original_truncation(self):
        self.assertEqual(self.frames['baseline', 'unicode-overflow-tail'], self.frames['final', 'unicode-overflow-tail'])
        self.assertEqual(self.frames['final', 'unicode-overflow'], self.frames['final', 'unicode-overflow-tail'])
        self.assertNotEqual(self.frames['final', 'unicode'], self.frames['final', 'unicode-overflow-tail'])

    def test_terminal_breaks_split_between_runs_use_the_same_budget(self):
        self.assertEqual(self.frames['final', 'fit'], self.frames['final', 'split-tail'])

    def test_genuine_overflow_preserves_the_first_paragraph_pixels(self):
        complete = self.frames['final', 'fit']
        overflow = self.frames['final', 'overflow']
        self.assertEqual(complete[:2], overflow[:2])
        first_line = complete[0] * (complete[1] // 3) * 4
        self.assertEqual(complete[2][:first_line], overflow[2][:first_line])
        self.assertTrue(any(complete[2][3:first_line:4]))


if __name__ == '__main__':
    unittest.main()

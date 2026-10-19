"""Verify the actual built HAP; no signature, installation or device UI claim."""
import json
from pathlib import Path
import sys
import unittest
import zipfile

ROOT = Path(__file__).resolve().parents[1]
HAP = Path(sys.argv.pop(1)) if len(sys.argv) > 1 else ROOT / 'entry/build/default/outputs/default/entry-default-unsigned.hap'


class BrandPackageTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.archive = zipfile.ZipFile(HAP)
        cls.manifest = json.loads(cls.archive.read('module.json'))
        cls.source = json.loads((ROOT / 'AppScope/app.json5').read_text())['app']

    @classmethod
    def tearDownClass(cls):
        cls.archive.close()

    def test_manifest_identity_and_api(self):
        app = self.manifest['app']
        self.assertEqual(app['bundleName'], 'com.cineisle.app')
        self.assertEqual(app['vendor'], 'CineIsle')
        self.assertEqual(app['versionName'], self.source['versionName'])
        self.assertEqual(app['versionCode'], self.source['versionCode'])
        self.assertEqual(app['minAPIVersion'], 50000012)
        self.assertEqual(app['targetAPIVersion'], 50000012)

    def test_packaged_launcher_and_start_window_bindings(self):
        app = self.manifest['app']
        self.assertEqual(app['icon'], '$media:app_icon')
        self.assertEqual(app['label'], '$string:app_name')
        for ability in self.manifest['module']['abilities']:
            self.assertEqual(ability['iconId'], app['iconId'])
            self.assertEqual(ability['startWindowIconId'], app['iconId'])
            self.assertEqual(ability['labelId'], app['labelId'])
        self.assertEqual(self.manifest['module']['mainElement'], 'EntryAbility')

    def test_svg_is_exact_current_source(self):
        self.assertEqual(self.archive.read('resources/base/media/app_icon.svg'),
                         (ROOT / 'AppScope/resources/base/media/app_icon.svg').read_bytes())

    def test_all_original_navigation_and_detail_icons_are_packaged_exactly(self):
        files = [p for p in (ROOT / 'entry/src/main/resources/base/media').glob('*.svg') if p.name.startswith(('nav_', 'detail_', 'menu_', 'player_'))]
        self.assertEqual(len(files), 49)
        for file in files:
            with self.subTest(icon=file.name):
                self.assertEqual(self.archive.read('resources/base/media/' + file.name), file.read_bytes())

    def test_brand_color_resources_are_packaged(self):
        index = self.archive.read('resources.index')
        for color in ['brand_background', 'brand_surface', 'brand_accent', 'brand_muted', 'brand_action', 'brand_selected', 'brand_warm', 'brand_danger']:
            self.assertIn(color.encode(), index)

    def test_resource_index_contains_new_names_without_legacy_brand(self):
        data = self.archive.read('resources.index')
        for value in ['映屿 · CineIsle', '映屿 · CineIsle · ' + self.source['versionName'], '映屿 · CineIsle 鸿蒙私人影视库']:
            self.assertIn(value.encode(), data)
        self.assertNotIn(b'findroid', data.lower())

    def test_compiled_machine_identity_has_new_brand(self):
        data = self.archive.read('ets/modules.abc')
        self.assertIn(b'CineIsle', data)
        self.assertIn(b'cineisle.current.session', data)
        self.assertNotIn(b'Findroid Harmony', data)
        self.assertNotIn(b'findroid.current.session', data)


if __name__ == '__main__':
    unittest.main(verbosity=2)

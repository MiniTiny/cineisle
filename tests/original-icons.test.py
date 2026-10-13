"""Original SVG family, binding, contrast and provenance regressions; no device pixel claim."""
import hashlib
import importlib.util
import json
from pathlib import Path
import re
import subprocess
import sys
import unittest
import xml.etree.ElementTree as ET

ROOT = Path(__file__).resolve().parents[1]
MEDIA = ROOT / 'entry/src/main/resources/base/media'
NS = '{http://www.w3.org/2000/svg}'
spec = importlib.util.spec_from_file_location('cineisle_icons', ROOT / 'scripts/generate-icons.py')
icons = importlib.util.module_from_spec(spec)
spec.loader.exec_module(icons)
COLORS = {c['name']: c['value'] for c in json.loads((MEDIA.parent / 'element/color.json').read_text())['color']}
PROVENANCE = json.loads((ROOT / 'tests/fixtures/icon-provenance.json').read_text())


def geometry(svg):
    result = []
    for node in ET.fromstring(svg).iter():
        if node.tag in {NS + name for name in ['path', 'circle', 'rect', 'line']}:
            attrs = []
            for key in ['d', 'x', 'y', 'width', 'height', 'rx', 'ry', 'cx', 'cy', 'r', 'x1', 'y1', 'x2', 'y2']:
                if key in node.attrib:
                    value = node.attrib[key]
                    # Ignore path formatting and numeric precision when detecting retained geometry.
                    tokens = re.findall(r'[A-Za-z]|[-+]?(?:\d*\.\d+|\d+)(?:[eE][-+]?\d+)?', value)
                    normalized = tuple(float(t) if re.fullmatch(r'[-+]?(?:\d*\.\d+|\d+)(?:[eE][-+]?\d+)?', t) else t for t in tokens)
                    attrs.append((key, normalized))
            result.append((node.tag, tuple(attrs)))
    return tuple(result)


def contrast(first, second):
    def luminance(color):
        values = [int(color[n:n+2], 16) / 255 for n in [1, 3, 5]]
        values = [c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4 for c in values]
        return sum(v*w for v, w in zip(values, [0.2126, 0.7152, 0.0722]))
    light, dark = sorted([luminance(first), luminance(second)], reverse=True)
    return (light + 0.05) / (dark + 0.05)


class OriginalIconsTest(unittest.TestCase):
    def test_complete_family_matches_current_resource_files(self):
        expected = set(icons.outputs())
        self.assertEqual(len(expected), 38)
        actual = {p.name for p in MEDIA.glob('*.svg') if p.name.startswith(('nav_', 'detail_', 'menu_'))}
        self.assertEqual(actual, expected)

    def test_generator_drift_gate_passes(self):
        result = subprocess.run([sys.executable, ROOT / 'scripts/generate-icons.py', '--check'], capture_output=True, text=True)
        self.assertEqual(result.returncode, 0, result.stdout + result.stderr)
        self.assertIn('generate-icons.py" --check', (ROOT / 'scripts/build.sh').read_text())

    def test_vectors_are_safe_self_contained_native_resources(self):
        for name in icons.outputs():
            with self.subTest(icon=name):
                root = ET.fromstring((MEDIA / name).read_text())
                self.assertEqual(root.attrib['viewBox'], '0 0 24 24')
                self.assertEqual(root.attrib['width'], '24')
                self.assertEqual(root.attrib['height'], '24')
                for node in root.iter():
                    self.assertIn(node.tag, {NS + s for s in ['svg', 'g', 'path', 'circle', 'rect']})
                    for key, value in node.attrib.items():
                        self.assertFalse(key.lower().startswith('on') or 'href' in key)
                        self.assertNotIn('url(', value)

    def test_round_strokes_and_geometry_stay_inside_icon_grid(self):
        for name in icons.outputs():
            with self.subTest(icon=name):
                root = ET.fromstring((MEDIA / name).read_text())
                group = root.find(NS + 'g')
                self.assertEqual(group.attrib['stroke-width'], '1.75')
                self.assertEqual(group.attrib['stroke-linecap'], 'round')
                self.assertEqual(group.attrib['stroke-linejoin'], 'round')
                for node in group:
                    if node.tag == NS + 'path':
                        self.assertNotRegex(node.attrib['d'], r'[a-hj-z]')  # Absolute M/L/C/H/V/Z only.
                        self.assertTrue(all(2 <= float(v) <= 22 for v in re.findall(r'\d*\.\d+|\d+', node.attrib['d'])))
                    elif node.tag == NS + 'circle':
                        for axis in ['cx', 'cy']:
                            center, radius = float(node.attrib[axis]), float(node.attrib['r'])
                            self.assertGreaterEqual(center - radius - .875, 1)
                            self.assertLessEqual(center + radius + .875, 23)
                    elif node.tag == NS + 'rect':
                        self.assertGreaterEqual(float(node.attrib['x']) - .875, 1)
                        self.assertGreaterEqual(float(node.attrib['y']) - .875, 1)
                        self.assertLessEqual(float(node.attrib['x']) + float(node.attrib['width']) + .875, 23)
                        self.assertLessEqual(float(node.attrib['y']) + float(node.attrib['height']) + .875, 23)

    def test_navigation_states_keep_geometry_and_use_distinct_palette(self):
        for name in icons.NAV:
            active = (MEDIA / f'nav_{name}_active.svg').read_text()
            muted = (MEDIA / f'nav_{name}_muted.svg').read_text()
            self.assertEqual(geometry(active), geometry(muted))
            self.assertEqual(ET.fromstring(active).find(NS+'g').attrib['stroke'], COLORS['brand_accent'])
            self.assertEqual(ET.fromstring(muted).find(NS+'g').attrib['stroke'], COLORS['brand_muted'])
        self.assertNotEqual(COLORS['brand_accent'], COLORS['brand_muted'])

    def test_navigation_destinations_have_distinct_symbols(self):
        shapes = [geometry((MEDIA / f'nav_{name}_active.svg').read_text()) for name in icons.NAV]
        self.assertEqual(len(set(shapes)), len(icons.NAV))

    def test_favorite_fill_keeps_shape_and_expresses_state_beyond_color(self):
        plain, filled = [(MEDIA / f'detail_{s}.svg').read_text() for s in ['heart', 'heart_filled']]
        self.assertEqual(geometry(plain), geometry(filled))
        self.assertEqual(ET.fromstring(plain).find(NS+'g').attrib['fill'], 'none')
        self.assertEqual(ET.fromstring(filled).find(NS+'g').attrib['fill'], COLORS['brand_warm'])

    def test_local_file_removal_and_server_deletion_are_visually_distinct(self):
        local, server = [(MEDIA / f'detail_{s}.svg').read_text() for s in ['trash', 'remove']]
        self.assertNotEqual(geometry(local), geometry(server))
        self.assertEqual(ET.fromstring(server).find(NS+'g').attrib['stroke'], COLORS['brand_danger'])
        self.assertEqual(ET.fromstring(local).find(NS+'g').attrib['stroke'], COLORS['brand_accent'])

    def test_previous_vector_paths_are_absent_from_all_replacements(self):
        old = set(PROVENANCE['previousGeometrySha256'])
        self.assertTrue(old)
        for name in icons.outputs():
            with self.subTest(icon=name):
                current = {hashlib.sha256(repr(shape).encode()).hexdigest() for shape in geometry((MEDIA / name).read_text())}
                self.assertTrue(current.isdisjoint(old), 'retained geometry: ' + name)

    def test_all_page_and_component_media_references_resolve(self):
        available = {p.stem for directory in [MEDIA, ROOT / 'AppScope/resources/base/media'] for p in directory.glob('*')}
        referenced = set()
        for file in (ROOT / 'entry/src/main/ets').rglob('*.ets'):
            referenced.update(re.findall(r"\$r\('app\.media\.([^']+)'\)", file.read_text()))
        self.assertTrue(referenced <= available, str(referenced - available))
        # Four bottom destinations; library is an unselected action inside More.
        self.assertIn('nav_library_active', referenced)
        for name in ['home', 'star', 'user', 'more']:
            self.assertIn('nav_' + name + '_active', referenced)
            self.assertIn('nav_' + name + '_muted', referenced)
        self.assertTrue({Path(s).stem for s in icons.outputs() if s.startswith('detail_')} <= referenced)

    def test_brand_colors_and_action_text_have_readable_contrast(self):
        for foreground, background in [('brand_accent', 'brand_selected'), ('brand_muted', 'brand_surface_raised'),
                                      ('brand_accent', 'brand_surface'), ('brand_warm', 'brand_surface'), ('brand_danger', 'brand_surface')]:
            self.assertGreaterEqual(contrast(COLORS[foreground], COLORS[background]), 4.5, foreground)
        self.assertGreaterEqual(contrast('#FFFFFF', COLORS['brand_action']), 4.5)

    def test_ui_resource_colors_resolve_and_old_purple_accents_are_gone(self):
        for file in (ROOT / 'entry/src/main/ets').rglob('*.ets'):
            source = file.read_text()
            for name in re.findall(r"\$r\('app\.color\.([^']+)'\)", source):
                self.assertIn(name, COLORS)
            self.assertNotRegex(source, r'#(?:D5CCFF|443C63|292541|7C67ED|8E7DFF|BBAAFF)', str(file))
        self.assertEqual(COLORS['start_window_background'], COLORS['brand_background'])

    def test_management_symbols_are_distinct_and_bound_to_product_actions(self):
        shapes = [geometry((MEDIA / f'menu_{name}.svg').read_text()) for name in icons.MENU]
        self.assertEqual(len(set(shapes)), len(icons.MENU))
        source = '\n'.join(p.read_text() for p in (ROOT / 'entry/src/main/ets').rglob('*.ets'))
        for name in icons.MENU:
            self.assertIn(f"app.media.menu_{name}", source)

    def test_departure_and_chevron_use_the_existing_brand_palette(self):
        for name, color in [('logout', 'brand_warm'), ('chevron', 'brand_muted')]:
            self.assertEqual(ET.fromstring((MEDIA / f'menu_{name}.svg').read_text()).find(NS+'g').attrib['stroke'], COLORS[color])

    def test_current_notices_describe_original_assets_and_keep_other_licenses(self):
        notices = (ROOT / 'THIRD_PARTY_NOTICES.md').read_text()
        self.assertNotRegex(notices, r'Findroid|findroid|Android vector|仍包含从原工程')
        self.assertIn('Jellyfin OpenAPI', notices)
        self.assertIn('GPL-3.0-only', notices)
        self.assertEqual(json.loads((ROOT / 'oh-package.json5').read_text())['license'], 'GPL-3.0-only')
        license_hash = PROVENANCE['licenseSha256']
        self.assertEqual(hashlib.sha256((ROOT / 'LICENSE').read_bytes()).hexdigest(), license_hash)


if __name__ == '__main__':
    unittest.main(verbosity=2)

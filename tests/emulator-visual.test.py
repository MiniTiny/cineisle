"""Regressions against saved final native screenshots/layouts, not synthetic renders.

Run with Python + Pillow after refreshing docs/audits/2026-10-10/emulator.
These checks cover the recorded API 26 emulator only. QA screenshots use an
isolated Jellyfin-shaped fixture, not the user's authenticated server.
"""
import json
from pathlib import Path
import re
import unittest
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
CAPTURES = ROOT / 'docs/audits/2026-10-10/emulator'


def layout(name):
    return json.loads((CAPTURES / (name + '.json')).read_text())['nodes']


def texts(name):
    return [n.get('text', '') for n in layout(name) if n.get('text')]


def bounds(node):
    return tuple(map(int, re.findall(r'\d+', node['bounds'])))


def colors(name, box):
    with Image.open(CAPTURES / (name + '.png')) as image:
        return dict((color, count) for count, color in image.convert('RGB').crop(box).getcolors(1280 * 2832))


class NativeVisualTest(unittest.TestCase):
    def test_window_and_gesture_background_have_no_white_strip(self):
        for name in ['real-home', 'real-movie', 'real-libraries', 'real-actors',
                     'real-recommend', 'qa-more', 'qa-series', 'qa-episode']:
            with self.subTest(page=name), Image.open(CAPTURES / (name + '.png')) as image:
                self.assertEqual(image.size, (1280, 2832))
                self.assertEqual(image.convert('RGB').getpixel((10, 2800)), (19, 35, 46))
                self.assertEqual(image.convert('RGB').getpixel((10, 100)), (13, 25, 36))

    def test_five_navigation_destinations_have_distinct_selected_state(self):
        centers = [138, 389, 640, 890, 1142]
        for name, selected in [('real-recommend', 0), ('real-home', 1),
                               ('real-libraries', 2), ('real-actors', 3), ('qa-more', 4)]:
            with self.subTest(page=name):
                for label in ['推荐', '首页', '媒体库', '演员', '更多']:
                    self.assertIn(label, texts(name))
                for index, x in enumerate(centers):
                    pixels = colors(name, (x - 60, 2500, x + 60, 2600))
                    expected = (141, 232, 210) if index == selected else (166, 189, 187)
                    self.assertGreater(pixels.get(expected, 0), 40)
                    if index != selected:
                        self.assertEqual(pixels.get((141, 232, 210), 0), 0)

    def test_detail_action_buttons_have_horizontal_and_vertical_gaps(self):
        actions = [bounds(n) for n in layout('qa-movie') if n.get('type') == 'Button'
                   and 1500 <= bounds(n)[1] <= 1800]
        self.assertEqual(len(actions), 6)
        first = sorted([b for b in actions if b[1] == 1530])
        second = sorted([b for b in actions if b[1] == 1782])
        self.assertEqual((len(first), len(second)), (4, 2))
        self.assertGreaterEqual(second[0][1] - first[0][3], 28)
        for row in [first, second]:
            for left, right in zip(row, row[1:]):
                self.assertGreaterEqual(right[0] - left[2], 28)
        for n in layout('qa-movie'):
            if n.get('text') == '删除服务器媒体':
                x1, y1, x2, y2 = bounds(n)
                self.assertTrue(336 <= x1 < x2 <= 588 and 1782 <= y1 < y2 <= 2006)

    def test_destructive_label_and_icon_are_coral_favorite_is_warm(self):
        self.assertGreater(colors('qa-movie', (336, 1782, 588, 1885)).get((255, 159, 159), 0), 40)
        self.assertGreater(colors('qa-movie', (336, 1890, 588, 2006)).get((255, 159, 159), 0), 100)
        self.assertGreater(colors('qa-movie', (896, 1530, 1148, 1640)).get((244, 207, 139), 0), 100)
        self.assertGreater(colors('qa-movie-local-remove', (56, 1782, 308, 1890)).get((141, 232, 210), 0), 40)
        self.assertIn('移除下载', texts('qa-movie-local-remove'))
        self.assertIn('下载', texts('qa-movie'))
        self.assertNotIn('已下载，可离线播放', texts('qa-movie'))

    def test_movie_metadata_and_version_controls_survive_wrapped_actions(self):
        values = texts('qa-movie')
        for value in ['Island of Light', '2024 · 90 分钟 · PG-13 · 评分 8.6', '继续播放',
                      '从头播放', '预告片', '原始版本 · 1080p', '兼容版本 · 720p', 'H264', 'AAC', 'CC']:
            self.assertIn(value, values)
        versions = [bounds(n) for n in layout('qa-movie') if n.get('text') in ['原始版本 · 1080p', '兼容版本 · 720p']]
        self.assertEqual(len(versions), 2)
        self.assertGreater(versions[1][0], versions[0][2])

    def test_series_season_and_episode_navigation_was_rendered_natively(self):
        self.assertIn('播放下一集', texts('qa-series'))
        self.assertNotIn('删除服务器媒体', texts('qa-series'))
        for value in ['下一集', '季度', '第一季', '第 1 季 · 第 1 集 · 岛屿的清晨']:
            self.assertIn(value, texts('qa-series-children'))
        self.assertIn('单集', texts('qa-season-episodes'))
        self.assertIn('岛屿的清晨', texts('qa-episode'))

    def test_episode_audio_subtitle_rows_are_visible_and_do_not_overlap(self):
        rows = [n for n in layout('qa-episode') if n.get('text') in
                ['700.0 MiB', 'H264 · 1920×1080 · 8 位', '中文 · AAC · Stereo', 'English · SRT']]
        self.assertEqual(len(rows), 4)
        boxes = sorted([bounds(n) for n in rows], key=lambda b: b[1])
        for above, below in zip(boxes, boxes[1:]):
            self.assertGreater(below[1], above[3])
        self.assertLessEqual(boxes[-1][3], 2734)

    def test_authenticated_movie_survives_three_refreshes(self):
        for name in ['real-movie'] + ['real-movie-refresh-' + str(i) for i in range(1, 4)]:
            value = '\n'.join(texts(name))
            self.assertIn('EP23', value)
            self.assertIn('H264', value)
            self.assertIn('AAC', value)
            self.assertNotIn('Parameter error', value)
            self.assertNotIn('405', value)

    def test_remove_confirmation_uses_dark_native_dialog(self):
        self.assertIn('移除下载', texts('qa-remove-dialog'))
        self.assertIn('将删除本机视频文件并取消正在进行的任务。', texts('qa-remove-dialog'))
        # Measure a clear band between description and actions, excluding glyphs.
        pixels = colors('qa-remove-dialog', (300, 1470, 980, 1500))
        dark = sum(count for rgb, count in pixels.items() if max(rgb) < 100)
        self.assertGreater(dark / (680 * 30), 0.95)

    def test_archived_layouts_exclude_credentials_and_request_urls(self):
        for file in CAPTURES.glob('*.json'):
            if file.name == 'qa-source-match.json':
                continue
            raw = file.read_text()
            self.assertNotRegex(raw, r'(?i)api_key|accessToken|Authorization|http://|https://')


if __name__ == '__main__':
    unittest.main(verbosity=2)

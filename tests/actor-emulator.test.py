"""Read-only regression over captured native UI evidence, not live playback proof."""
import json,re,unittest,pathlib,os
from PIL import Image
ROOT=pathlib.Path(__file__).resolve().parents[1]
D=pathlib.Path(os.environ.get('CINEISLE_UI_CAPTURE_DIR', ROOT/'.local/ui-captures'))
def nodes(name):return json.loads((D/('actor-baseline-'+name+'.json')).read_text())['nodes']
def texts(name):return [n.get('text','') for n in nodes(name)]
class NativeEvidence(unittest.TestCase):
 def test_home_four_destinations(self):
  v=[n['text'] for n in nodes('home-final') if n.get('text') in ['首页','推荐','演员','更多','媒体库'] and int(re.findall(r'\d+',n['bounds'])[1])>2500];self.assertEqual(v,['首页','推荐','演员','更多'])
 def test_home_shortcuts(self):self.assertTrue({'我的收藏','离线下载','继续观看','下一集'}<=set(texts('home-final')))
 def test_home_brand_pixel(self):
  im=Image.open(D/'actor-baseline-home-final.png').convert('RGB');self.assertEqual(im.getpixel((5,500)),(13,25,36))
 def test_full_sync(self):self.assertIn('同步完成：5 项媒体，1 位演员',texts('synced'))
 def test_actor_counts_and_order(self):self.assertTrue({'播放次数','3 部作品 · 已看 1 · 未看 2','已关注 · 0 部新作品'}<=set(texts('actors-final')))
 def test_actor_detail(self):self.assertTrue({'取消关注','全部风格','饰演：侦探'}<=set(texts('actor-final')))
 def test_favorite_filters(self):self.assertTrue({'全部','全部类型','名称升序','匹配 2 / 共 2'}<=set(texts('favorites-current')))
 def test_batch_success(self):self.assertTrue({'成功 2 项，失败 0 项','匹配 0 / 共 0','撤销'}<=set(texts('unfavorite-result')))
 def test_undo(self):self.assertTrue({'成功 2 项，失败 0 项','匹配 2 / 共 2'}<=set(texts('undo-result')))
 def test_download_categories(self):self.assertTrue({'进行中','已完成','需处理'}<=set(texts('downloads')))
 def test_download_completed(self):self.assertIn('已下载，可离线播放',texts('download-complete'))
 def test_download_restored(self):self.assertIn('已下载，可离线播放',texts('download-restored'))
 def test_settings(self):self.assertTrue({'应用锁','下载偏好','立即锁定','关闭应用锁'}<=set(texts('pin-enabled')))
 def test_cold_start_gate(self):
  for name in ['pin-locked','pin-cold-start']:
   t=texts(name);self.assertIn('解锁映屿',t);self.assertFalse(any('电影视觉回归' in x or '同步媒体库' in x for x in t))
 def test_matching_sources(self):self.assertEqual(json.loads((D/'qa-source-match-actor.json').read_text())['allMatch'],True)
if __name__=='__main__':unittest.main()

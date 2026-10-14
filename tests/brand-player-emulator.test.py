"""Native captured geometry/pixels; local video fixture is not real Jellyfin or OS lifecycle proof."""
import json,os,pathlib,re,unittest
from PIL import Image
D=pathlib.Path(os.environ.get('CINEISLE_UI_CAPTURE_DIR','.local/ui-captures'))
def nodes(name):return json.loads((D/(name+'.json')).read_text())['nodes']
def box(n):return tuple(map(int,re.findall(r'-?\d+',n['bounds'])))
def descendants(ns,parent):
 out=[]
 for n in ns:
  p=n['parent']
  while p is not None:
   if p==parent['index']:out.append(n);break
   p=ns[p]['parent']
 return out

def button(ns,label):
 n=next(n for n in ns if n.get('text')==label and n.get('visible')=='true')
 text=n
 while n['type']!='Button':n=ns[n['parent']]
 return n,text

def contains(a,b):x,y,r,bottom=box(a);l,t,rr,bb=box(b);return x<=l<=rr<=r and y<=t<=bb<=bottom
class BrandPlayer(unittest.TestCase):
 @classmethod
 def setUpClass(cls):cls.modes=json.loads((D/'player-matrix.json').read_text())
 def test_six_actual_viewports_and_font_configurations(self):
  self.assertEqual({m['name']for m in self.modes},{'small','normal','regular-large','large','land','land-large'})
  for m in self.modes:
   v=json.loads((D/(m['name']+'-viewport.json')).read_text());self.assertEqual(v['configurationFontScale'],m['font']/100);self.assertEqual(v['window']['windowRect']['width'],round(m['width']*v['density']));self.assertEqual(v['window']['windowRect']['height'],round(m['height']*v['density']))
 def test_playback_actions_have_complete_shared_icon_and_caption_targets(self):
  for m in self.modes:
   for key,label in [('paused','播放'),('pip','画中画'),('save','保存并应用'),('reset','恢复默认偏好'),('next','下一集')]:
    with self.subTest(mode=m['name'],action=label):
     ns=nodes(m['frames'][key]);b,t=button(ns,label);ims=[n for n in descendants(ns,b)if n['type']=='Image'];self.assertEqual(len(ims),1)
     for n in [b,t,ims[0]]:self.assertEqual(n['bounds'],n.get('origBounds',n['bounds']));self.assertEqual(n.get('visible'),'true');self.assertTrue(contains(b,n))
     self.assertGreaterEqual(box(t)[0],box(ims[0])[2])
 def test_branded_primary_secondary_and_speed_selection_colors(self):
  for m in self.modes:
   for key,label,color in [('paused','播放','#FF16776C'),('pip','画中画','#FF162B35'),('save','保存并应用','#FF16776C'),('reset','恢复默认偏好','#FF162B35'),('speed-selected','1.75×','#FF16776C')]:
    ns=nodes(m['frames'][key]);b,t=button(ns,label);self.assertEqual(b['backgroundColor'],color)
 def test_header_targets_and_locked_system_back_remain_reachable(self):
  for m in self.modes:
   ns=nodes(m['frames']['locked']);bs=[n for n in ns if n['type']=='Button'and n.get('visible')=='true'];self.assertEqual(len(bs),2);bs.sort(key=lambda n:box(n)[0]);self.assertEqual(bs[0]['enabled'],'false');self.assertEqual(bs[1]['enabled'],'true');self.assertEqual(bs[1]['backgroundColor'],'#FF16776C')
   density=json.loads((D/(m['name']+'-viewport.json')).read_text())['density']
   for b in bs:
    self.assertEqual(b['bounds'],b.get('origBounds',b['bounds']));self.assertAlmostEqual(box(b)[2]-box(b)[0],44*density,delta=1)
   self.assertIn('控制已锁定，点按右上角解锁',[n.get('text')for n in ns]);self.assertFalse(any(n['type']=='Select'for n in ns));self.assertFalse(any(n['type']=='XComponent'for n in nodes(m['frames']['back'])))
 def test_video_surface_preserves_actual_fixture_aspect_in_every_viewport(self):
  for m in self.modes:
   ns=nodes(m['frames']['playing']);n=next(n for n in ns if n['type']=='XComponent');x,y,r,b=box(n);self.assertGreater(b-y,20);self.assertAlmostEqual((r-x)/(b-y),16/9,delta=.03);self.assertEqual(n['bounds'],n.get('origBounds',n['bounds']))
   image=Image.open(D/(m['frames']['playing']+'.png')).convert('RGB').crop(box(n));colors=image.getcolors(image.width*image.height);self.assertGreater(len(colors or []),100)
 def test_landscape_uses_separate_video_and_control_panes(self):
  for m in self.modes:
   if not m['landscape']:continue
   ns=nodes(m['frames']['playing']);surface=next(n for n in ns if n['type']=='XComponent');scroll=next(n for n in ns if n['type']=='Scroll');self.assertLessEqual(box(surface)[2],box(scroll)[0]);density=json.loads((D/(m['name']+'-viewport.json')).read_text())['density'];self.assertGreater((box(surface)[3]-box(surface)[1])/density,170);self.assertAlmostEqual((box(scroll)[2]-box(scroll)[0])/density,320,delta=1)
 def test_progress_and_pause_are_observed_on_effective_native_video(self):
  for m in self.modes:
   ns=nodes(m['frames']['playing']);self.assertIn('10:00',[n.get('text')for n in ns]);button(ns,'暂停');button(nodes(m['frames']['paused']),'播放')
 def test_each_option_group_has_original_heading_and_scroll_access(self):
  for m in self.modes:
   captures=[nodes(name)for name in m['frames'].values()];texts={n.get('text')for ns in captures for n in ns}
   for title in ['系统播放','媒体与字幕','音轨与字幕语言偏好','倍速与连播']:self.assertIn(title,texts)
   self.assertTrue(any(n['type']=='Scroll'for ns in captures for n in ns))
 def test_selected_values_have_explicit_native_select_labels(self):
  for m in self.modes:
   captures=[nodes(m['frames'][k])for k in ['source','audio','subtitle']]
   selects=[n for ns in captures for n in ns if n['type']=='Select'];self.assertTrue(any(n['text'].startswith('映屿布局测试')for n in selects));self.assertTrue(any(n['text'].startswith('音轨 ')for n in selects));self.assertTrue(any(n['text']=='关闭字幕'for n in selects))
   for n in selects:self.assertEqual(n['backgroundColor'],'#FF162B35')
 def test_final_hap_selectors_are_complete_in_all_six_modes(self):
  for m in self.modes:
   for suffix,label in [('source-value','映屿布局测试 · H.264 / AAC'),('audio-value','音轨 2 · zho'),('subtitle-value','关闭字幕')]:
    ns=nodes(m['name']+'-final-'+suffix);n=next(n for n in ns if n['type']=='Select'and n['text']==label);self.assertEqual(n['visible'],'true');self.assertEqual(n['bounds'],n.get('origBounds',n['bounds']));self.assertEqual(n['backgroundColor'],'#FF162B35')
 def test_native_source_and_audio_selection_update_the_current_values(self):
  for name,label in [('interaction-source-selected','备用媒体源 · 同一测试视频'),('interaction-audio-selected','音轨 3 · eng')]:
   ns=nodes(name);self.assertTrue(any(n['type']=='Select'and n['text']==label and n['visible']=='true'for n in ns));self.assertFalse(any(n.get('fontColor')=='#FFFF9F9F'for n in ns if n.get('text')))
 def test_external_subtitle_is_visible_in_the_video_region(self):
  for name,mode in [('interaction-subtitle-visible','normal'),('land-large-subtitle-bottom','land-large')]:
   ns=nodes(name);t=next(n for n in ns if n.get('text')=='映屿 · 字幕布局验证');self.assertEqual(t['visible'],'true');self.assertEqual(t['bounds'],t.get('origBounds',t['bounds']));self.assertEqual(t['backgroundColor'],'#99000000');self.assertTrue(contains(ns[t['parent']],t))
   image=Image.open(D/(name+'.png')).convert('RGB').crop(box(t));counts={color:count for count,color in image.getcolors(image.width*image.height)or[]};self.assertGreater(counts.get((255,255,255),0),100)
   parent=ns[t['parent']];density=json.loads((D/(mode+'-viewport.json')).read_text())['density'];self.assertAlmostEqual(box(parent)[3]-box(t)[3],16*density,delta=2)
 def test_original_action_symbols_render_accent_pixels(self):
  for m in self.modes:
   for key in ['paused','pip','save','reset','next']:
    name=m['frames'][key];ns=nodes(name);image=Image.open(D/(name+'.png')).convert('RGB');painted=0
    for n in ns:
     if n['type']=='Image'and n.get('visible')=='true'and n['bounds']==n.get('origBounds',n['bounds']):
      crop=image.crop(box(n));counts={c:v for v,c in crop.getcolors(max(1,crop.width*crop.height))or[]};painted+=counts.get((141,232,210),0)
    self.assertGreater(painted,20)
if __name__=='__main__':unittest.main(verbosity=2)

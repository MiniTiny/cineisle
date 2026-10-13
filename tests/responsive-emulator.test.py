"""Assertions on native captures from the isolated viewport matrix, not hardware or decoding."""
import json, os, pathlib, re, unittest
from PIL import Image
D=pathlib.Path(os.environ.get('CINEISLE_UI_CAPTURE_DIR','.local/ui-captures'))
M=json.loads((D/'matrix.json').read_text())
assert M['modes'], 'Native capture discovery is empty'
def density(m):return json.loads((D/(m['name']+'-viewport.json')).read_text())['density']
def nodes(mode,scene):return json.loads((D/(mode+'-'+scene+'.json')).read_text())['nodes']
def box(n):return tuple(map(int,re.findall(r'-?\d+',n['bounds'])))
def texts(ns,label):return [n for n in ns if n.get('text')==label]
def contains(a,b):
 x,y,xx,yy=box(a);a,b,c,d=box(b);return x<=a<=c<=xx and y<=b<=d<=yy
def ancestor(ns,n,kind):
 while n.get('type')!=kind and n.get('parent') is not None:n=ns[n['parent']]
 return n if n.get('type')==kind else None
class Responsive(unittest.TestCase):
 def test_requested_native_window_and_font_are_applied(self):
  self.assertEqual({m['name'] for m in M['modes']},set(M['expectedModes']))
  for m in M['modes']:
   with self.subTest(mode=m['name']):
    v=json.loads((D/(m['name']+'-viewport.json')).read_text());r=v['window']['windowRect'];self.assertEqual((r['width'],r['height']),(round(m['width']*v['density']),round(m['height']*v['density'])));self.assertEqual(v['configurationFontScale'],m['font']/100);self.assertEqual(v['screenWidth']>v['screenHeight'],m['landscape'])
 def test_captures_have_real_pixels_and_match_display(self):
  for m in M['modes']:
   v=json.loads((D/(m['name']+'-viewport.json')).read_text())
   required={'home','more','more-library','libraries','movie-grid','movie','movie-actions','movie-metadata','series','seasons'}
   if m['name'] in ['small200','land200']:required.update({'quick-code','pin','movie-delete','favorites-controls','downloads-selected','recommend-selected'})
   if m['name']=='land200':required.add('login-footer')
   self.assertTrue(required.issubset(set(m['scenes'])), 'Final native discovery is incomplete')
   for scene in m['scenes']:
    with self.subTest(mode=m['name'],scene=scene):
     ns=nodes(m['name'],scene);self.assertGreater(len(ns),5);im=Image.open(D/(m['name']+'-'+scene+'.png'));self.assertEqual(im.size,(v['screenWidth'],v['screenHeight']));colors=im.convert('RGB').getcolors(100000);self.assertTrue(colors is None or len(colors)>8)
 def test_navigation_labels_and_icons_share_click_targets(self):
  for m in M['modes']:
   ns=nodes(m['name'],'more')
   for label in ['首页','推荐','演员','更多']:
    with self.subTest(mode=m['name'],label=label):
     t=next(t for t in texts(ns,label) if ancestor(ns,t,'Button'));b=ancestor(ns,t,'Button');self.assertTrue(contains(b,t));images=[n for n in ns if n['type']=='Image' and ancestor(ns,n,'Button')==b];self.assertEqual(len(images),1);self.assertTrue(contains(b,images[0]));self.assertAlmostEqual((box(t)[0]+box(t)[2])/2,(box(images[0])[0]+box(images[0])[2])/2,delta=1)
 def test_header_buttons_are_not_clipped(self):
  for m in M['modes']:
   ns=nodes(m['name'],'movie');b=next(n for n in ns if n.get('type')=='Button' and n.get('text')=='返回');self.assertGreaterEqual(box(b)[3]-box(b)[1],round(40*m['font']/100*density(m))-1)
 def test_more_library_caption_icon_and_hit_target(self):
  for m in M['modes']:
   if 'more-library' not in m['scenes']:continue
   ns=nodes(m['name'],'more-library');t=texts(ns,'媒体库')[-1];b=ancestor(ns,t,'Button');self.assertIsNotNone(b);self.assertTrue(contains(b,t));im=[n for n in ns if n['type']=='Image' and ancestor(ns,n,'Button')==b];self.assertEqual(len(im),1);self.assertTrue(contains(b,im[0]));self.assertAlmostEqual((box(b)[0]+box(b)[2])/2,(box(t)[0]+box(t)[2])/2,delta=1)
 def test_movie_and_series_routes_reach_details(self):
  for m in M['modes']:
   for scene,label in [('movie','光影之岛 · 电影视觉回归'),('series','潮汐之间 · 剧集视觉回归')]:
    with self.subTest(mode=m['name'],scene=scene):self.assertTrue(texts(nodes(m['name'],scene),label));self.assertTrue(texts(nodes(m['name'],scene),'返回'))
 def test_detail_actions_remain_inside_their_button(self):
  for m in M['modes']:
   ns=nodes(m['name'],'movie-actions');t=texts(ns,'预告片')[0];b=ancestor(ns,t,'Button');self.assertTrue(contains(b,t));self.assertGreaterEqual(box(t)[3]-box(t)[1],round(28*m['font']/100*density(m))-1)
 def test_metadata_lines_do_not_overlap(self):
  for m in M['modes']:
   ns=nodes(m['name'],'movie-metadata');rows=[n for n in ns if n['type']=='Text' and n.get('text') in ['700.0 MiB','H264 · 1920×1080 · 8 位','中文 · AAC · Stereo','English · SRT']];self.assertTrue(any(n.get('text')=='H264 · 1920×1080 · 8 位' for n in rows));rows.sort(key=lambda n:box(n)[1]);
   for a,b in zip(rows,rows[1:]):self.assertGreaterEqual(box(b)[1],box(a)[3])
 def test_short_landscape_preserves_video_and_scrollable_controls(self):
  for m in M['modes']:
   if 'player-options' not in m['scenes']:continue
   ns=nodes(m['name'],'player-options');video=[n for n in ns if n['type']=='XComponent'];self.assertEqual(len(video),1);self.assertGreaterEqual(box(video[0])[3]-box(video[0])[1],40*density(m));self.assertTrue(any(n['type']=='Scroll' for n in ns))
 def test_speed_selection_remains_reachable(self):
  for m in M['modes']:
   if 'speed-selected' not in m['scenes']:continue
   ns=nodes(m['name'],'speed-selected');b=texts(ns,'1.75×')[0];self.assertEqual(b.get('backgroundColor'),'#FF16776C')
 def test_filter_pages_retain_positive_media_viewport(self):
  for m in M['modes']:
   for scene,kind in [('favorites','Grid'),('downloads','List'),('actors','List')]:
    if scene not in m['scenes']:continue
    areas=[n for n in nodes(m['name'],scene) if n['type']==kind];self.assertTrue(areas);self.assertGreaterEqual(max(box(n)[3]-box(n)[1] for n in areas),18*density(m))
 def test_form_footer_buttons_can_be_scrolled_into_view(self):
  for m in M['modes']:
   for scene,label in [('settings-footer','保存 PIN'),('addresses-footer','移除服务器')]:
    if scene not in m['scenes']:continue
    ns=nodes(m['name'],scene);t=texts(ns,label)[0];b=ancestor(ns,t,'Button');self.assertTrue(contains(b,t));self.assertGreaterEqual(box(b)[3]-box(b)[1],round(40*m['font']/100*density(m))-1)
 def test_account_edit_form_starts_at_the_top(self):
  for m in M['modes']:
   if 'quick-code' not in m['scenes']:continue
   ns=nodes(m['name'],'addresses');t=texts(ns,'服务器名称与地址')[0];s=ancestor(ns,t,'Scroll');self.assertIsNotNone(s);self.assertLessEqual(abs(box(t)[1]-box(s)[1]),2*density(m));self.assertTrue(contains(s,t))
 def test_quick_code_displays_all_six_digits(self):
  for m in M['modes']:
   if 'quick-code' not in m['scenes']:continue
   ns=nodes(m['name'],'quick-code');t=texts(ns,'246810')[0];x,y,xx,yy=box(t);im=Image.open(D/(m['name']+'-quick-code.png')).convert('RGB');columns=[]
   for col in range(x,xx):
    ink=any((lambda rgb: rgb[1]>rgb[0]+30 and rgb[2]>rgb[0]+20)(im.getpixel((col,row))) for row in range(y,yy))
    if ink:columns.append(col)
   groups=[]
   for col in columns:
    if not groups or col>groups[-1][-1]+1:groups.append([])
    groups[-1].append(col)
   self.assertEqual(len(groups),6)
 def test_login_and_pin_actions_are_reachable(self):
  for m in M['modes']:
   for scene,label in [('pin','解锁映屿'),('login-footer','账户与服务器')]:
    if scene not in m['scenes']:continue
    ns=nodes(m['name'],scene);b=ancestor(ns,texts(ns,label)[-1],'Button');self.assertIsNotNone(b);self.assertGreaterEqual(box(b)[3]-box(b)[1],round(40*m['font']/100*density(m))-1)
 def test_zoomed_delete_caption_has_two_centered_lines(self):
  for m in M['modes']:
   if 'movie-delete' not in m['scenes']:continue
   ns=nodes(m['name'],'movie-delete');t=texts(ns,'删除服务器媒体')[0];b=ancestor(ns,t,'Button');self.assertTrue(contains(b,t));x,y,xx,yy=box(t);im=Image.open(D/(m['name']+'-movie-delete.png')).convert('RGB');lines=[]
   for row in range(y,yy):
    xs=[col for col in range(x,xx) if (lambda rgb: rgb[0]>240 and 120<rgb[1]<210 and abs(rgb[1]-rgb[2])<10)(im.getpixel((col,row)))]
    if xs:
     if not lines or row>lines[-1][-1][0]+1:lines.append([])
     lines[-1].append((row,min(xs),max(xs)))
   self.assertEqual(len(lines),2)
   for line in lines:self.assertAlmostEqual((min(p[1] for p in line)+max(p[2] for p in line))/2,(box(b)[0]+box(b)[2])/2,delta=2.5*density(m))
 def test_short_landscape_filters_show_complete_controls(self):
  m=next(m for m in M['modes'] if m['name']=='land200')
  ns=nodes('land200','actors');inputs=[n for n in ns if n['type']=='TextInput'];self.assertTrue(inputs);self.assertEqual(inputs[0]['bounds'],inputs[0]['origBounds']);self.assertGreaterEqual(box(inputs[0])[3]-box(inputs[0])[1],80*density(m)-1)
  for scene,label in [('recommend-selected','重温佳作'),('downloads-selected','已完成'),('favorites-controls','清除筛选')]:
   ns=nodes('land200',scene);b=ancestor(ns,texts(ns,label)[0],'Button');self.assertEqual(b['bounds'],b['origBounds']);self.assertGreaterEqual(box(b)[3]-box(b)[1],80*density(m)-1)
if __name__=='__main__':unittest.main(verbosity=2)

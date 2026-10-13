"""Read-only regressions over real native captures. Requires an explicit evidence directory.
Pixels/layouts from isolated QA are not video decode or real Jellyfin proof.
"""
import pathlib,json,re,os,unittest
from PIL import Image
D=pathlib.Path(os.environ.get('CINEISLE_UI_CAPTURE_DIR','.local/ui-captures'))
def nodes(name):return json.loads((D/(name+'.json')).read_text())['nodes']
def box(n):return tuple(map(int,re.findall(r'-?\d+',n['bounds'])))
def center(n):x,y,xx,yy=box(n);return (x+xx)/2,(y+yy)/2
def text(ns,value):return next(n for n in ns if n.get('text')==value)
def button(ns,n):
 while n.get('type')!='Button':n=ns[n['parent']]
 return n
def descendants(ns,parent):
 out=[]
 for n in ns:
  p=n['parent']
  while p is not None:
   if p==parent['index']:out.append(n);break
   p=ns[p]['parent']
 return out
def contains(outer,inner):
 a,b=box(outer),box(inner);return a[0]<=b[0]<=b[2]<=a[2] and a[1]<=b[1]<=b[3]<=a[3]
class Alignment(unittest.TestCase):
 def test_more_button_edges_and_height_match(self):
  ns=nodes('37-final-more');bs=[button(ns,text(ns,t)) for t in ['我的收藏','离线下载','媒体库','设置','同步媒体库','回传离线修改','账户与服务器','退出当前账户']]
  frames=[box(b) for b in bs];self.assertEqual(len(set((x,xx,yy-y) for x,y,xx,yy in frames)),1)
 def test_more_label_and_icon_inside_shared_target(self):
  ns=nodes('37-final-more');t=text(ns,'媒体库');b=button(ns,t);images=[n for n in descendants(ns,b) if n['type']=='Image'];self.assertEqual(len(images),1);self.assertTrue(contains(b,images[0]));self.assertTrue(contains(b,t));self.assertAlmostEqual(center(b)[0],center(t)[0],delta=1);self.assertAlmostEqual(center(b)[1],center(images[0])[1],delta=1)
 def test_icon_tap_navigates(self):self.assertIn('电影 · UI 测试',[n.get('text') for n in nodes('38-final-icon-click')])
 def test_four_nav_icons_centered_in_targets(self):
  ns=nodes('37-final-more');frames=[]
  for label in ['首页','推荐','演员','更多']:
   t=next(n for n in ns if n.get('text')==label and box(n)[1]>2400);b=button(ns,t);im=next(n for n in descendants(ns,b) if n['type']=='Image');self.assertTrue(contains(b,im));self.assertTrue(contains(b,t));self.assertAlmostEqual(center(im)[0],center(t)[0],delta=1);frames.append(box(b))
  self.assertLessEqual(max(b[2]-b[0] for b in frames)-min(b[2]-b[0] for b in frames),1)
 def test_movie_icons_and_captions_centered_and_contained(self):
  ns=nodes('42-final-movie')
  for label in ['从头播放','预告片','标为未观看','取消收藏','下载','删除服务器媒体']:
   t=text(ns,label);b=button(ns,t);im=next(n for n in descendants(ns,b) if n['type']=='Image');self.assertTrue(contains(b,t));self.assertTrue(contains(b,im));self.assertAlmostEqual(center(b)[0],center(t)[0],delta=1);self.assertAlmostEqual(center(b)[0],center(im)[0],delta=1)
 def test_wrapped_delete_lines_are_visually_centered(self):
  ns=nodes('42-final-movie');t=text(ns,'删除服务器媒体');b=button(ns,t);x,y,xx,yy=box(t);im=Image.open(D/'42-final-movie.png').convert('RGB');lines=[]
  for row in range(y,yy):
   xs=[col for col in range(x,xx) if im.getpixel((col,row))==(255,159,159)]
   if xs:
    if not lines or row>lines[-1][-1][0]+1:lines.append([])
    lines[-1].append((row,min(xs),max(xs)))
  self.assertEqual(len(lines),2)
  for line in lines:self.assertAlmostEqual((min(p[1] for p in line)+max(p[2] for p in line))/2,center(b)[0],delta=4)
 def test_detail_buttons_have_gaps(self):
  ns=nodes('42-final-movie');bs=[box(button(ns,text(ns,t))) for t in ['从头播放','预告片','标为未观看','取消收藏','下载','删除服务器媒体']]
  for a,b in zip(bs,bs[1:]):
   if a[1]==b[1]:self.assertGreaterEqual(b[0]-a[2],28)
 def test_settings_short_form_starts_below_header(self):
  ns=nodes('40-final-settings');heading=text(ns,'设置');first=text(ns,'离线模式（仅本账户缓存与已下载媒体）');self.assertLess(box(first)[1]-box(heading)[3],180)
 def test_all_speed_options_fully_visible_in_two_rows(self):
  ns=nodes('45-final-speeds');bs=[text(ns,t) for t in ['0.5×','0.75×','1×','1.25×','1.5×','1.75×','2×']];self.assertGreater(len(set(box(b)[1] for b in bs)),1)
  for b in bs:self.assertGreaterEqual(box(b)[0],0);self.assertLessEqual(box(b)[2],1280);self.assertGreaterEqual(box(b)[1],1500);self.assertLessEqual(box(b)[3],2405)
 def test_previously_hidden_speed_is_clickable(self):
  ns=nodes('46-final-speed-selected');b=text(ns,'1.75×');self.assertEqual(b.get('backgroundColor'),'#FF16776C')
 def test_metadata_values_do_not_overlap(self):
  ns=nodes('24-episode-metadata');bs=[box(text(ns,t)) for t in ['700.0 MiB','H264 · 1920×1080 · 8 位','中文 · AAC · Stereo','English · SRT']]
  for a,b in zip(bs,bs[1:]):self.assertGreater(b[1],a[3])
 def test_favorite_and_download_actions_stay_inside_page(self):
  for name in ['33-favorites','35-downloads']:
   for n in nodes(name):
    if n['type'] in ['Button','Select'] and n.get('visible')=='true':self.assertGreaterEqual(box(n)[0],0);self.assertLessEqual(box(n)[2],1280)
 def test_series_and_episode_are_correct_pages(self):
  self.assertIn('播放下一集',[n.get('text') for n in nodes('19-series-real')]);self.assertIn('批量下载本季',[n.get('text') for n in nodes('21-season')]);self.assertIn('岛屿的清晨',[n.get('text') for n in nodes('23-episode')])
 def test_biography_starts_at_top(self):
  ns=nodes('49-final-actor');heading=text(ns,'潮汐 · 演员测试');bio=text(ns,'隔离人物简介：用于验证演员作品先显示、标签证据和关注入口。');self.assertLess(box(bio)[1]-box(heading)[3],100)
 def test_recommendation_actor_and_account_controls_fit(self):
  for name in ['50-final-recommend','51-final-actors','53-final-accounts']:
   for n in nodes(name):
    if n['type'] in ['Button','Select','Checkbox'] and n.get('visible')=='true':self.assertGreaterEqual(box(n)[0],0);self.assertLessEqual(box(n)[2],1280)
 def test_final_sources_match(self):self.assertTrue(json.loads((D/'qa-source-match.json').read_text())['allMatch'])
if __name__=='__main__':unittest.main()

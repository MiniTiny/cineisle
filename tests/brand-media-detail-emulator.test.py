"""Real native PNG and layout gate; synthetic metadata is not real-server acceptance."""
import json,os,pathlib,re,unittest
from PIL import Image
D=pathlib.Path(os.environ.get('CINEISLE_UI_CAPTURE_DIR','.local/ui-captures'))
def nodes(name):return json.loads((D/(name+'.json')).read_text())['nodes']
def box(n):return tuple(map(int,re.findall(r'-?\d+',n['bounds'])))
def descendants(ns,parent):
 result=[]
 for n in ns:
  p=n['parent']
  while p is not None:
   if p==parent['index']:result.append(n);break
   p=ns[p]['parent']
 return result

def target(ns,label,kind='Button'):
 for t in ns:
  if t.get('text')!=label or t.get('visible')!='true':continue
  n=t
  while kind=='Button' and n['type']!='Button' and n['parent'] is not None:n=ns[n['parent']]
  if n['type']==kind and n.get('origBounds',n['bounds'])==n['bounds']:return n,t
 raise AssertionError('No complete '+kind+': '+label)
def contains(a,b):x,y,xx,yy=box(a);l,t,r,bb=box(b);return x<=l<=r<=xx and y<=t<=bb<=yy
class BrandMediaDetail(unittest.TestCase):
 @classmethod
 def setUpClass(cls):cls.modes=json.loads((D/'matrix.json').read_text())
 def complete(self,n):self.assertEqual(n.get('visible'),'true');self.assertEqual(n['bounds'],n.get('origBounds',n['bounds']))
 def test_actual_native_font_and_window_matrix(self):
  self.assertEqual({m['name'] for m in self.modes},{'small','normal','large','regular-large','land','land-large'})
  for m in self.modes:
   v=json.loads((D/(m['name']+'-viewport.json')).read_text());self.assertEqual(v['configurationFontScale'],m['font']/100)
   for k in ['width','height']:self.assertEqual(v['window']['windowRect'][k],round(m[k]*v['density']))
   for key in ['movie-hero','series-hero','season-batch']:
    ns=nodes(m['name']+'-'+key);roots=[n for n in ns if n['type']=='root'];expected=(round(m['width']*v['density']),round(m['height']*v['density']))
    self.assertTrue(any((box(n)[2]-box(n)[0],box(n)[3]-box(n)[1])==expected for n in roots),m['name']+' '+key+' actual window mismatch')
 def test_complete_icon_text_actions_share_native_targets(self):
  for m in self.modes:
   for key,label in [('movie-play','继续播放'),('movie-delete','删除服务器媒体'),('movie-source','兼容版本 · 720p'),('series-play','播放下一集'),('series-favorite','收藏'),('season-batch','批量下载本季'),('season-select','全选'),('season-download','下载')]:
    with self.subTest(mode=m['name'],key=key):
     ns=nodes(m['name']+'-'+key);b,t=target(ns,label);ims=[n for n in descendants(ns,b)if n['type']=='Image'];self.assertEqual(len(ims),1)
     for n in [b,t,*ims]:self.complete(n);self.assertTrue(contains(b,n))
     self.assertTrue(contains(ns[b['parent']],b));self.assertGreater(box(t)[0],box(ims[0])[2])
 def test_long_titles_are_complete_in_separate_scroll_content(self):
  for m in self.modes:
   for typ,label in [('movie','光影之岛 · 电影视觉回归'),('series','潮汐之间 · 剧集视觉回归')]:
    ns=nodes(m['name']+'-'+typ+'-hero');_,t=target(ns,label,'Text');self.complete(t)
    p=t['parent'];self.assertEqual(ns[p]['type'],'Column');self.assertTrue(any(n['type']=='Image'for n in descendants(ns,ns[p])))
 def test_group_headings_have_complete_original_badges(self):
  for m in self.modes:
   for key,label in [('movie-story','故事与资料'),('movie-specs','版本与规格'),('series-next','下一集'),('series-seasons','季度')]:
    ns=nodes(m['name']+'-'+key);_,t=target(ns,label,'Text');self.complete(t);ims=[n for n in descendants(ns,ns[t['parent']])if n['type']=='Image'];self.assertEqual(len(ims),1);self.complete(ims[0]);self.assertGreater(box(t)[0],box(ims[0])[2])
 def test_cast_entry_fits_scroll_and_routes_to_person(self):
  for m in self.modes:
   ns=nodes(m['name']+'-movie-cast');b,t=target(ns,'潮汐 · 演员测试');ims=[n for n in descendants(ns,b)if n['type']=='Image'];self.assertEqual(len(ims),2)
   for n in [b,t,*ims]:self.complete(n);self.assertTrue(contains(b,n))
   scroll=next(n for n in ns if n['type']=='Scroll');self.assertLessEqual(box(b)[3]-box(b)[1],box(scroll)[3]-box(scroll)[1])
   ns=nodes(m['name']+'-person-route');self.assertTrue(any(n.get('text')=='潮汐 · 演员测试'and n.get('visible')=='true'for n in ns));self.assertTrue(any(n.get('text') in ['关注','取消关注']for n in ns))
 def test_metadata_labels_and_values_are_complete_without_overlap(self):
  for m in self.modes:
   for label,value in [('音频','中文 · AAC · Stereo'),('字幕','English · SRT')]:
    found=False
    for p in D.glob(m['name']+'-movie-*.json'):
     ns=nodes(p.stem)
     for t in ns:
      if t.get('text')!=value or t.get('visible')!='true' or t.get('origBounds')!=t['bounds']:continue
      parent=ns[t['parent']];labels=[n for n in descendants(ns,parent)if n.get('text')==label and n.get('visible')=='true'and n.get('origBounds')==n['bounds']]
      if not labels:continue
      k=labels[0];self.complete(t);self.complete(k);self.assertTrue(contains(parent,t));self.assertTrue(contains(parent,k))
      if m['width']<400 or m['font']>100:self.assertLessEqual(box(k)[3],box(t)[1])
      else:self.assertLessEqual(box(k)[2],box(t)[0])
      found=True;break
     if found:break
    self.assertTrue(found,m['name']+' '+label+' missing complete metadata pair')
 def test_fixed_header_icon_targets_and_title_do_not_overlap(self):
  for m in self.modes:
   ns=nodes(m['name']+'-movie-hero');_,t=target(ns,'影像详情','Text');self.complete(t);header=ns[t['parent']];bs=[n for n in descendants(ns,header)if n['type']=='Button'];self.assertEqual(len(bs),2)
   v=json.loads((D/(m['name']+'-viewport.json')).read_text());density=v['density']
   for b in bs:self.complete(b);self.assertAlmostEqual((box(b)[2]-box(b)[0])/density,44,delta=1)
   self.assertLessEqual(box(bs[0])[2],box(t)[0]);self.assertLessEqual(box(t)[2],box(bs[1])[0])
 def test_primary_and_danger_colors_have_real_original_icon_pixels(self):
  for m in self.modes:
   for key,label,color in [('movie-play','继续播放',(141,232,210)),('movie-delete','删除服务器媒体',(255,159,159)),('series-play','播放下一集',(141,232,210))]:
    ns=nodes(m['name']+'-'+key);b,t=target(ns,label);im=Image.open(D/(m['name']+'-'+key+'.png')).convert('RGB');ims=[n for n in descendants(ns,b)if n['type']=='Image'];counts=sum(c for n in ims for c,rgb in im.crop(box(n)).getcolors(200000)or[] if rgb==color);self.assertGreater(counts,10)
    if key.endswith('play'):self.assertEqual(b['backgroundColor'],'#FF16776C')
    else:self.assertGreater(sum(c for c,rgb in im.crop(box(t)).getcolors(200000)or[] if rgb==color),10)
 def test_batch_selection_is_checked_and_download_target_enabled(self):
  for m in self.modes:
   ns=nodes(m['name']+'-season-download');b,_=target(ns,'下载');self.assertEqual(b['enabled'],'true')
   ns=nodes(m['name']+'-season-episode');checks=[n for n in ns if n['type']=='Checkbox'and n.get('visible')=='true'];self.assertTrue(checks)
   for n in checks:self.complete(n);self.assertEqual(n['checked'],'true')
 def test_real_source_and_flag_callbacks_change_selected_state(self):
  ns=nodes('interaction-source');b,_=target(ns,'兼容版本 · 720p');self.assertEqual(b['backgroundColor'],'#FF16776C')
  ns=nodes('interaction-favorite');b,_=target(ns,'收藏');self.assertEqual(b['backgroundColor'],'#FF162B35')
  ns=nodes('interaction-watched');b,_=target(ns,'标为已观看');self.assertEqual(b['backgroundColor'],'#FF162B35')
 def test_confirmation_buttons_use_brand_and_danger_pixels(self):
  for key,labels in [('download',[('取消',(141,232,210)),('下载',(141,232,210))]),('delete',[('取消',(141,232,210)),('删除服务器媒体',(255,159,159))])]:
   ns=nodes('interaction-'+key+'-dialog');im=Image.open(D/('interaction-'+key+'-dialog.png')).convert('RGB')
   for label,color in labels:
    texts=[n for n in ns if n.get('text')==label and n.get('visible')=='true'];self.assertTrue(texts)
    self.assertTrue(any(sum(c for c,rgb in im.crop(box(t)).getcolors(200000)or[] if rgb==color)>10 for t in texts),key+' '+label+' missing brand color')
 def test_next_episode_and_season_cards_keep_native_navigation(self):
  for name,title in [('interaction-season-route','第一季'),('interaction-next-route','岛屿的清晨')]:
   ns=nodes(name);self.assertTrue(any(n.get('text')==title and n.get('visible')=='true'for n in ns));self.assertTrue(any(n.get('text')=='影像详情'for n in ns))
 def test_download_and_delete_dialogs_are_cancelled_without_mutation(self):
  for key,title in [('download','通过 Wi-Fi 下载'),('delete','删除服务器媒体')]:
   ns=nodes('interaction-'+key+'-dialog');self.assertTrue(any(n.get('text')==title for n in ns));self.assertTrue(any(n.get('text')=='取消'for n in ns))
   ns=nodes('interaction-'+key+'-cancel');self.assertTrue(any(n.get('text')=='影像详情'for n in ns))
if __name__=='__main__':unittest.main()

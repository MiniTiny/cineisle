"""Native viewport/geometry/pixel gate; generated catalog is not real Jellyfin acceptance."""
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
class BrandDiscovery(unittest.TestCase):
 @classmethod
 def setUpClass(cls):cls.modes=json.loads((D/'matrix.json').read_text())
 def complete(self,n):self.assertEqual(n.get('visible'),'true');self.assertEqual(n['bounds'],n.get('origBounds',n['bounds']))
 def test_requested_size_and_actual_native_font(self):
  self.assertEqual({m['name'] for m in self.modes},{'small','normal','large','regular-large','land','land-large'})
  for m in self.modes:
   v=json.loads((D/(m['name']+'-viewport.json')).read_text());self.assertEqual(v['configurationFontScale'],m['font']/100);self.assertEqual(v['window']['windowRect']['width'],round(m['width']*v['density']));self.assertEqual(v['window']['windowRect']['height'],round(m['height']*v['density']))
 def test_original_icon_and_caption_share_complete_action_targets(self):
  for m in self.modes:
   for key,label in [('home-view-all','查看全部'),('discover','发现新片'),('rewatch','重温佳作'),('actor-tag','犯罪'),('follow','关注')]:
    with self.subTest(mode=m['name'],key=key):
     ns=nodes(m['name']+'-'+key);b,t=target(ns,label);ims=[n for n in descendants(ns,b)if n['type']=='Image'];self.assertEqual(len(ims),1)
     for n in [b,t,*ims]:self.complete(n);self.assertTrue(contains(b,n))
     self.assertTrue(contains(ns[b['parent']],b))
     self.assertGreater(box(t)[0],box(ims[0])[2])
 def test_home_group_titles_are_complete_and_separate_from_icons(self):
  for m in self.modes:
   for key,label in [('home-resume','继续观看'),('home-next','下一集')]:
    ns=nodes(m['name']+'-'+key);_,t=target(ns,label,'Text');self.complete(t)
    row=ns[t['parent']];ims=[n for n in descendants(ns,row)if n['type']=='Image'];self.assertEqual(len(ims),1);self.complete(ims[0]);self.assertGreater(box(t)[0],box(ims[0])[2])
 def test_actor_entry_is_native_button_with_avatar_and_direction(self):
  for m in self.modes:
   ns=nodes(m['name']+'-actor-person');b,t=target(ns,'潮汐 · 演员测试');ims=[n for n in descendants(ns,b)if n['type']=='Image'];self.assertEqual(len(ims),2)
   for n in [b,t,*ims]:self.complete(n);self.assertTrue(contains(b,n))
 def test_menus_have_complete_native_select_bounds_and_current_value(self):
  for m in self.modes:
   for key in ['actor-sort','credits']:
    ns=nodes(m['name']+'-'+key);ss=[n for n in ns if n['type']=='Select'and n.get('visible')=='true'];self.assertTrue(ss)
    for s in ss:self.complete(s);self.assertGreater(box(s)[2]-box(s)[0],300);self.assertTrue(s.get('text') or any(n.get('text') for n in descendants(ns,s)))
 def test_checkbox_labels_are_complete_in_scrollable_filters(self):
  for m in self.modes:
   ns=nodes(m['name']+'-actor-followed');t=next(n for n in ns if n.get('text')=='仅关注'and n.get('visible')=='true');self.complete(t)
   self.assertTrue(any(n['type']=='Checkbox'and n.get('visible')=='true'for n in ns))
 def test_selected_recommendation_and_original_icons_have_brand_pixels(self):
  for m in self.modes:
   for key,label in [('discover','发现新片'),('rewatch','重温佳作')]:
    ns=nodes(m['name']+'-'+key);b,_=target(ns,label);self.assertEqual(b.get('backgroundColor'),'#FF16776C')
    im=Image.open(D/(m['name']+'-'+key+'.png')).convert('RGB');count=0
    for n in descendants(ns,b):
     if n['type']=='Image':count+=sum(c for c,rgb in im.crop(box(n)).getcolors(200000)or[] if rgb==(141,232,210))
    self.assertGreater(count,10)
 def test_actor_detail_back_works_and_list_retains_primary_navigation(self):
  for m in self.modes:
   detail=nodes(m['name']+'-actor-detail');title=next(n for n in detail if n.get('text')=='潮汐 · 演员测试');self.complete(title)
   header=[n for n in detail if n['type']=='Button'and box(n)[1]<=box(title)[3]and box(n)[3]>=box(title)[1]];self.assertEqual(len(header),1);self.complete(header[0]);self.assertGreaterEqual(box(header[0])[2]-box(header[0])[0],150)
   ns=nodes(m['name']+'-actor-return');self.assertTrue(any(n.get('text')=='演员'for n in ns));self.assertTrue(any(n['type']=='List'for n in ns));self.assertTrue(any(n.get('text')=='首页'for n in ns))
 def test_follow_and_sort_real_native_callbacks_change_selected_state(self):
  ns=nodes('interaction-followed');b,_=target(ns,'取消关注');self.assertEqual(b['backgroundColor'],'#FF16776C')
  ns=nodes('interaction-sort-selected');self.assertTrue(any(n.get('text')=='姓名'and n.get('visible')=='true'for n in ns))
 def test_empty_short_landscape_keeps_mode_buttons_reachable(self):
  for name,label in [('empty-land-discover','发现新片'),('empty-land-rewatch','重温佳作')]:
   ns=nodes(name);b,t=target(ns,label);self.complete(b);self.complete(t);self.assertTrue(contains(b,t));self.assertEqual(b['backgroundColor'],'#FF16776C')
   grids=[n for n in ns if n['type']=='Grid'and n.get('visible')=='true'];self.assertTrue(grids);self.assertGreater(box(grids[0])[3]-box(grids[0])[1],280)
if __name__=='__main__':unittest.main()

"""Read-only checks of native CineIsle menu captures; never substitutes for server acceptance."""
import json, os, pathlib, re, unittest
from PIL import Image
D=pathlib.Path(os.environ.get('CINEISLE_UI_CAPTURE_DIR','.local/ui-captures'))
LABELS=['我的收藏','离线下载','媒体库','账户与服务器','设置','同步媒体库','回传离线修改','退出当前账户']
def read(name):return json.loads((D/(name+'.json')).read_text())['nodes']
def box(n):return tuple(map(int,re.findall(r'-?\d+',n['bounds'])))
def descendants(ns,parent):
 out=[]
 for n in ns:
  p=n['parent']
  while p is not None:
   if p==parent['index']:out.append(n);break
   p=ns[p]['parent']
 return out

def action(ns,label):
 t=next(n for n in ns if n.get('text')==label and n['type']=='Text' and n.get('visible')=='true')
 b=t
 while b['type']!='Button':b=ns[b['parent']]
 return b,t

def contains(a,b):x,y,xx,yy=box(a);l,t,r,bottom=box(b);return x<=l<=r<=xx and y<=t<=bottom<=yy
class MenuBrand(unittest.TestCase):
 @classmethod
 def setUpClass(cls):cls.modes=json.loads((D/'menu-matrix.json').read_text())
 def test_four_actual_viewport_and_font_combinations(self):
  self.assertEqual({m['name'] for m in self.modes},{'small100','small200','regular100','land200'})
  for m in self.modes:
   v=json.loads((D/(m['name']+'-viewport.json')).read_text());self.assertEqual(v['configurationFontScale'],m['font']/100)
   self.assertEqual(v['window']['windowRect']['width'],round(m['width']*v['density']));self.assertEqual(v['window']['windowRect']['height'],round(m['height']*v['density']))
 def test_every_full_action_has_icon_caption_and_chevron_in_one_button(self):
  for m in self.modes:
   for i,label in enumerate(LABELS):
    with self.subTest(mode=m['name'],label=label):
     ns=read(m['actions'][label]);b,t=action(ns,label);ims=[n for n in descendants(ns,b) if n['type']=='Image'];self.assertEqual(len(ims),2)
     for n in [b,t,*ims]:self.assertEqual(n['bounds'],n.get('origBounds',n['bounds']));self.assertEqual(n['visible'],'true')
     for n in [t,*ims]:self.assertTrue(contains(b,n))
     self.assertGreater(box(t)[0],box(ims[0])[2]);self.assertGreaterEqual(box(ims[1])[0],box(t)[2]);self.assertAlmostEqual((box(b)[1]+box(b)[3])/2,(box(ims[0])[1]+box(ims[0])[3])/2,delta=2)
 def test_action_shapes_are_painted_with_brand_accent_and_warm_logout(self):
  for m in self.modes:
   for i,label in enumerate(LABELS):
    name=m['actions'][label];ns=read(name);b,_=action(ns,label);im=next(n for n in descendants(ns,b) if n['type']=='Image');crop=Image.open(D/(name+'.png')).convert('RGB').crop(box(im));color=(244,207,139) if i==7 else (141,232,210)
    counts={c:count for count,c in crop.getcolors(crop.width*crop.height)}
    self.assertGreater(counts.get(color,0),15,(name,label))
 def test_home_shortcuts_keep_their_icons_and_do_not_overlap(self):
  for m in self.modes:
   bs=[]
   for label in LABELS[:2]:
    ns=read(m['home'][label]);b,t=action(ns,label);bs.append(b);ims=[n for n in descendants(ns,b) if n['type']=='Image'];self.assertEqual(len(ims),1);self.assertTrue(contains(b,ims[0]));self.assertTrue(contains(b,t));self.assertEqual(t['bounds'],t.get('origBounds',t['bounds']))
   if len(set(m['home'].values()))==1:
    a,b=map(box,bs);self.assertTrue(a[2]<=b[0] or a[3]<=b[1])
    if m['font']==200 or m['width']<360:self.assertGreaterEqual(b[1],a[3])
 def test_all_action_rows_share_leading_caption_alignment(self):
  for m in self.modes:
   frames=[]
   for i,label in enumerate(LABELS):
    ns=read(m['actions'][label]);b,t=action(ns,label);frames.append((box(b)[0],box(b)[2],box(t)[0]))
   self.assertEqual(len(set(frames)),1)
 def test_icon_taps_reach_destinations_and_logout_requires_confirmation(self):
  for name,label in [('favorites','我的收藏'),('downloads','离线下载'),('library','电影 · UI 测试'),('settings','设置'),('accounts','账户与服务器')]:self.assertIn(label,[n.get('text') for n in read('click-'+name)])
  ns=read('click-logout');self.assertIn('取消',[n.get('text') for n in ns]);self.assertIn('退出登录',[n.get('text') for n in ns]);self.assertIn('退出当前账户',[n.get('text') for n in read('click-logout-cancel')])
if __name__=='__main__':unittest.main(verbosity=2)

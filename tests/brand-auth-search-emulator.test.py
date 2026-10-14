"""Actual ArkUI hierarchy/PNG matrix. Local fixture login is not real Jellyfin authorization."""
import json,os,pathlib,re,unittest
from PIL import Image
D=pathlib.Path(os.environ.get('CINEISLE_UI_CAPTURE_DIR','.local/ui-captures'))
def nodes(name):return json.loads((D/(name+'.json')).read_text())['nodes']
def box(n):return tuple(map(int,re.findall(r'-?\d+',n['bounds'])))
def descendants(ns,p):
 result=[]
 for n in ns:
  parent=n['parent']
  while parent is not None:
   if parent==p['index']:result.append(n);break
   parent=ns[parent]['parent']
 return result

def target(ns,label,kind='Button'):
 for t in ns:
  if label not in [t.get('text'),t.get('description'),t.get('hint')]or t.get('visible')!='true':continue
  n=t
  while kind=='Button'and n['type']!='Button'and n['parent']is not None:n=ns[n['parent']]
  if n['type']==kind and n.get('origBounds',n['bounds'])==n['bounds']:return n,t
 raise AssertionError('No complete '+kind+': '+label)
def contains(a,b):x,y,r,bb=box(a);l,t,rr,bottom=box(b);return x<=l<=rr<=r and y<=t<=bottom<=bb
class BrandAuthSearch(unittest.TestCase):
 @classmethod
 def setUpClass(cls):cls.modes=json.loads((D/'matrix.json').read_text())
 def complete(self,n):self.assertEqual(n.get('visible'),'true');self.assertEqual(n['bounds'],n.get('origBounds',n['bounds']))
 def test_actual_window_font_on_each_page(self):
  self.assertEqual({m['name']for m in self.modes},{'small','normal','large','regular-large','land','land-large'})
  for m in self.modes:
   v=json.loads((D/(m['name']+'-viewport.json')).read_text());self.assertEqual(v['configurationFontScale'],m['font']/100)
   for k in ['width','height']:self.assertEqual(v['window']['windowRect'][k],round(m[k]*v['density']))
   for key in ['login-top','quick-start','search-form']:
    roots=[n for n in nodes(m['name']+'-'+key)if n['type']=='root'];self.assertTrue(any((box(n)[2]-box(n)[0],box(n)[3]-box(n)[1])==(round(m['width']*v['density']),round(m['height']*v['density']))for n in roots),m['name']+key)
 def test_login_alternative_and_search_button_icons_inside_full_targets(self):
  for m in self.modes:
   for key,label in [('login-action','连接并登录'),('login-quick','Quick Connect 登录'),('login-accounts','账户与服务器'),('quick-start','Quick Connect 登录'),('quick-check','我已授权，检查登录'),('quick-cancel','取消'),('search-action','搜索'),('search-history','光影'),('search-close','关闭搜索')]:
    with self.subTest(mode=m['name'],key=key):
     ns=nodes(m['name']+'-'+key);b,t=target(ns,label);ims=[n for n in descendants(ns,b)if n['type']=='Image'];self.assertEqual(len(ims),1)
     for n in [b,t,*ims]:self.complete(n);self.assertTrue(contains(b,n))
     self.assertTrue(contains(ns[b['parent']],b));self.assertGreaterEqual(box(t)[0],box(ims[0])[2])
 def test_login_fields_are_reachable_with_persistent_captions(self):
  for m in self.modes:
   for key,label in [('login-username','用户名'),('login-password','密码')]:
    ns=nodes(m['name']+'-'+key);n,_=target(ns,label,'TextInput');self.complete(n);self.assertTrue(any(t.get('text')==label for t in ns));self.assertEqual(n.get('enabled'),'true')
 def test_login_title_is_complete_and_not_fixed_in_an_image(self):
  for m in self.modes:
   ns=nodes(m['name']+'-login-top');_,t=target(ns,'映屿 · CineIsle','Text');self.complete(t);self.assertEqual(ns[t['parent']]['type'],'Column')
 def test_pairing_code_and_restart_after_cancel(self):
  for m in self.modes:
   for key in ['quick-code','quick-waiting']:
    ns=nodes(m['name']+'-'+key);_,t=target(ns,'246810','Text');self.complete(t);im=Image.open(D/(m['name']+'-'+key+'.png')).convert('RGB');self.assertGreater(sum(c for c,rgb in im.crop(box(t)).getcolors(200000)or[]if rgb==(141,232,210)),10)
   ns=nodes(m['name']+'-quick-restart');self.assertFalse(any(n.get('text')=='246810'for n in ns));b,_=target(ns,'Quick Connect 登录');self.assertEqual(b['enabled'],'true');self.assertEqual(b['backgroundColor'],'#FF16776C')
 def test_password_fallback_from_quick_entry_keeps_original_form(self):
  for m in self.modes:
   ns=nodes(m['name']+'-quick-password-route');target(ns,'密码','TextInput');self.assertTrue(any(n.get('text')=='账户与服务器'and n.get('visible')=='true'and ns[n['parent']]['type']=='Row'for n in ns))
 def test_real_primary_color_and_original_icon_pixels(self):
  for m in self.modes:
   for key,label in [('quick-start','Quick Connect 登录'),('search-action','搜索')]:
    ns=nodes(m['name']+'-'+key);b,_=target(ns,label);self.assertEqual(b['backgroundColor'],'#FF16776C');im=Image.open(D/(m['name']+'-'+key+'.png')).convert('RGB');ims=[n for n in descendants(ns,b)if n['type']=='Image'];self.assertGreater(sum(c for n in ims for c,rgb in im.crop(box(n)).getcolors(200000)or[]if rgb==(141,232,210)),10)
 def test_search_results_and_empty_state_scroll_in_same_grid(self):
  for m in self.modes:
   for key,label in [('search-result','光影之岛 · 电影视觉回归'),('search-empty','暂无媒体')]:
    ns=nodes(m['name']+'-'+key);_,t=target(ns,label,'Text');self.complete(t);p=t
    while p['type']!='Grid'and p['parent']is not None:p=ns[p['parent']]
    self.assertEqual(p['type'],'Grid');self.assertTrue(contains(p,t))
 def test_search_close_returns_home_and_dismisses_form(self):
  for m in self.modes:
   ns=nodes(m['name']+'-search-home');self.assertTrue(any(n.get('text')=='首页'and n.get('visible')=='true'and ns[n['parent']]['type']=='Row'for n in ns));self.assertFalse(any(n.get('text')=='关闭搜索'for n in ns))
 def test_keyboard_back_preserves_query_and_submit_unobscures_native_navigation(self):
  ns=nodes('interaction-search-keyboard-back');self.assertTrue(any(n['type']=='TextInput'and n.get('text')=='光影'for n in ns));target(ns,'关闭搜索')
  for key in ['interaction-search-keyboard-back','interaction-search-submit-no-keyboard']:
   ns=nodes(key);nav=next(n for n in ns if n['type']=='Row'and len([c for c in ns if c['parent']==n['index']and c['type']=='Button'])==4);self.complete(nav);im=Image.open(D/(key+'.png')).convert('RGB');crop=im.crop(box(nav));colors=crop.getcolors(crop.width*crop.height)or[];self.assertGreater(sum(count for count,rgb in colors if all(v<90 for v in rgb))/(crop.width*crop.height),.7,key+' native navigation still covered by keyboard')
 def test_pairing_header_fixed_back_target_and_no_overlap(self):
  for m in self.modes:
   ns=nodes(m['name']+'-quick-start');titles=[n for n in ns if n.get('text')=='配对登录'and n.get('visible')=='true'];t=min(titles,key=lambda n:box(n)[1]);header=ns[t['parent']];bs=[n for n in descendants(ns,header)if n['type']=='Button'];self.assertEqual(len(bs),1);b=bs[0];self.complete(b);self.complete(t);v=json.loads((D/(m['name']+'-viewport.json')).read_text());self.assertAlmostEqual((box(b)[2]-box(b)[0])/v['density'],44,delta=1);self.assertLessEqual(box(b)[2],box(t)[0]);self.assertLessEqual((box(t)[3]-box(t)[1])/v['density'],32*m['font']/100)
if __name__=='__main__':unittest.main()

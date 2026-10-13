"""Read-only native account/settings captures. Synthetic UI evidence is not live Jellyfin proof."""
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
 t=next(n for n in ns if n.get('text')==label and n['type']=='Text' and n.get('visible')=='true')
 b=t
 while b['type']!='Button':b=ns[b['parent']]
 return b,t

def contains(a,b):x,y,xx,yy=box(a);l,t,r,bottom=box(b);return x<=l<=r<=xx and y<=t<=bottom<=yy
class BrandForms(unittest.TestCase):
 @classmethod
 def setUpClass(cls):cls.modes=json.loads((D/'forms-matrix.json').read_text())
 def test_three_actual_native_viewport_and_font_modes(self):
  self.assertEqual({m['name']for m in self.modes},{'normal','large','land'})
  for m in self.modes:
   v=json.loads((D/(m['name']+'-viewport.json')).read_text());self.assertEqual(v['configurationFontScale'],m['font']/100);self.assertEqual(v['window']['windowRect']['width'],round(m['width']*v['density']));self.assertEqual(v['window']['windowRect']['height'],round(m['height']*v['density']))
 def test_key_actions_have_complete_shared_icon_and_caption_targets(self):
  pairs=[('account-actions','移除账户'),('server-actions','管理地址'),('credentials','重置账户存储'),('address-save','保存'),('address-remove','移除服务器'),('quick-button','Quick Connect 登录'),('save-server','仅保存服务器'),('download-preference','清除版本偏好'),('pin-save','保存 PIN')]
  for m in self.modes:
   for key,label in pairs:
    with self.subTest(mode=m['name'],action=label):
     ns=nodes(m['frames'][key]);b,t=button(ns,label);ims=[n for n in descendants(ns,b)if n['type']=='Image'];self.assertEqual(len(ims),1)
     for n in [b,t,ims[0]]:self.assertEqual(n['bounds'],n.get('origBounds',n['bounds']));self.assertEqual(n['visible'],'true')
     self.assertTrue(contains(b,t));self.assertTrue(contains(b,ims[0]));self.assertGreater(box(t)[0],box(ims[0])[2])
 def test_headers_use_a_complete_original_back_target_and_readable_title(self):
  for m in self.modes:
   for key,title in [('accounts','账户与服务器'),('settings','设置')]:
    ns=nodes(m['frames'][key]);heading=next(n for n in ns if n.get('text')==title and n['type']=='Text');self.assertEqual(heading['bounds'],heading.get('origBounds',heading['bounds']));back=next(n for n in ns if n['type']=='Button'and any(v['type']=='Image'for v in descendants(ns,n)));self.assertEqual(back['bounds'],back.get('origBounds',back['bounds']));self.assertGreaterEqual(box(back)[2]-box(back)[0],150)
 def test_account_and_server_cards_show_their_distinct_brand_symbols(self):
  for m in self.modes:
   for key in ['accounts','server-actions']:
    name=m['frames'][key];ns=nodes(name);painted=0
    for im in (n for n in ns if n['type']=='Image' and n.get('visible')=='true' and n['bounds']==n.get('origBounds',n['bounds'])):
     crop=Image.open(D/(name+'.png')).convert('RGB').crop(box(im));counts={c:count for count,c in crop.getcolors(max(1,crop.width*crop.height))};painted+=counts.get((141,232,210),0)
    self.assertGreater(painted,20)
 def test_destructive_credentials_action_uses_coral_icon_and_caption(self):
  for m in self.modes:
   name=m['frames']['address-remove'];ns=nodes(name);b,t=button(ns,'移除服务器');im=next(n for n in descendants(ns,b)if n['type']=='Image');image=Image.open(D/(name+'.png')).convert('RGB')
   for n in [im,t]:
    crop=image.crop(box(n));counts={c:count for count,c in crop.getcolors(crop.width*crop.height)};self.assertGreater(counts.get((255,159,159),0),15)
 def test_settings_have_separate_browsing_download_and_pin_sections(self):
  for m in self.modes:
   ns=nodes(m['frames']['settings']);self.assertIn('浏览与离线',[n.get('text')for n in ns]);self.assertTrue(any(n['type']=='Checkbox'for n in ns));pin=nodes(m['frames']['pin-save']);self.assertTrue(any(n['type']=='TextInput'for n in pin))
 def test_interactions_preserve_account_and_address_confirmation(self):
  self.assertIn('当前账户',[n.get('text')for n in nodes('interaction-switch')]);self.assertIn('测试账户甲',[n.get('text')for n in nodes('interaction-switch')]);self.assertIn('取消',[n.get('text')for n in nodes('interaction-remove-account')]);self.assertIn('取消',[n.get('text')for n in nodes('interaction-remove-server')]);self.assertIn('CineIsle-UI-Island',[n.get('text')for n in nodes('interaction-address-saved')])
 def test_native_preference_and_pin_controls_persist_and_unlock(self):
  ns=nodes('interaction-preferences-restored');checks=[n for n in ns if n['type']=='Checkbox'];self.assertTrue(any(n.get('checked')=='true'for n in checks));self.assertIn('立即锁定',[n.get('text')for n in nodes('interaction-pin-enabled')]);self.assertIn('解锁映屿',[n.get('text')for n in nodes('interaction-pin-locked')]);self.assertIn('关闭应用锁',[n.get('text')for n in nodes('interaction-pin-unlocked')])
 def test_quick_code_fits_the_new_group_and_can_be_cancelled(self):
  ns=nodes('interaction-quick-code');t=next(n for n in ns if re.fullmatch(r'\d{6}',n.get('text','')));self.assertEqual(t['bounds'],t.get('origBounds',t['bounds']));self.assertIn('我已授权，检查登录',[n.get('text')for n in ns]);self.assertFalse(any(re.fullmatch(r'\d{6}',n.get('text',''))for n in nodes('interaction-quick-cancel')))
if __name__=='__main__':unittest.main(verbosity=2)

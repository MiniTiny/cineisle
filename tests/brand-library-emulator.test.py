"""Read native synthetic-media captures. Geometry proof excludes actual download/decoding."""
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

def button(ns,label):
 t=next(n for n in ns if n.get('text')==label and n.get('visible')=='true')
 b=t
 while b['type']!='Button':b=ns[b['parent']]
 return b,t

def contains(a,b):x,y,xx,yy=box(a);l,t,r,bb=box(b);return x<=l<=r<=xx and y<=t<=bb<=yy
class BrandLibrary(unittest.TestCase):
 @classmethod
 def setUpClass(cls):cls.modes=json.loads((D/'library-matrix.json').read_text())
 def test_actual_font_and_window_matrix(self):
  self.assertEqual({m['name']for m in self.modes},{'normal','large','land'})
  for m in self.modes:
   v=json.loads((D/(m['name']+'-viewport.json')).read_text());self.assertEqual(v['configurationFontScale'],m['font']/100);self.assertEqual(v['window']['windowRect']['width'],round(m['width']*v['density']));self.assertEqual(v['window']['windowRect']['height'],round(m['height']*v['density']))
 def test_filter_and_category_actions_have_complete_icon_and_text_targets(self):
  for m in self.modes:
   for key,label in [('favorite-clear','清除筛选'),('favorite-select','多选'),('favorite-all','全选'),('favorite-remove','取消所选收藏'),('download-active','进行中'),('download-complete','已完成'),('download-failed','需处理')]:
    with self.subTest(mode=m['name'],label=label):
     ns=nodes(m['frames'][key]);b,t=button(ns,label);images=[n for n in descendants(ns,b)if n['type']=='Image'];self.assertEqual(len(images),1)
     for n in [b,t,images[0]]:self.assertEqual(n['bounds'],n.get('origBounds',n['bounds']));self.assertEqual(n['visible'],'true');self.assertTrue(contains(b,n))
     self.assertGreater(box(t)[0],box(images[0])[2])
     if m['name']=='normal'and key.startswith('download-'):self.assertLess(box(t)[3]-box(t)[1],80)
 def test_favorite_selection_enables_confirmed_destructive_action(self):
  for m in self.modes:
   ns=nodes(m['frames']['favorite-selected']);b,t=button(ns,'取消所选收藏');self.assertEqual(b['enabled'],'true');self.assertTrue(any('已选择 2 项'in n.get('text','')for n in ns));confirm=nodes(m['name']+'-favorite-confirm');self.assertTrue(any('取消'==n.get('text')for n in confirm));self.assertTrue(any('确认'==n.get('text')for n in confirm))
 def test_empty_download_card_belongs_to_scrollable_list(self):
  for m in self.modes:
   ns=nodes(m['frames']['downloads-empty']);t=next(n for n in ns if n.get('text')=='暂无下载，可在电影或单集详情中下载');self.assertEqual(t['bounds'],t.get('origBounds',t['bounds']));self.assertEqual(t['visible'],'true');p=t['parent'];types=[]
   while p is not None:types.append(ns[p]['type']);p=ns[p]['parent']
   self.assertIn('List',types)
 def test_library_buttons_contain_type_icon_caption_and_direction(self):
  for m in self.modes:
   for name in [m['frames']['libraries'],m['name']+'-library-series-entry']:
    ns=nodes(name)
    label='电影 · UI 测试' if name==m['frames']['libraries'] else '剧集 · UI 测试';b,t=button(ns,label);images=[n for n in descendants(ns,b)if n['type']=='Image'];self.assertEqual(len(images),2)
    for n in [b,t,*images]:self.assertEqual(n['bounds'],n.get('origBounds',n['bounds']));self.assertTrue(contains(b,n))
 def test_library_content_has_one_title_and_preserves_grid_and_navigation(self):
  for m in self.modes:
   for key,title in [('library-movies','电影 · UI 测试'),('library-series','剧集 · UI 测试')]:
    ns=nodes(m['frames'][key]);titles=[n for n in ns if n.get('text')==title];self.assertEqual(len(titles),1);self.assertEqual(titles[0]['bounds'],titles[0].get('origBounds',titles[0]['bounds']));header=[n for n in ns if n['type']=='Button' and box(n)[1]<=box(titles[0])[3] and box(n)[3]>=box(titles[0])[1]];self.assertEqual(len(header),3);self.assertTrue(any(n['type']=='Grid'and n.get('visible')=='true'for n in ns));self.assertTrue(any(n.get('text')=='更多'for n in ns))
 def test_original_symbols_render_brand_colors(self):
  for m in self.modes:
   for key,color in [('libraries',(141,232,210)),('favorite-selected',(255,159,159))]:
    name=m['frames'][key];image=Image.open(D/(name+'.png')).convert('RGB');ns=nodes(name);count=0
    for n in ns:
     if n['type']=='Image'and n.get('visible')=='true':
      crop=image.crop(box(n));count+=sum(c for c,rgb in crop.getcolors(max(1,crop.width*crop.height))or[] if rgb==color)
    self.assertGreater(count,15)
 def test_library_directory_back_and_system_back_follow_parent_hierarchy(self):
  for m in self.modes:
   ns=nodes(m['frames']['libraries']);title=next(n for n in ns if n.get('text')=='媒体库');buttons=[n for n in ns if n['type']=='Button'and box(n)[1]<=box(title)[3]and box(n)[3]>=box(title)[1]];self.assertEqual(len(buttons),3);back=min(buttons,key=lambda n:box(n)[0]);self.assertEqual(back['bounds'],back.get('origBounds',back['bounds']));self.assertGreaterEqual(box(back)[2]-box(back)[0],150)
   for suffix,label in [('library-back-more','更多'),('library-back-directory','媒体库'),('library-system-back-directory','媒体库'),('library-system-back-more','更多')]:
    captured=nodes(m['name']+'-'+suffix);titles=[]
    for n in captured:
     if n.get('text')!=label or n['type']!='Text':continue
     parent=n['parent'];inside=False
     while parent is not None:
      if captured[parent]['type']=='Button':inside=True;break
      parent=captured[parent]['parent']
     if not inside:titles.append(n)
    self.assertEqual(len(titles),1)
 def test_status_rows_and_actions_are_complete_at_all_modes(self):
  for m in self.modes:
   confirm=nodes(m['name']+'-download-confirm');self.assertTrue(any(n.get('text')=='取消'for n in confirm))
   for suffix,label in [('download-stop','停止下载'),('download-play','播放'),('download-retry','重试'),('download-remove','移除下载')]:
    ns=nodes(m['name']+'-'+suffix);b,t=button(ns,label);images=[n for n in descendants(ns,b)if n['type']=='Image'];self.assertEqual(len(images),1)
    for n in [b,t,*images]:self.assertEqual(n['bounds'],n.get('origBounds',n['bounds']));self.assertTrue(contains(b,n))
if __name__=='__main__':unittest.main()

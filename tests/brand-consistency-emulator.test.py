"""Native screenshot/hierarchy audit. Synthetic data is not real Jellyfin acceptance."""
import json, os, pathlib, re, unittest
from PIL import Image
D = pathlib.Path(os.environ.get('CINEISLE_UI_CAPTURE_DIR', '.local/ui-captures'))
def box(n): return tuple(map(int, re.findall(r'-?\d+', n['bounds'])))
def nodes(name): return json.loads((D/(name+'.json')).read_text())['nodes']
def descendants(ns, parent):
    result=[]
    for n in ns:
        p=n['parent']
        while p is not None:
            if p==parent['index']: result.append(n); break
            p=ns[p]['parent']
    return result
def contains(a,b):
    l,t,r,bottom=box(a); x,y,xx,yy=box(b)
    return l<=x<=xx<=r and t<=y<=yy<=bottom

def target(ns,label,kind):
    modal=[n for n in ns if n.get('id')=='CineIsleCompactDialog'] or [n for n in ns if n['type'] in ['AlertDialog','Dialog','CustomDialog']]
    candidates=descendants(ns,modal[-1]) if modal else ns
    for t in candidates:
        if label not in [t.get('text'),t.get('description'),t.get('hint')] or t.get('visible')!='true':continue
        n=t
        while kind=='Button' and n['type']!='Button' and n['parent'] is not None:n=ns[n['parent']]
        if n['type']==kind and n.get('origBounds',n['bounds'])==n['bounds']:return n,t
    raise AssertionError('No complete '+kind+': '+label)

def colors(name,region):
    im=Image.open(D/(name+'.png')).convert('RGB').crop(box(region))
    return im.getcolors(im.width*im.height) or []

def colored(pixels,palette,tolerance=5):
    return sum(count for count,c in pixels if any(max(abs(c[i]-p[i]) for i in range(3))<=tolerance for p in palette))

class BrandConsistency(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.modes=json.loads((D/'matrix.json').read_text())
        cls.frames=json.loads((D/'frames.json').read_text())
    def complete(self,n):
        self.assertEqual(n.get('visible'),'true');self.assertEqual(n['bounds'],n.get('origBounds',n['bounds']))
        l,t,r,b=box(n);self.assertGreater(r-l,0);self.assertGreater(b-t,0)
    def test_actual_three_window_and_font_modes(self):
        self.assertEqual({m['name']for m in self.modes},{'normal','large','land'})
        for m in self.modes:
            v=json.loads((D/(m['name']+'-viewport.json')).read_text())
            self.assertEqual(v['configurationFontScale'],m['font']/100)
            for key in ['width','height']:self.assertEqual(v['window']['windowRect'][key],round(m[key]*v['density']))
            for f in [f for f in self.frames if f['mode']==m['name']]:
                rs=[n for n in nodes(f['name']) if n['type']=='root']
                self.assertTrue(any((box(n)[2]-box(n)[0],box(n)[3]-box(n)[1])==(round(m['width']*v['density']),round(m['height']*v['density']))for n in rs),f['name'])
    def test_expected_page_and_popup_coverage(self):
        required={'home','more','accounts','addresses','settings','settings-pin','download-empty','download-action','download-retry','favorite-type','favorite-popup','favorite-selected','movie','series','season','episode','actor-detail','actors','recommend','library','library-items','quick','quick-code','player','player-source-popup','pin-action','login-action','search-empty'}
        required|={'home-empty','recommend-empty','actors-empty','library-empty','favorite-empty','actor-credits-empty','series-empty','season-empty','native-loading'}
        dialogs={'logout-dialog','account-dialog','server-dialog','reset-dialog','download-dialog','favorite-dialog','download-confirm','delete-dialog','batch-dialog','reason-dialog'}
        for m in self.modes:
            actual={f['name'].removeprefix(m['name']+'-')for f in self.frames if f['mode']==m['name']}
            self.assertFalse((required|dialogs)-actual,(m['name'],sorted((required|dialogs)-actual)))
    def test_every_collected_target_is_complete(self):
        for f in self.frames:
            with self.subTest(frame=f['name']):
                ns=nodes(f['name']);n,t=target(ns,f['label'],f['kind']);self.complete(n);self.complete(t);self.assertTrue(contains(n,t))
    def test_action_icon_and_caption_share_full_click_target(self):
        for f in self.frames:
            if f['category']!='action' or f['kind']!='Button':continue
            with self.subTest(frame=f['name']):
                ns=nodes(f['name']);b,t=target(ns,f['label'],'Button');images=[n for n in descendants(ns,b)if n['type']=='Image']
                self.assertTrue(images)
                for n in images:self.complete(n);self.assertTrue(contains(b,n))
                self.assertTrue(contains(ns[b['parent']],b));self.assertGreaterEqual(box(t)[0],box(images[0])[2])
    def test_native_confirmation_has_both_complete_actions_and_brand_palette(self):
        for f in self.frames:
            if f['category']!='dialog':continue
            with self.subTest(frame=f['name']):
                ns=nodes(f['name']);d=next((n for n in ns if n.get('id')=='CineIsleCompactDialog'),None)or next(n for n in ns if n['type'] in ['AlertDialog','Dialog','CustomDialog']);bs=[n for n in descendants(ns,d)if n['type']=='Button']
                self.assertEqual(len(bs),2)
                title=next(n for n in descendants(ns,d)if n['type']=='Text')
                self.complete(title);self.assertTrue(contains(d,title))
                if d.get('id')=='CineIsleCompactDialog':
                    scroll=next(n for n in descendants(ns,d) if n['type']=='Scroll')
                    density=json.loads((D/(f['mode']+'-viewport.json')).read_text())['density']
                    self.assertGreaterEqual((box(scroll)[3]-box(scroll)[1])/density,44)
                for b in bs:
                    self.complete(b)
                    for t in descendants(ns,b):
                        if t['type']=='Text':self.complete(t);self.assertTrue(contains(b,t))
                pixels=colors(f['name'],d);self.assertGreater(colored(pixels,[(19,35,46)]),100)
                self.assertGreater(colored(pixels,[(141,232,210)]),20)
                if f['name'].endswith(('download-confirm','batch-dialog')):self.assertEqual(colored(pixels,[(255,159,159)]),0)
                else:self.assertGreater(colored(pixels,[(255,159,159)]),20)
    def test_notice_title_action_and_palette_are_complete(self):
        for f in self.frames:
            if f['category']!='notice':continue
            with self.subTest(frame=f['name']):
                ns=nodes(f['name']);d=next((n for n in ns if n.get('id')=='CineIsleCompactDialog'),None)or next(n for n in ns if n['type'] in ['AlertDialog','Dialog','CustomDialog'])
                title=next(n for n in descendants(ns,d)if n['type']=='Text');self.complete(title);self.assertTrue(contains(d,title))
                bs=[n for n in descendants(ns,d)if n['type']=='Button'];self.assertEqual(len(bs),1)
                b,t=target(ns,f['label'],'Button');self.complete(b);self.complete(t);self.assertTrue(contains(b,t))
                pixels=colors(f['name'],d);self.assertGreater(colored(pixels,[(19,35,46)]),100);self.assertGreater(colored(pixels,[(141,232,210)]),20)

    def test_native_choice_popups_have_surface_and_selected_colors(self):
        for f in self.frames:
            if f['category']!='popup':continue
            with self.subTest(frame=f['name']):
                ns=nodes(f['name']);_,t=target(ns,f['label'],'Text');root=next(n for n in ns if n['type']=='root');pixels=colors(f['name'],root)
                self.assertGreater(colored(pixels,[(22,43,53)]),100)
                self.assertGreater(colored(pixels,[(24,63,59)]),100)
                self.assertGreater(colored(pixels,[(141,232,210)]),20);self.complete(t)
    def test_empty_and_loading_states_belong_to_the_content_scroll(self):
        samples=[f for f in self.frames if f['category'] in ['empty','loading']]
        self.assertTrue(any(f['category']=='loading'for f in samples));self.assertTrue(any(f['category']=='empty'for f in samples))
        for f in samples:
            ns=nodes(f['name']);_,t=target(ns,f['label'],'Text');parent=t['parent'];types=[]
            while parent is not None:types.append(ns[parent]['type']);parent=ns[parent]['parent']
            self.assertTrue(any(k in types for k in ['List','Grid','Scroll']),f['name'])
            state=ns[t['parent']]
            if f['category']=='loading':
                spinner=next(n for n in descendants(ns,state) if n['type']=='LoadingProgress')
                self.complete(spinner)
                pixels=colors(f['name'],spinner)
                self.assertGreater(sum(c for c,p in pixels if p[1]-p[0]>30 and p[1]-p[2]>6 and p[1]>70),5)
            else:
                icons=[n for n in descendants(ns,state)if n['type']=='Image'];self.assertTrue(icons,f['name'])
                for icon in icons:self.complete(icon);self.assertTrue(contains(state,icon))
                self.assertGreater(colored(colors(f['name'],state),[(141,232,210),(244,207,139)]),10)
    def test_fixed_headers_leave_the_scroll_below_them(self):
        keys={'accounts','settings','favorite-type','movie','episode','actor-detail','quick','addresses'}
        for f in self.frames:
            key=f['name'].removeprefix(f['mode']+'-')
            if key not in keys:continue
            ns=nodes(f['name']);scrolls=[n for n in ns if n['type']in ['Grid','Scroll','List']and n.get('visible')=='true']
            self.assertTrue(scrolls)
            # The fixed header is the first row with a direct back button and title.
            for row in ns:
                if row['type']!='Row':continue
                children=[n for n in ns if n['parent']==row['index']]
                if not(any(n['type']=='Button'for n in children)and any(n['type']=='Text'for n in children)):continue
                if not any(n['type']=='Image'for n in descendants(ns,row)):continue
                self.complete(row)
                for t in children:
                    if t['type']=='Text':self.complete(t);self.assertTrue(contains(row,t))
                self.assertGreaterEqual(min(box(n)[1]for n in scrolls),box(row)[3]);break
    def test_large_font_and_landscape_button_growth_is_real(self):
        heights={}
        for m in self.modes:
            ns=nodes(m['name']+'-pin-action');b,_=target(ns,'解锁映屿','Button');heights[m['name']]=(box(b)[3]-box(b)[1])/json.loads((D/(m['name']+'-viewport.json')).read_text())['density']
        self.assertGreater(heights['large'],heights['normal']);self.assertGreaterEqual(heights['land'],heights['large']-1)

if __name__=='__main__':unittest.main()

"""Read-only acceptance checks over native QA captures and local fixture routes.
Requires an explicit capture directory; synthetic fixture evidence is not real Jellyfin acceptance.
"""
import json, os, pathlib, re, unittest
D=pathlib.Path(os.environ.get('CINEISLE_UI_CAPTURE_DIR','.local/ui-captures'))
def nodes(name):return json.loads((D/(name+'.json')).read_text())['nodes']
def texts(name):return [n.get('text','') for n in nodes(name)]
def home(name, expected):
 t=texts(name);assert expected in t
 assert all('专属电影' not in x or x==expected for x in t)
class AccountsNative(unittest.TestCase):
 def test_first_native_login(self):home('04-alice-home','测试账户甲 · 岛 A专属电影')
 def test_second_account_isolation(self):home('09-bob-home','测试账户乙 · 岛 A专属电影')
 def test_native_asset_cold_start(self):home('10-bob-cold','测试账户乙 · 岛 A专属电影')
 def test_switch_without_password(self):home('13-alice-switched','测试账户甲 · 岛 A专属电影')
 def test_saved_accounts(self):self.assertTrue({'测试账户甲','测试账户乙','当前账户'}<=set(texts('12-two-accounts')))
 def test_short_list_starts_at_top(self):
  title=next(n for n in nodes('12-two-accounts') if n.get('text')=='账户与服务器')
  button=next(n for n in nodes('12-two-accounts') if n.get('text')=='添加账户或服务器')
  bottom=int(re.findall(r'\d+',title['bounds'])[3]);top=int(re.findall(r'\d+',button['bounds'])[1]);self.assertLess(top-bottom,150)
 def test_second_server_same_user_id_isolation(self):home('16-carol-home','测试账户丙 · 岛 B专属电影')
 def test_three_accounts_and_two_servers(self):self.assertTrue({'测试账户甲','测试账户乙','测试账户丙','映屿测试岛 A','映屿测试岛 B'}<=set(texts('17-three-accounts')))
 def test_return_to_first_server(self):home('18-alice-return','测试账户甲 · 岛 A专属电影')
 def test_addresses_saved(self):self.assertIn('映屿测试岛 A',texts('21-addresses-saved'))
 def test_primary_outage_recovers(self):home('22-failover-home','测试账户甲 · 岛 A专属电影')
 def test_failover_cold_restore(self):home('23-failover-cold','测试账户甲 · 岛 A专属电影')
 def test_disabled_quick_connect(self):self.assertIn('服务器未启用 Quick Connect，请使用账户密码登录',texts('26-quick-disabled'))
 def test_quick_pending(self):self.assertTrue(any(re.fullmatch(r'\d{6}',x) for x in texts('27-quick-pending')))
 def test_cancel_quick_clears_code(self):self.assertFalse(any(re.fullmatch(r'\d{6}',x) for x in texts('28-quick-cancelled')))
 def test_server_expiry(self):self.assertIn('Quick Connect 代码已失效，请重新获取',texts('30-quick-expired'))
 def test_native_quick_authorized_login(self):home('32-quick-bob-home','测试账户乙 · 岛 A专属电影')
 def test_final_cold_restore(self):home('33-quick-bob-cold','测试账户乙 · 岛 A专属电影')
 def test_identity_probe_never_sends_token_to_wrong_server(self):
  r=json.loads((D.parent/'fixture-routes.json').read_text())['routes'];wrong=[x for x in r if x['address']=='wrong'];self.assertTrue(wrong);self.assertTrue(all(x['path']=='/System/Info/Public' and not x['tokenPresent'] for x in wrong))
 def test_native_user_validation_and_quick_exchange(self):
  r=json.loads((D.parent/'fixture-routes.json').read_text())['routes'];self.assertTrue(any(x['path']=='/Users/Me' for x in r));self.assertTrue(any(x['path']=='/Users/AuthenticateWithQuickConnect' and x['method']=='POST' for x in r))
 def test_renamed_server_refreshes_all_account_cards(self):
  t=texts('37-rename-result');self.assertEqual(t.count('CineIsleRenamedA'),2);self.assertNotIn('CineIsleTestA',t)
 def test_pairing_secret_never_reaches_native_layout(self):
  for p in D.glob('*.json'):
   if p.name=='qa-source-match.json':continue
   data=p.read_text();self.assertNotIn('fixture-secret-',data);self.assertNotIn('fixture-a-',data);self.assertNotIn('fixture-pass',data)
 def test_legacy_quick_connect_native(self):home('41-B-quick-home','测试账户丙 · 岛 B专属电影')
 def test_legacy_quick_connect_method(self):
  r=json.loads((D.parent/'fixture-routes.json').read_text())['routes'];self.assertTrue(any(x['address']=='b' and x['path']=='/QuickConnect/Initiate' and x['method']=='GET' for x in r))
 def test_final_package_account_switch(self):home('43-final-alice-switched','测试账户甲 · 岛 A专属电影')
 def test_final_package_cold_restore(self):home('44-final-alice-cold','测试账户甲 · 岛 A专属电影')
 def test_sources_identical(self):self.assertTrue(json.loads((D/'qa-source-match.json').read_text())['allMatch'])
if __name__=='__main__':unittest.main()

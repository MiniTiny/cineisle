#!/usr/bin/env python3
"""Prepare an isolated native viewport harness; product pages/assets are copied unchanged."""
import argparse, hashlib, json, pathlib, shutil
parser=argparse.ArgumentParser();parser.add_argument('directory');args=parser.parse_args()
root=pathlib.Path(__file__).resolve().parent.parent;out=pathlib.Path(args.directory).resolve()
if out==root or root in out.parents: raise SystemExit('Use a separate temporary project directory')
out.mkdir(parents=True,exist_ok=True)
for name in ('AppScope','entry/src','hvigor'):
 shutil.copytree(root/name,out/name,dirs_exist_ok=True)
for name in ('build-profile.json5','hvigorfile.ts','oh-package.json5','oh-package-lock.json5','entry/build-profile.json5','entry/hvigorfile.ts','entry/oh-package.json5'):
 if (root/name).exists(): shutil.copy2(root/name,out/name)
# Reuse the local dependency installation, without putting signing files into the checkout.
if not (out/'oh_modules').exists() and (root/'oh_modules').exists(): (out/'oh_modules').symlink_to(root/'oh_modules',target_is_directory=True)
p=out/'AppScope/app.json5';j=json.loads(p.read_text());j['app']['bundleName']='com.cineisle.visualqa';p.write_text(json.dumps(j,ensure_ascii=False,indent=2))
p=out/'entry/src/main/module.json5';j=json.loads(p.read_text());j['module']['abilities'].append({'name':'ResponsiveAbility','srcEntry':'./ets/entryability/ResponsiveAbility.ets','exported':True,'launchType':'singleton','startWindowIcon':'$media:app_icon','startWindowBackground':'$color:start_window_background'});p.write_text(json.dumps(j,ensure_ascii=False,indent=2))
p=out/'entry/src/main/resources/base/profile/main_pages.json';j=json.loads(p.read_text());j['src'].append('pages/ResponsiveBackdrop');p.write_text(json.dumps(j,indent=2))
for name,relative in [('ResponsiveAbility.ets','entry/src/main/ets/entryability'),('ResponsiveBackdrop.ets','entry/src/main/ets/pages')]: shutil.copy2(root/'tests/fixtures/responsive'/name,out/relative/name)
files=[p for p in (root/'entry/src/main/ets').rglob('*') if p.is_file()]+[p for p in (root/'entry/src/main/resources').rglob('*') if p.is_file() and p.name!='main_pages.json']
matches=[{'file':str(p.relative_to(root)),'sha256':hashlib.sha256(p.read_bytes()).hexdigest(),'matches':p.read_bytes()==(out/p.relative_to(root)).read_bytes()} for p in files]
(out/'responsive-source-match.json').write_text(json.dumps({'allMatched':all(x['matches'] for x in matches),'count':len(matches),'files':matches,'differences':['QA bundle name','extra diagnostic Ability/page registration','diagnostic Ability/page source']},indent=2))
print('QA source/resource equality:',len(matches),'files;',all(x['matches'] for x in matches))

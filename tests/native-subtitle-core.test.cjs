const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {spawnSync}=require('node:child_process');
const {coreExecutable,directory}=require('./native-entry-build.cjs').build({core:true});
const font=path.join(directory,'core-font.fixture');fs.writeFileSync(font,'explicit fixture; not a native font');
const result=spawnSync(coreExecutable,[font],{encoding:'utf8'});
assert.equal(result.status,0,result.stderr||result.error?.message);
process.stdout.write(result.stdout);

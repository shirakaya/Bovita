const { buildSync } = require('esbuild');
const { mkdtempSync, rmSync } = require('node:fs');
const { tmpdir } = require('node:os');
const { join, resolve } = require('node:path');
const { spawnSync } = require('node:child_process');
const work = mkdtempSync(join(tmpdir(), 'float-identity-test-'));
try {
    const runtime = join(work, 'runtime.cjs');
    buildSync({stdin:{contents:`export * as scope from './lib/identity-scope'; export * as kv from './lib/kv-db'; export * as chat from './lib/chat-storage'; export * as memory from './lib/memory-storage'; export * as settings from './lib/settings-storage'; export * as inbox from './lib/identity-push-inbox'; export * as data from './lib/data-management/idb';`,resolveDir:resolve(__dirname,'../..')},bundle:true,format:'cjs',platform:'browser',outfile:runtime});
    const result=spawnSync(process.execPath,[join(__dirname,'identity-isolation.cjs')],{stdio:'inherit',env:{...process.env,IDENTITY_TEST_RUNTIME:runtime}});
    process.exitCode=result.status ?? 1;
} finally { rmSync(work,{recursive:true,force:true}); }

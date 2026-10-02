const { buildSync } = require('esbuild');
const assert = require('node:assert/strict');
const { mkdtempSync, rmSync } = require('node:fs');
const { tmpdir } = require('node:os');
const { join, resolve } = require('node:path');
require('fake-indexeddb/auto');
const work = mkdtempSync(join(tmpdir(), 'float-diary-test-'));
class Storage {
  data = new Map();
  getItem(key) { return this.data.get(key) ?? null; }
  setItem(key, value) { this.data.set(key, String(value)); }
  removeItem(key) { this.data.delete(key); }
  key(index) { return [...this.data.keys()][index] ?? null; }
  get length() { return this.data.size; }
}
global.localStorage = new Storage();
global.sessionStorage = new Storage();
global.window = new EventTarget();
global.document = { addEventListener() {}, visibilityState: 'visible' };
(async () => {
  const runtime = join(work, 'runtime.cjs');
  buildSync({ stdin: { contents: `export * from './lib/diary-entry-storage'; export * from './lib/diary-entry-types'; export {loadNativeTimeline} from './lib/short-term-assembler'; export {hydrateKvDb, kvSet} from './lib/kv-db';`, resolveDir: resolve(__dirname, '../..') }, bundle: true, format: 'cjs', platform: 'node', outfile: runtime });
  const api = require(runtime);
  await api.hydrateKvDb();
  const draft = { characterId: api.USER_DIARY_BOOK_ID, characterName: '用户', authorType: 'user', title: '日记', body: '私密内容', blocks: [] };
  const privateEntry = api.createDiaryEntry(draft);
  const shared = api.createDiaryEntry({ ...draft, body: '共享内容', visibleToCharacterIds: ['A', 'B'] });
  const old = api.normalizeDiaryEntry({ ...draft, id: 'legacy', authorType: undefined, characterId: 'A' });
  api.saveDiaryEntries([...api.loadDiaryEntries(), old]);
  const diaries = id => api.loadNativeTimeline(id).filter(item => item.sourceDetail === 'diary_entry');
  assert.equal(diaries('A').some(item => item.id === privateEntry.id), false);
  assert.equal(diaries('A').find(item => item.id === shared.id).authorType, 'user');
  assert.equal(diaries('B').some(item => item.id === shared.id), true);
  assert.equal(diaries('C').length, 0);
  assert.equal(diaries('B').some(item => item.id === 'legacy'), false);
  const longBody = Array.from({length: 30}, (_, i) => `第${i}段` + '字'.repeat(110)).join('\n\n');
  api.updateUserDiaryEntry(shared.id, { title: '已修改', body: longBody, visibleToCharacterIds: ['B'] });
  let loaded = api.loadDiaryEntries().find(item => item.id === shared.id);
  assert.equal(loaded.body, longBody);
  assert.equal(loaded.blocks[0].text, longBody);
  assert.equal(loaded.createdAt, shared.createdAt);
  assert.equal(diaries('A').some(item => item.id === shared.id), false);
  assert.equal(diaries('B').some(item => item.id === shared.id), true);
  api.updateUserDiaryEntry(shared.id, { title: '私密', body: longBody, visibleToCharacterIds: [] });
  assert.equal(diaries('B').some(item => item.id === shared.id), false);
  assert.throws(() => api.updateUserDiaryEntry('legacy', { title: '覆盖', body: '覆盖' }));
  api.deleteDiaryEntry(shared.id);
  assert.equal(api.loadDiaryEntries().some(item => item.id === shared.id), false);
  console.log('PASS: private/shared recipients, legacy ownership, user attribution, full-text persistence, edit/revoke/delete');
})().catch(error => { console.error(error); process.exitCode = 1; }).finally(() => { rmSync(work, {recursive: true, force: true}); });

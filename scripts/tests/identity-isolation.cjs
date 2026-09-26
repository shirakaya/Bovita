// npm run test:identity — isolated browser runtimes over a shared IndexedDB factory.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const { indexedDB, IDBKeyRange } = require('fake-indexeddb');
const bundle = fs.readFileSync(process.env.IDENTITY_TEST_RUNTIME, 'utf8');
class Storage {
    values = new Map();
    getItem(key) { return this.values.get(key) ?? null; }
    setItem(key, value) { this.values.set(key, String(value)); }
    removeItem(key) { this.values.delete(key); }
    key(i) { return [...this.values.keys()][i] ?? null; }
    get length() { return this.values.size; }
}
const localStorage = new Storage();
const sessionStorage = new Storage();
let reloads = 0;
const pages = [];
function page() {
    const timers = new Set();
    const window = new EventTarget();
    const context = { console, queueMicrotask, process: {env:{}}, indexedDB, IDBKeyRange, localStorage, sessionStorage, window,
        Event, EventTarget, CustomEvent, DOMException, Blob, Headers, URL, URLSearchParams,
        TextEncoder, TextDecoder, AbortController, structuredClone, crypto: require('node:crypto').webcrypto,
        navigator: { userAgent: 'isolation-test' }, location: { reload() { reloads++; } },
        setTimeout, clearTimeout, setInterval(fn, ms) { const t = setInterval(fn, ms); t.unref(); timers.add(t); return t; }, clearInterval,
        document: { createElement() { return {}; }, visibilityState: 'visible', addEventListener() {}, removeEventListener() {} },
        fetch() { throw new Error('Tests must not call external APIs'); }, module: { exports: {} }, exports: {} };
    Object.assign(window, context);
    context.exports = context.module.exports;
    vm.runInNewContext(bundle, context);
    pages.push(context);
    return context.module.exports;
}
async function seed() {
    const db = await new Promise((resolve, reject) => {
        const req = indexedDB.open('AiPhoneKvDB', 10);
        req.onupgradeneeded = () => req.result.createObjectStore('entries', {keyPath:'key'});
        req.onsuccess = () => resolve(req.result); req.onerror = () => reject(req.error);
    });
    const rows = {
        ai_phone_user_identities_v1: [{id:'A',name:'用户A'},{id:'B',name:'用户B'}],
        ai_phone_bindings_v1: {globalDefaults:{userIdentityId:'A'},characterBindings:[],appDefaults:{}},
        ai_phone_characters_v1: [{id:'same-character',name:'测试角色'}],
        ai_phone_mem_evt_count_same: '7',
        ai_phone_friend_requests_v1: [{id:'old-request'}],
        ai_phone_diary_entries_v1: [{id:'old-diary'}],
    };
    const tx=db.transaction('entries','readwrite');
    for (const [key,value] of Object.entries(rows)) tx.objectStore('entries').put({key,value: typeof value==='string'?value:JSON.stringify(value)});
    await new Promise((resolve,reject)=>{tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error);}); db.close();
}
(async () => {
    await seed();
    const a=page(); await a.kv.hydrateKvDb(); assert.equal(a.kv.isKvHydrated(),true);
    assert.equal(a.scope.getRuntimeIdentityId(),'A'); assert.equal(a.scope.identityStorageName('AiPhoneChatDB'),'AiPhoneChatDB');
    await a.chat.hydrateChatStorage(); a.chat.addChatContact('same-character');
    const as=a.chat.createOrGetSession('same-character');
    a.chat.pushChatMessage({sessionId:as.id,role:'user',content:'A PRIVATE',status:'sent'});
    await a.memory.saveMemoryEntry({id:'memory-a',characterId:'same-character',type:'long_term',sourceApp:'chat',content:'A SECRET',importance:1,createdAt:'2026-01-01',updatedAt:'2026-01-01'});
    await a.settings.selectGlobalUserIdentity('B'); assert.equal(reloads,1);
    assert.equal(a.scope.getRuntimeIdentityId(),'A','old tasks retain A scope');
    // Completion after selecting B still belongs to A.
    await a.memory.saveMemoryEntry({id:'late-a',characterId:'same-character',type:'core',sourceApp:'chat',content:'A ASYNC',importance:1,createdAt:'2026-01-02',updatedAt:'2026-01-02'});
    const b=page(); await b.kv.hydrateKvDb(); await b.chat.hydrateChatStorage();
    assert.equal(b.scope.getRuntimeIdentityId(),'B'); assert.equal(b.chat.loadChatContacts().length,0); assert.equal(b.chat.loadChatSessions().length,0);
    assert.equal((await b.memory.loadMemoryEntries('same-character')).length,0);
    assert.equal(b.kv.kvGet('ai_phone_friend_requests_v1'),null); assert.equal(b.kv.kvGet('ai_phone_diary_entries_v1'),null);
    assert.equal(b.kv.kvGet('ai_phone_mem_evt_count_same'),null); assert.ok(b.kv.kvGet('ai_phone_characters_v1'));
    b.chat.addChatContact('same-character'); const bs=b.chat.createOrGetSession('same-character'); assert.notEqual(as.id,bs.id);
    b.chat.pushChatMessage({sessionId:bs.id,role:'user',content:'B PRIVATE',status:'sent'});
    await b.kv.kvSetAsync('ai_phone_friend_requests_v1','[{"id":"B-request"}]');
    await b.kv.kvSetAsync('ai_phone_notewall_events_same','["B-only"]');
    assert.equal(b.kv.kvKeysWithPrefix('ai_phone_notewall_').length,1);
    b.memory.incrementEventCounter('same'); assert.equal(b.memory.getEventCounter('same'),1);
    const mixed=[{id:'out-a',meta:{identityId:'A'},raw_text:'A reply',created_at:'2026-01-01'}, {id:'out-b',meta:{identityId:'B'},raw_text:'B reply',created_at:'2026-01-02'}, {id:'out-legacy',meta:{},raw_text:'old A reply',created_at:'2025-01-01'}];
    assert.equal((await b.inbox.stashIdentityPushEntries(mixed)).length,3);
    assert.equal((await b.inbox.loadIdentityPushEntries(20)).map(x=>x.id).join(','),'out-b');
    await b.inbox.removeIdentityPushEntries(['out-b']);
    await b.settings.selectGlobalUserIdentity('A'); assert.equal(reloads,2);
    const a2=page(); await a2.kv.hydrateKvDb(); await a2.chat.hydrateChatStorage();
    assert.equal(a2.chat.loadChatSessions().length,1); assert.equal(a2.chat.loadChatSessions()[0].id,as.id);
    assert.equal(a2.chat.loadChatMessages(as.id)[0].content,'A PRIVATE'); assert.equal((await a2.memory.loadMemoryEntries('same-character')).length,2);
    assert.equal(a2.memory.getEventCounter('same'),7); assert.equal(a2.kv.kvKeysWithPrefix('ai_phone_notewall_').length,0);
    assert.equal(JSON.parse(a2.kv.kvGet('ai_phone_friend_requests_v1'))[0].id,'old-request');
    assert.equal((await a2.inbox.loadIdentityPushEntries(20)).map(x=>x.id).join(','),'out-legacy,out-a');
    const backupRows=await a2.kv.readIdentityKvEntries(); assert.ok(!backupRows.some(row=>row.value.includes('B-only')));
    await a2.settings.selectGlobalUserIdentity('B');
    const b2=page(); await b2.kv.hydrateKvDb(); await b2.chat.hydrateChatStorage();
    assert.equal(b2.chat.loadChatSessions()[0].id,bs.id); assert.equal(b2.chat.loadChatMessages(bs.id)[0].content,'B PRIVATE');
    assert.equal((await b2.inbox.loadIdentityPushEntries(20)).length,0);
    const source={type:'kv',keys:['ai_phone_friend_requests_v1']};
    const exported=await b2.data.exportSource(source);
    assert.ok(exported.records[0].value.includes('B-request'));
    await b2.data.clearSource(source);
    assert.equal(b2.kv.kvGet('ai_phone_friend_requests_v1'),null);
    await b2.settings.selectGlobalUserIdentity('A');
    const a3=page();await a3.kv.hydrateKvDb();
    assert.equal(JSON.parse(a3.kv.kvGet('ai_phone_friend_requests_v1'))[0].id,'old-request','clearing B must not delete A');
    // A lost localStorage marker must recover from the durable manifest and reload,
    // never make another identity silently inherit the legacy database.
    localStorage.removeItem('ai_phone_identity_scope_v1');
    const lost=page();await lost.kv.hydrateKvDb();assert.equal(lost.kv.isKvHydrated(),false);
    const recovered=page();await recovered.kv.hydrateKvDb();assert.equal(recovered.scope.getRuntimeIdentityId(),'A');
    console.log('PASS: legacy ownership; shared definitions; A/B contacts, sessions, messages, memory, counters, diary and requests; async completion; repeat switching; push inbox routing; backup view.');
})().catch(error=>{console.error(error);process.exitCode=1;});

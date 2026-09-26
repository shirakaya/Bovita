import Dexie from "dexie";
import { getRuntimeIdentityId, getLegacyIdentityId, identityStorageName, identityStorageNameFor } from "./identity-scope";
import { kvGet } from "./kv-db";
import type { OutboxEntry } from "./push-outbox-client";

class InboxDatabase extends Dexie {
    entries!: Dexie.Table<OutboxEntry, string>;
    constructor(name: string) { super(name); this.version(1).stores({ entries: "id, created_at" }); }
}
const inbox = new InboxDatabase(identityStorageName("AiPhonePushInboxDB"));
function ownerOf(entry: OutboxEntry): string | null {
    const meta = entry.meta as (NonNullable<OutboxEntry["meta"]> & { reply?: { identityId?: string }; ruleId?: string }) | null;
    const explicit = meta?.identityId || meta?.reply?.identityId;
    if (explicit) return explicit;
    if (meta?.ruleId) {
        const owners = JSON.parse(kvGet("identity_bridge_owners_v1") || "{}");
        if (owners[meta.ruleId]) return owners[meta.ruleId];
    }
    return getLegacyIdentityId();
}
/** Only acknowledge a server row after it is durably stored in its owner's inbox.
 * Draining other users' rows prevents the server's 20-row page from blocking us. */
export async function stashIdentityPushEntries(entries: OutboxEntry[]): Promise<string[]> {
    const grouped = new Map<string, OutboxEntry[]>();
    for (const entry of entries) {
        const owner = ownerOf(entry);
        if (!owner) continue;
        const name = identityStorageNameFor("AiPhonePushInboxDB", owner);
        const rows = grouped.get(name) ?? [];
        rows.push(entry); grouped.set(name, rows);
    }
    const saved: string[] = [];
    for (const [name, rows] of grouped) {
        const db = name === inbox.name ? inbox : new InboxDatabase(name);
        try { await db.entries.bulkPut(rows); saved.push(...rows.map(row => row.id)); }
        finally { if (db !== inbox) db.close(); }
    }
    return saved;
}
export function loadIdentityPushEntries(limit: number): Promise<OutboxEntry[]> {
    if (!getRuntimeIdentityId()) return Promise.resolve([]);
    return inbox.entries.orderBy("created_at").limit(limit).toArray();
}
export async function removeIdentityPushEntries(ids: string[]): Promise<void> { await inbox.entries.bulkDelete(ids); }

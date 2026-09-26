/** Storage ownership is fixed for the lifetime of a page, including async tasks.
 * Switching the existing global identity reloads the page into another namespace.
 * The first identity retains the original database names and legacy data. */
export const IDENTITY_SCOPE_KEY = "ai_phone_identity_scope_v1";
export const IDENTITY_SWITCHING_EVENT = "ai-phone-identity-switching";
type ScopeState = { legacyIdentityId: string; activeIdentityId: string };

function readState(): ScopeState | null {
    if (typeof window === "undefined") return null;
    try {
        const value = JSON.parse(localStorage.getItem(IDENTITY_SCOPE_KEY) || "null");
        return value?.legacyIdentityId && value?.activeIdentityId ? value : null;
    } catch { return null; }
}
let runtimeState = readState();
let switching = false;
export function getRuntimeIdentityId(): string | null { return runtimeState?.activeIdentityId ?? null; }
export function isLegacyIdentityScope(): boolean {
    return !runtimeState || runtimeState.activeIdentityId === runtimeState.legacyIdentityId;
}
export function isIdentitySwitching(): boolean { return switching; }
export function getLegacyIdentityId(): string | null { return runtimeState?.legacyIdentityId ?? null; }
export function identityStorageNameFor(name: string, identityId: string): string {
    return identityId === runtimeState?.legacyIdentityId ? name : `${name}__identity_${encodeURIComponent(identityId)}`;
}
export function identityStorageName(name: string): string {
    return isLegacyIdentityScope() ? name : `${name}__identity_${encodeURIComponent(runtimeState!.activeIdentityId)}`;
}

export function identityLocalKey(key: string): string {
    return isIdentityPrivateKey(key) ? identityStorageName(key) : key;
}
/** Maps persisted localStorage keys to the current user's logical key list. */
export function logicalIdentityLocalKey(key: string): string | null {
    if (key === IDENTITY_SCOPE_KEY || key.startsWith("kv__identity_")) return null;
    const marker = "__identity_";
    const pos = key.indexOf(marker);
    if (pos >= 0) {
        return !isLegacyIdentityScope() && key.slice(pos + marker.length) === encodeURIComponent(getRuntimeIdentityId()!) ? key.slice(0, pos) : null;
    }
    return !isLegacyIdentityScope() && isIdentityPrivateKey(key) ? null : key;
}

export const IDENTITY_DATABASES = new Set([
    "AiPhoneChatDB", "ai_phone_memory_db_v1", "AiPhoneMomentsDB", "AiPhoneStoryDB",
    "AiPhoneVnDB", "AiPhoneMapDB", "AiPhoneCheckPhoneDB", "AiPhoneDwellingDB",
    "AiPhoneQaDB", "AiPhoneMascotDB", "reading-db", "AiPhonePushInboxDB",
]);
export function resolveIdentityDatabase(name: string): string {
    return IDENTITY_DATABASES.has(name) ? identityStorageName(name) : name;
}

// Definitions and assets remain shared. Generated records and scheduling state
// (including every source read by short-term-assembler) belong to the user.
const PRIVATE_PREFIXES = [
    "ai_phone_cloud_backup_state_", "ai_phone_mem_", "ai_phone_chat_offline_", "ai_phone_removed_contacts",
    "ai_phone_followup_", "ai_phone_timed_wake_", "ai_phone_idle_reconnect_",
    "ai_phone_friend_requests", "ai_phone_moments_ai_", "ai_phone_moments_pending_",
    "ai_phone_moments_last_seen", "ai_phone_diary_entries", "ai_phone_diary_entry_timer",
    "ai_phone_notewall_", "note_wall_events_", "ai_phone_note_wall_",
    "ai_phone_xiaohongshu_", "xiaohongshu_events_", "checkphone:",
    "ai_phone_interview_magazine_issues", "ai_phone_interview_magazine_drafts", "ai_phone_interview_magazine_events_",
    "ai_phone_cocreate_session", "ai_phone_cocreate_library", "ai_phone_cocreate_events_",
    "ai_phone_black_market_", "ai_phone_game_state", "ai_phone_game_hall_drafts",
    "ai_phone_wallet_", "ai_phone_shopping_", "ai_phone_calendar_plans", "ai_phone_menstrual_",
    "ai_phone_reality_bridge_", "screen_chat_ack_", "ai_phone_custom_app_data_", "ai_phone_custom_app_timeline_",
    "chat-generating:", "pending_reply_", "chat-offline-mode:", "chat-theater-mode:",
    "chat_plugin_vars_", "chat_plugin_data_", "chat_plugin_errors_",
    "map_adventure_summary_", "mixology_sessions_", "mixology_profile_",
    "ai_phone_custom_app_notifications_", "ai_phone_custom_app_badges_", "ai_phone_custom_app_tasks_", "ai_phone_custom_app_suggestions_",
    "push_bridge_", "ai_phone_call_invite_", "weixin_cloud_sync_",
];
export function isIdentityPrivateKey(key: string): boolean {
    return PRIVATE_PREFIXES.some(prefix => key.startsWith(prefix));
}

/** Run after shared KV hydration, before mounting the application. */
export function initializeIdentityScope(defaultIdentityId: string | null, savedState?: string | null): void {
    if (typeof window === "undefined" || !defaultIdentityId) return;
    let persisted = readState();
    if (!persisted && savedState) {
        try { const value = JSON.parse(savedState); if (value?.legacyIdentityId && value?.activeIdentityId) persisted = value; } catch { /* first run */ }
    }
    if (!persisted) {
        runtimeState = { legacyIdentityId: defaultIdentityId, activeIdentityId: defaultIdentityId };
        localStorage.setItem(IDENTITY_SCOPE_KEY, JSON.stringify(runtimeState));
        return;
    }
    // A cleared localStorage marker must not expose the legacy user's data.
    if (!runtimeState || runtimeState.activeIdentityId !== defaultIdentityId) {
        localStorage.setItem(IDENTITY_SCOPE_KEY, JSON.stringify({ ...persisted, activeIdentityId: defaultIdentityId }));
        window.location.reload();
        throw new Error("正在载入所选用户的数据");
    }
}
export function getIdentityScopeState(): string | null {
    return runtimeState ? JSON.stringify(runtimeState) : null;
}

/** Drain already queued writes. In-flight requests retain the OLD namespace. */
export async function activateIdentityScope(identityId: string): Promise<void> {
    if (!runtimeState || identityId === runtimeState.activeIdentityId || switching) return;
    switching = true;
    window.dispatchEvent(new Event(IDENTITY_SWITCHING_EVENT));
    try {
        const databases = await indexedDB.databases();
        await Promise.all(databases.filter(db => db.name).map(({ name }) => new Promise<void>((resolve, reject) => {
            const request = indexedDB.open(name!);
            request.onerror = () => reject(request.error);
            request.onsuccess = () => {
                const db = request.result;
                const stores = Array.from(db.objectStoreNames);
                if (!stores.length) { db.close(); resolve(); return; }
                const tx = db.transaction(stores, "readwrite");
                tx.oncomplete = () => { db.close(); resolve(); };
                tx.onerror = () => { db.close(); reject(tx.error); };
                tx.onabort = () => { db.close(); reject(tx.error); };
            };
        })));
        const next = { ...runtimeState, activeIdentityId: identityId };
        localStorage.setItem(IDENTITY_SCOPE_KEY, JSON.stringify(next));
        sessionStorage.setItem("ai_phone_open_chat_after_identity_switch", "1");
        window.location.reload();
    } catch (error) {
        switching = false;
        window.dispatchEvent(new Event(IDENTITY_SWITCHING_EVENT));
        throw error;
    }
}

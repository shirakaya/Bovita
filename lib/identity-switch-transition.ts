/** One reload handoff, kept separate from persistent identity data. */
const KEY = "ai_phone_identity_switch_transition";
export type IdentitySwitchLocation = { app: string | null; chatTab?: string; settingsPage?: string };
export type IdentitySwitchTransition = {
    identityId: string;
    name: string;
    avatarUrl?: string;
    location: IdentitySwitchLocation;
};
function readTransition(): IdentitySwitchTransition | null {
    if (typeof window === "undefined") return null;
    try {
        const value = JSON.parse(sessionStorage.getItem(KEY) || "null");
        return typeof value?.identityId === "string" && typeof value?.name === "string" && value?.location ? value : null;
    } catch { return null; }
}
let resume = readTransition();
let pending: IdentitySwitchTransition | null = null;
let location: IdentitySwitchLocation = { app: null };
export function getIdentitySwitchResume() { return resume; }
export function getPendingIdentitySwitch() { return pending; }
export function rememberIdentitySwitchLocation(next: Partial<IdentitySwitchLocation>) {
    location = { ...location, ...next };
}
export function prepareIdentitySwitch(identityId: string, profile?: { name: string; avatarUrl?: string }) {
    pending = { identityId, name: profile?.name || "用户", avatarUrl: profile?.avatarUrl, location: { ...location } };
    try { sessionStorage.setItem(KEY, JSON.stringify(pending)); }
    catch {
        // Large embedded avatars must not prevent an otherwise valid switch.
        sessionStorage.setItem(KEY, JSON.stringify({ ...pending, avatarUrl: undefined }));
    }
}
export function cancelIdentitySwitchTransition() {
    pending = null;
    sessionStorage.removeItem(KEY);
}
/** Called after the restored shell and its initial page have mounted. */
export function clearIdentitySwitchResume() {
    resume = null;
    sessionStorage.removeItem(KEY);
}

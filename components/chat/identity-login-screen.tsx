"use client";

import type { IdentitySwitchTransition } from "@/lib/identity-switch-transition";
import { ChatFallbackAvatar } from "./chat-fallback-avatar";

export function IdentityLoginScreen({ identity }: { identity: IdentitySwitchTransition }) {
    return <div role="status" aria-label={`正在登录 ${identity.name}`} className="fixed inset-0 z-[2147483647] flex flex-col items-center justify-center bg-[var(--c-bg,#fafafa)] text-[var(--c-text,#333)]">
        <div className="mb-5 flex h-24 w-24 items-center justify-center overflow-hidden rounded-full bg-[var(--c-input,#eee)] shadow-sm">
            {identity.avatarUrl ? <img src={identity.avatarUrl} alt="" className="h-full w-full object-cover" /> : <ChatFallbackAvatar />}
        </div>
        <div className="text-xl font-medium">{identity.name}</div>
        <div className="mt-7 h-6 w-6 animate-spin rounded-full border-2 border-current border-t-transparent opacity-50 motion-reduce:animate-none" aria-hidden="true" />
        <div className="mt-3 text-xs tracking-widest opacity-50">正在登录…</div>
    </div>;
}

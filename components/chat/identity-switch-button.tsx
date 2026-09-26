"use client";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { loadUserIdentities, selectGlobalUserIdentity } from "@/lib/settings-storage";
import { getRuntimeIdentityId } from "@/lib/identity-scope";

/** A normal tap keeps its existing action; long press/right click opens identities. */
export function IdentitySwitchButton({ children, className, onClick }: { children: ReactNode; className?: string; onClick?: () => void }) {
    const [open, setOpen] = useState(false);
    const [busy, setBusy] = useState(false);
    const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
    const held = useRef(false);
    const start = useRef({ x: 0, y: 0 });
    const cancel = () => { if (timer.current) clearTimeout(timer.current); timer.current = null; };
    useEffect(() => cancel, []);
    useEffect(() => {
        if (!open) return;
        const escape = (event: KeyboardEvent) => { if (event.key === "Escape" && !busy) setOpen(false); };
        window.addEventListener("keydown", escape);
        return () => window.removeEventListener("keydown", escape);
    }, [open, busy]);
    const identities = open ? loadUserIdentities() : [];
    return <>
        <button type="button" className={className} title="长按切换用户" aria-haspopup="dialog"
            style={{ WebkitTouchCallout: "none", userSelect: "none" }}
            onPointerDown={event => {
                if (event.button !== 0) return;
                cancel(); held.current = false; start.current = { x: event.clientX, y: event.clientY };
                timer.current = setTimeout(() => { held.current = true; setOpen(true); }, 550);
            }}
            onPointerMove={event => { if (Math.hypot(event.clientX - start.current.x, event.clientY - start.current.y) > 12) cancel(); }}
            onPointerUp={cancel} onPointerCancel={cancel} onPointerLeave={cancel}
            onContextMenu={event => { event.preventDefault(); cancel(); held.current = true; setOpen(true); }}
            onClick={() => { if (held.current) { held.current = false; return; } onClick?.(); }}
            onKeyDown={event => { if (event.key === "ArrowDown") { event.preventDefault(); setOpen(true); } }}
        >{children}</button>
        {open && createPortal(<div className="fixed inset-0 z-[2147483646] flex items-center justify-center bg-black/35 p-6" onClick={() => !busy && setOpen(false)}>
            <section role="dialog" aria-modal="true" aria-label="切换用户" className="w-full max-w-sm rounded-3xl bg-[var(--c-bg,#fff)] p-5 text-[var(--c-text,#222)] shadow-xl" onClick={event => event.stopPropagation()}>
                <div className="mb-2 flex items-center justify-between"><h2 className="text-lg font-semibold">切换用户</h2><button autoFocus disabled={busy} onClick={() => setOpen(false)} aria-label="关闭切换用户">✕</button></div>
                <p className="mb-4 text-xs opacity-60">切换全局默认身份，并载入该用户的聊天与记忆。页面会重新载入，未完成的生成会中断。</p>
                <div className="max-h-[50vh] overflow-y-auto">
                    {identities.map(identity => <button key={identity.id} disabled={busy} className="flex w-full items-center gap-3 rounded-xl p-3 text-left hover:bg-black/5" onClick={async () => {
                        if (identity.id === getRuntimeIdentityId()) { setOpen(false); return; }
                        setBusy(true);
                        try { await selectGlobalUserIdentity(identity.id); } finally { setBusy(false); }
                    }}>
                        {identity.avatarUrl ? <img src={identity.avatarUrl} alt="" className="h-10 w-10 rounded-full object-cover" /> : <span className="grid h-10 w-10 place-items-center rounded-full bg-black/5">{identity.name.slice(0, 1)}</span>}
                        <span className="flex-1 truncate">{identity.name}</span>{identity.id === getRuntimeIdentityId() && <span className="text-xs opacity-60">当前</span>}
                    </button>)}
                    {!identities.length && <p className="py-4 text-sm">请先在设置中创建用户身份。</p>}
                </div>
            </section>
        </div>, document.body)}
    </>;
}

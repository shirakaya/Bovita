// lib/chat-plugin-loader.ts
// 聊天插件系统 · 加载器：把插件 ES Module 源码经 Blob URL 动态 import 变成可执行模块。
// 方案 B：插件与宿主同环境执行（无沙盒）—— 安装时已向用户明示风险。

import type { ChatPluginModule } from "./chat-plugin-types";
import { loadChatPlugins, persistChatPlugin, validateChatPluginManifest } from "./chat-plugin-storage";
import JSZip from "jszip";

const MAX_PLUGIN_ARCHIVE_BYTES = 10 * 1024 * 1024;

function isUsablePluginEntry(name: string): boolean {
    const parts = name.split("/").filter(Boolean);
    if (parts.length === 0) return false;
    if (parts.some(part => part === "__MACOSX" || part.startsWith("."))) return false;
    return name.toLowerCase().endsWith(".js");
}

/**
 * 执行插件源码并校验模块形状。
 * 注意：import 即执行模块顶层代码 —— 安装校验与运行加载共用本函数。
 */
export async function loadChatPluginModule(code: string): Promise<{ module?: ChatPluginModule; error?: string }> {
    if (typeof window === "undefined") return { error: "插件只能在浏览器环境加载" };
    let url = "";
    try {
        const blob = new Blob([code], { type: "text/javascript" });
        url = URL.createObjectURL(blob);
        // webpackIgnore：这是运行时用户代码，不能让打包器静态分析
        const mod: unknown = await import(/* webpackIgnore: true */ url);
        const def = (mod as { default?: unknown })?.default;
        if (!def || typeof def !== "object") {
            return { error: "插件必须 export default { manifest, setup }" };
        }
        const candidate = def as Partial<ChatPluginModule>;
        const { manifest, error } = validateChatPluginManifest(candidate.manifest);
        if (!manifest) return { error };
        if (typeof candidate.setup !== "function") {
            return { error: "default 导出缺少 setup(ctx) 函数" };
        }
        return { module: { manifest, setup: candidate.setup } };
    } catch (e) {
        const message = e instanceof Error ? e.message : String(e);
        return { error: `插件脚本执行失败：${message}` };
    } finally {
        if (url) URL.revokeObjectURL(url);
    }
}

/** 安装（或同 id 升级）一个插件：执行校验 → 落库；运行时监听存储变化自动加载。
 * 同 id 覆盖安装 = 升级：settings 与插件私有数据全部保留（uninstall 才会清）。 */
export async function installChatPluginFromCode(code: string, opts?: {
    /** 更新场景：要求源码里的 manifest.id 必须等于该值，防止把别的插件误装成"更新" */
    expectedId?: string;
}): Promise<{
    ok: boolean; error?: string; name?: string;
    /** 同 id 覆盖升级（而非新装） */
    upgraded?: boolean; fromVersion?: string; toVersion?: string;
}> {
    const trimmed = code.trim();
    if (!trimmed) return { ok: false, error: "插件源码为空" };
    const { module, error } = await loadChatPluginModule(trimmed);
    if (!module) return { ok: false, error };
    if (opts?.expectedId && module.manifest.id !== opts.expectedId) {
        return { ok: false, error: `这份代码的插件 id（${module.manifest.id}）与当前插件（${opts.expectedId}）不一致，不是它的新版本` };
    }
    const existing = loadChatPlugins().find(p => p.manifest.id === module.manifest.id);
    const persisted = persistChatPlugin(module.manifest, trimmed);
    if (!persisted.ok) return { ok: false, error: persisted.error };
    return {
        ok: true,
        name: module.manifest.name,
        upgraded: !!existing,
        fromVersion: existing?.manifest.version,
        toVersion: module.manifest.version,
    };
}

/** 从用户选择的 .js / .zip 文件安装插件。ZIP 内有多个 JS 时先返回候选路径。 */
export async function installChatPluginFromFile(file: File, opts?: {
    expectedId?: string;
    entryName?: string;
}): Promise<{
    ok: boolean; error?: string; name?: string;
    upgraded?: boolean; fromVersion?: string; toVersion?: string;
    entries?: string[];
}> {
    const lowerName = file.name.toLowerCase();
    if (lowerName.endsWith(".js")) {
        return installChatPluginFromCode(await file.text(), { expectedId: opts?.expectedId });
    }
    if (!lowerName.endsWith(".zip")) {
        return { ok: false, error: "请选择 .js 或 .zip 插件文件" };
    }
    if (file.size > MAX_PLUGIN_ARCHIVE_BYTES) {
        return { ok: false, error: `ZIP 文件过大（上限 ${MAX_PLUGIN_ARCHIVE_BYTES / 1024 / 1024}MB）` };
    }

    try {
        const zip = await JSZip.loadAsync(file);
        const entries = Object.values(zip.files)
            .filter(entry => !entry.dir && isUsablePluginEntry(entry.name))
            .map(entry => entry.name)
            .sort((a, b) => a.localeCompare(b));
        if (entries.length === 0) return { ok: false, error: "ZIP 中没有找到插件 .js 文件" };

        const entryName = opts?.entryName;
        if (!entryName && entries.length > 1) {
            return { ok: false, error: "ZIP 中包含多个插件，请选择要安装的文件", entries };
        }
        const selectedName = entryName || entries[0];
        if (!entries.includes(selectedName)) {
            return { ok: false, error: "选择的插件文件不在 ZIP 中", entries };
        }
        const selected = zip.file(selectedName);
        if (!selected) return { ok: false, error: "无法读取 ZIP 中的插件文件" };
        const code = await selected.async("string");
        return installChatPluginFromCode(code, { expectedId: opts?.expectedId });
    } catch (error) {
        return { ok: false, error: `ZIP 解析失败：${error instanceof Error ? error.message : String(error)}` };
    }
}

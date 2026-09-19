// lib/cover-color.ts — Extract an adaptive light palette from album cover art
// Used by the full-screen player to tint the whole surface and playback controls.

export type CoverPalette = {
    background: string;
    glowA: string;
    glowB: string;
    glowC: string;
    accent: string;
    accentSoft: string;
};

/** Fallback QQ-Music-like white/green palette when sampling fails. */
export const DEFAULT_COVER_PALETTE: CoverPalette = {
    background: "rgb(226, 249, 237)",
    glowA: "rgba(169, 234, 202, 0.72)",
    glowB: "rgba(201, 243, 222, 0.64)",
    glowC: "rgba(232, 250, 241, 0.82)",
    accent: "rgb(49, 194, 124)",
    accentSoft: "rgba(49, 194, 124, 0.18)",
};

const paletteCache = new Map<string, CoverPalette>();

type RGB = { r: number; g: number; b: number };

function clamp(value: number, min: number, max: number): number {
    return Math.min(max, Math.max(min, value));
}

function mixWithWhite(color: RGB, amount: number): RGB {
    const mix = clamp(amount, 0, 1);
    return {
        r: Math.round(color.r * (1 - mix) + 255 * mix),
        g: Math.round(color.g * (1 - mix) + 255 * mix),
        b: Math.round(color.b * (1 - mix) + 255 * mix),
    };
}

function rgb(color: RGB): string {
    return `rgb(${Math.round(color.r)}, ${Math.round(color.g)}, ${Math.round(color.b)})`;
}

function rgba(color: RGB, alpha: number): string {
    return `rgba(${Math.round(color.r)}, ${Math.round(color.g)}, ${Math.round(color.b)}, ${alpha})`;
}

function rgbToHsl({ r, g, b }: RGB): { h: number; s: number; l: number } {
    const rn = r / 255;
    const gn = g / 255;
    const bn = b / 255;
    const max = Math.max(rn, gn, bn);
    const min = Math.min(rn, gn, bn);
    const d = max - min;
    const l = (max + min) / 2;
    if (d === 0) return { h: 0, s: 0, l };

    const s = d / (1 - Math.abs(2 * l - 1));
    let h = 0;
    if (max === rn) h = 60 * (((gn - bn) / d) % 6);
    else if (max === gn) h = 60 * ((bn - rn) / d + 2);
    else h = 60 * ((rn - gn) / d + 4);
    if (h < 0) h += 360;
    return { h, s, l };
}

function hslToRgb(h: number, s: number, l: number): RGB {
    const c = (1 - Math.abs(2 * l - 1)) * s;
    const hp = h / 60;
    const x = c * (1 - Math.abs((hp % 2) - 1));
    let rn = 0, gn = 0, bn = 0;
    if (hp < 1) [rn, gn] = [c, x];
    else if (hp < 2) [rn, gn] = [x, c];
    else if (hp < 3) [gn, bn] = [c, x];
    else if (hp < 4) [gn, bn] = [x, c];
    else if (hp < 5) [rn, bn] = [x, c];
    else [rn, bn] = [c, x];
    const m = l - c / 2;
    return { r: (rn + m) * 255, g: (gn + m) * 255, b: (bn + m) * 255 };
}

/** Keep the sampled hue, but make it readable enough for buttons/progress. */
function makeAccent(source: RGB): RGB {
    const { h, s, l } = rgbToHsl(source);
    return hslToRgb(
        h,
        clamp(s, 0.48, 0.76),
        clamp(l, 0.46, 0.58),
    );
}

/**
 * Pick the cover's dominant chromatic hue instead of averaging in white/gray
 * pixels. Album art often contains large white areas; averaging them made the
 * old player look almost white no matter what the actual cover color was.
 */
function dominantChromaticColor(data: Uint8ClampedArray): RGB | null {
    const bins = Array.from({ length: 12 }, () => ({
        weight: 0,
        r: 0,
        g: 0,
        b: 0,
    }));

    for (let i = 0; i < data.length; i += 4) {
        if (data[i + 3] < 128) continue;
        const color = { r: data[i], g: data[i + 1], b: data[i + 2] };
        const { h, s, l } = rgbToHsl(color);
        // Ignore near-grays, almost-white backgrounds and near-black pixels.
        if (s < 0.12 || l > 0.95 || l < 0.08) continue;

        const idx = Math.min(11, Math.floor(h / 30));
        const weight = Math.pow(s, 1.35) * (0.55 + (1 - Math.abs(l - 0.55)) * 0.45);
        const bin = bins[idx];
        bin.weight += weight;
        bin.r += color.r * weight;
        bin.g += color.g * weight;
        bin.b += color.b * weight;
    }

    const best = bins.reduce((a, b) => b.weight > a.weight ? b : a);
    if (best.weight <= 0) return null;
    return {
        r: best.r / best.weight,
        g: best.g / best.weight,
        b: best.b / best.weight,
    };
}

function makePalette(source: RGB): CoverPalette {
    const accent = makeAccent(source);
    // The target is the reference screenshot: a visibly tinted pastel surface,
    // not a white page with a faint colored glow.
    const background = mixWithWhite(accent, 0.78);
    const glowA = mixWithWhite(source, 0.64);
    const glowB = mixWithWhite(accent, 0.72);
    const glowC = mixWithWhite(accent, 0.86);
    return {
        background: rgb(background),
        glowA: rgba(glowA, 0.76),
        glowB: rgba(glowB, 0.64),
        glowC: rgba(glowC, 0.84),
        accent: rgb(accent),
        accentSoft: rgba(accent, 0.18),
    };
}

/**
 * Sample an adaptive palette from a cover image.
 * Requires anonymous CORS access; resolves with the fallback palette on failure.
 */
export function extractCoverPalette(coverUrl?: string | null): Promise<CoverPalette> {
    if (typeof window === "undefined" || !coverUrl) return Promise.resolve(DEFAULT_COVER_PALETTE);
    const cached = paletteCache.get(coverUrl);
    if (cached) return Promise.resolve(cached);

    return new Promise(resolve => {
        const img = new Image();
        img.crossOrigin = "anonymous";
        const finish = (palette: CoverPalette) => {
            paletteCache.set(coverUrl, palette);
            resolve(palette);
        };
        img.onerror = () => finish(DEFAULT_COVER_PALETTE);
        img.onload = () => {
            try {
                const size = 32;
                const canvas = document.createElement("canvas");
                canvas.width = size;
                canvas.height = size;
                const ctx = canvas.getContext("2d");
                if (!ctx) { finish(DEFAULT_COVER_PALETTE); return; }
                ctx.drawImage(img, 0, 0, size, size);
                const { data } = ctx.getImageData(0, 0, size, size);
                const dominant = dominantChromaticColor(data);
                finish(dominant ? makePalette(dominant) : DEFAULT_COVER_PALETTE);
            } catch {
                // Canvas tainted (no CORS) or decode failure.
                finish(DEFAULT_COVER_PALETTE);
            }
        };
        img.src = coverUrl;
    });
}

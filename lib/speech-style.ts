import { splitBilingualText } from "./bilingual-text";

export const SPEECH_EMOTIONS = [
    "happy",
    "sad",
    "angry",
    "fearful",
    "disgusted",
    "surprised",
    "calm",
    "neutral",
    "fluent",
] as const;

export type SpeechEmotion = typeof SPEECH_EMOTIONS[number];

const SPEECH_EMOTION_SET = new Set<string>(SPEECH_EMOTIONS);
const SPEECH_WRAPPER = /<speech\b[^>]*\bemotion\s*=\s*["']?([a-z]+)["']?[^>]*>([\s\S]*?)<\/speech>/i;
const MINIMAX_INTERJECTION = /\((?:laughs|chuckle|coughs|clear-throat|groans|breath|pant|inhale|exhale|gasps|sniffs|sighs|snorts|lip-smacking|humming|hissing|emm|sneezes|whistles|crying|applause)\)/gi;
const MINIMAX_PAUSE = /<#\s*\d+(?:\.\d+)?\s*#>/g;

export function normalizeSpeechEmotion(value: unknown): SpeechEmotion | undefined {
    if (typeof value !== "string") return undefined;
    const normalized = value.trim().toLowerCase();
    return SPEECH_EMOTION_SET.has(normalized) ? normalized as SpeechEmotion : undefined;
}

/** Remove only MiniMax control tokens that should be spoken but not shown as captions. */
export function stripSpeechControlsForDisplay(text: string): string {
    return text
        .replace(MINIMAX_INTERJECTION, "")
        .replace(MINIMAX_PAUSE, "")
        .replace(/[ \t]{2,}/g, " ")
        .replace(/\s+([，。！？、,.!?])/g, "$1")
        .trim();
}

export type PreparedSpeech = {
    displayText: string;
    speechText: string;
    emotion?: SpeechEmotion;
};

/**
 * Parse the hidden conversational TTS protocol.
 *
 * New output: <speech emotion="fluent">spoken text</speech>
 * Old plain-text output remains valid and simply has no explicit emotion.
 */
export function prepareSpeech(text: string, fallbackEmotion?: unknown): PreparedSpeech {
    const wrapper = text.match(SPEECH_WRAPPER);
    const source = (wrapper?.[2] ?? text).trim();
    const emotion = normalizeSpeechEmotion(wrapper?.[1]) ?? normalizeSpeechEmotion(fallbackEmotion);
    const speechText = source
        .split("\n")
        .map((line) => splitBilingualText(line)?.original || line)
        .join("\n")
        .trim();

    return {
        displayText: stripSpeechControlsForDisplay(source),
        speechText,
        emotion,
    };
}

export function formatVoiceMessageDirective(text: string, emotion?: unknown): string {
    const normalized = normalizeSpeechEmotion(emotion);
    return normalized
        ? `[语音条 emotion="${normalized}":${text}]`
        : `[语音条:${text}]`;
}

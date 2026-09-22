import type { RegexConfig } from "./settings-types";
import { applyAllOutputRegex, applyAllReasoningRegex } from "./llm-prompt-assembler";
import type { MacroEngine } from "./macro-engine";

export const STORY_PARSER_VERSION = 9;

export type ParsedStoryResponse = {
  rawText: string;
  renderedText: string;
  summaryText: string;
};

function escapeTagName(tag: string): string {
  return tag.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function extractXmlField(rawText: string, preferredTag?: string): string {
  const candidates = [preferredTag?.trim(), "summary"]
    .filter(Boolean)
    .filter((value, index, list) => list.indexOf(value) === index) as string[];

  for (const tag of candidates) {
    const match = rawText.match(new RegExp(`<${escapeTagName(tag)}>([\\s\\S]*?)</${escapeTagName(tag)}>`, "i"));
    const content = match?.[1]?.trim();
    if (content) return content;
  }
  return "";
}

/** Convert `<tagname>...</tagname>` into renderer fold markers for each configured fold tag. */
function applyFoldTags(text: string, foldTags?: string): string {
  if (!foldTags) return text;
  const tags = Array.from(new Set(foldTags.split(",").map(t => t.trim()).filter(Boolean)));
  if (tags.length === 0) return text;

  const placeholders: { placeholder: string; label: string; content: string }[] = [];
  const tagAlternation = tags.map(escapeTagName).join("|");
  const rx = new RegExp(`<(${tagAlternation})>([\\s\\S]*?)<\\/\\1>`, "gi");
  const protectedText = text.replace(rx, (_match, tag: string, content: string) => {
    const trimmed = content.trim();
    if (!trimmed) return "";
    const placeholder = `\x00STORY_FOLD_${placeholders.length}\x00`;
    placeholders.push({
      placeholder,
      label: tag.toLowerCase(),
      content: trimmed,
    });
    return placeholder;
  });

  let result = protectedText;
  for (const { placeholder, label, content } of placeholders) {
    const replacement = `\n<!--RHR-FOLD:${label}-->\n${content}\n<!--/RHR-FOLD-->\n`;
    result = result.split(placeholder).join(replacement);
  }
  return result;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function extractStoryChoices(text: string): string[] {
  let result: string[] = [];
  for (const optionsMatch of text.matchAll(/<options>([\s\S]*?)<\/options>/gi)) {
    const choices = Array.from(optionsMatch[1].matchAll(/<option>([\s\S]*?)<\/option>/gi))
      .map(match => match[1].replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim())
      .filter(Boolean)
      .slice(0, 4);
    if (choices.length > 0) result = choices;
  }
  return result;
}

function renderStoryChoices(choices: string[]): string {
  if (choices.length === 0) return "";
  return `\n<div class="story-vn-options" aria-label="剧情选择">${choices.map((choice, index) => (
    `<button type="button" class="story-vn-option" data-action="${escapeHtml(choice)}"><span>${index + 1}</span>${escapeHtml(choice)}</button>`
  )).join("")}</div>\n`;
}

export function parseStoryResponse(
  rawText: string,
  regexes: RegexConfig[],
  options?: { summaryTag?: string; foldTags?: string; macroEngine?: MacroEngine; activeTags?: string[] },
): ParsedStoryResponse {
  const trimmed = rawText.trim();
  // Strip fold-tag blocks (thinking/think) BEFORE extracting summary,
  // so that <summary> mentioned inside thinking content isn't matched first.
  // 注意跳过摘要标签本身——summary 也可以配进折叠标签（默认已包含），
  // 若在此被剥掉，摘要就提取不到了（recent_story/记忆会断）。
  const effectiveSummaryTag = (options?.summaryTag?.trim() || "summary").toLowerCase();
  let textForSummary = trimmed;
  if (options?.foldTags) {
    for (const tag of options.foldTags.split(",").map(t => t.trim()).filter(Boolean)) {
      if (tag.toLowerCase() === effectiveSummaryTag) continue;
      const escaped = escapeTagName(tag);
      textForSummary = textForSummary.replace(new RegExp(`<${escaped}>[\\s\\S]*?</${escaped}>`, "gi"), "");
    }
  }
  const summaryText = extractXmlField(textForSummary, options?.summaryTag);
  // Read choices from the raw response before output regex can extract only
  // <content> or otherwise remove the custom tags. textForSummary has already
  // excluded thinking folds, so examples mentioned in reasoning are ignored.
  const storyChoices = extractStoryChoices(textForSummary);

  // Temporarily replace fold-tag blocks with placeholders before output regex,
  // so that <content>/<summary> mentioned inside thinking aren't matched by regex rules
  let textForRegex = trimmed;
  const foldPlaceholders: { placeholder: string; original: string }[] = [];
  if (options?.foldTags) {
    for (const tag of options.foldTags.split(",").map(t => t.trim()).filter(Boolean)) {
      const escaped = escapeTagName(tag);
      const rx = new RegExp(`<${escaped}>[\\s\\S]*?</${escaped}>`, "gi");
      textForRegex = textForRegex.replace(rx, (match) => {
        const placeholder = `\x00FOLD_${foldPlaceholders.length}\x00`;
        foldPlaceholders.push({ placeholder, original: match });
        return placeholder;
      });
    }
  }
  const regexRendered = applyAllOutputRegex(textForRegex, regexes, {
    macroEngine: options?.macroEngine,
    activeTags: options?.activeTags,
  });
  // Restore fold blocks and apply reasoning regex inside them
  let reasoningProcessed = regexRendered;
  for (const { placeholder, original } of foldPlaceholders) {
    let restored = original;
    // Apply placement=6 (reasoning) regex inside the fold block
    if (regexes.length > 0) {
      // Extract tag name and content from the original fold block
      const tagMatch = original.match(/^<(\w+)>([\s\S]*)<\/\1>$/i);
      if (tagMatch) {
        const [, tagName, content] = tagMatch;
        const regexed = applyAllReasoningRegex(content.trim(), regexes, {
          macroEngine: options?.macroEngine,
          activeTags: options?.activeTags,
        });
        restored = `<${tagName}>${regexed}</${tagName}>`;
      }
    }
    reasoningProcessed = reasoningProcessed.replace(placeholder, restored);
  }

  // Always place choices after the folded content. Models occasionally emit
  // <options> inside <summary>; keeping them in place would hide the buttons in
  // the collapsed block. Remove any surviving copy to avoid duplicates.
  const contentWithoutChoices = reasoningProcessed.replace(/<options>[\s\S]*?<\/options>/gi, "");
  const folded = applyFoldTags(contentWithoutChoices, options?.foldTags);
  const renderedText = `${folded}${renderStoryChoices(storyChoices)}`
    .replace(/\r\n/g, "\n")
    .replace(/\n{4,}/g, "\n\n\n")
    .trim();

  return {
    rawText: trimmed,
    renderedText,
    summaryText,
  };
}

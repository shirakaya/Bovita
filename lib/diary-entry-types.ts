export type DiaryEntryTrigger = "manual" | "timer";

export type DiaryEntryTodoItem = {
  text: string;
  done: boolean;
};

export type DiaryEntryBlock =
  | { type: "paragraph"; text: string }
  | { type: "quote"; text: string }
  | { type: "correction"; text: string; replacement?: string }
  | { type: "todo"; title?: string; items: DiaryEntryTodoItem[] }
  | { type: "image"; caption?: string; description: string };

export type DiaryEntry = {
  id: string;
  authorType?: "character" | "user";
  visibleToCharacterIds?: string[];
  characterId: string;
  characterName: string;
  title: string;
  dateLabel: string;
  mood: string;
  weather: string;
  tags: string[];
  body: string;
  blocks: DiaryEntryBlock[];
  trigger: DiaryEntryTrigger;
  createdAt: string;
  updatedAt: string;
};

export type DiaryEntryInput = {
  authorType?: "character" | "user";
  visibleToCharacterIds?: string[];
  characterId: string;
  characterName: string;
  title: string;
  dateLabel?: string;
  mood?: string;
  weather?: string;
  tags?: string[];
  body: string;
  blocks: DiaryEntryBlock[];
  trigger?: DiaryEntryTrigger;
};

export type DiaryEntryTimerSettings = {
  enabled: boolean;
  intervalHours: number;
  characterIds: string[];
  lastRunAtByCharacter: Record<string, string>;
};

export const DEFAULT_DIARY_ENTRY_TIMER_SETTINGS: DiaryEntryTimerSettings = {
  enabled: false,
  intervalHours: 24,
  characterIds: [],
  lastRunAtByCharacter: {},
};

/** User entries are private unless the recipient is explicitly selected. */
export function canCharacterReadDiaryEntry(entry: DiaryEntry, characterId: string): boolean {
  if (!characterId) return false;
  return entry.authorType === "user"
    ? Boolean(entry.visibleToCharacterIds?.includes(characterId))
    : entry.characterId === characterId;
}

export const USER_DIARY_BOOK_ID = "user_diary";

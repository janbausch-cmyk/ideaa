export type PreviousIdeaEntry = {
  id: string;
  ideaPreview: string;
  submittedAt: string;
};

export const PREVIOUS_IDEAS_KEY = "ideaa.previousIdeas";
export const FAVORITES_KEY = "ideaa.favorites";
const MAX_ENTRIES = 50;

function safeRead<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw);
    return parsed as T;
  } catch {
    return fallback;
  }
}

function safeWrite(key: string, value: unknown): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // localStorage full or disabled — silently drop
  }
}

export function readPreviousIdeas(): PreviousIdeaEntry[] {
  const list = safeRead<PreviousIdeaEntry[]>(PREVIOUS_IDEAS_KEY, []);
  if (!Array.isArray(list)) return [];
  return list.filter(
    (entry): entry is PreviousIdeaEntry =>
      !!entry &&
      typeof entry.id === "string" &&
      typeof entry.ideaPreview === "string" &&
      typeof entry.submittedAt === "string",
  );
}

export function recordPreviousIdea(entry: PreviousIdeaEntry): void {
  const existing = readPreviousIdeas();
  const filtered = existing.filter((e) => e.id !== entry.id);
  const next = [entry, ...filtered].slice(0, MAX_ENTRIES);
  safeWrite(PREVIOUS_IDEAS_KEY, next);
}

export function readFavorites(): string[] {
  const list = safeRead<string[]>(FAVORITES_KEY, []);
  if (!Array.isArray(list)) return [];
  return list.filter((id): id is string => typeof id === "string");
}

export function isFavorite(id: string): boolean {
  return readFavorites().includes(id);
}

export function toggleFavorite(id: string): boolean {
  const current = readFavorites();
  const has = current.includes(id);
  const next = has ? current.filter((x) => x !== id) : [id, ...current];
  safeWrite(FAVORITES_KEY, next);
  return !has;
}

export function buildIdeaPreview(text: string): string {
  const collapsed = text.replace(/\s+/g, " ").trim();
  if (collapsed.length <= 60) return collapsed;
  return collapsed.slice(0, 60).trimEnd() + "…";
}

export function formatRelativeTime(iso: string, now: Date = new Date()): string {
  const then = new Date(iso);
  if (isNaN(then.getTime())) return "";
  const diffMs = now.getTime() - then.getTime();
  const sec = Math.round(diffMs / 1000);
  if (sec < 5) return "gerade eben";
  if (sec < 60) return `vor ${sec}s`;
  const min = Math.round(sec / 60);
  if (min < 60) return `vor ${min}min`;
  const hr = Math.round(min / 60);
  if (hr < 24) return `vor ${hr}h`;
  const day = Math.round(hr / 24);
  if (day < 7) return `vor ${day}d`;
  if (day < 30) return `vor ${Math.round(day / 7)}Wo.`;
  return then.toLocaleDateString("de-DE", {
    month: "short",
    day: "numeric",
    year: now.getFullYear() === then.getFullYear() ? undefined : "numeric",
  });
}

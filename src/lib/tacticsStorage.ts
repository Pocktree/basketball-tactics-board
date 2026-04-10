import localforage from "localforage";
import type { BoardItem, BoardSnapshot, Keyframe } from "@/store/tacticsBoardStore";
import { cloneBoardSnapshot } from "@/store/tacticsBoardStore";

export const LIBRARY_STORAGE_KEY = "basketball-tactics-library-v2";

export type StoredTactic = {
  id: string;
  name: string;
  savedAt: number;
  thumbnail: string;
  board: BoardSnapshot;
};

export type TacticFileV1 = {
  version: 1;
  name: string;
  savedAt: number;
  board: BoardSnapshot;
};

const storage = localforage.createInstance({
  name: "basketball-tactics-board",
  storeName: "tactics_library",
});

const PRESET_IDS = [
  "preset-pr-middle",
  "preset-horns-flare",
  "preset-elevator-doors",
  "preset-give-and-go",
  "preset-blob-box",
] as const;

const ITEM_META: Array<Pick<BoardItem, "id" | "color" | "label">> = [
  { id: "offense-1", color: "#22c55e", label: "1" },
  { id: "offense-2", color: "#22c55e", label: "2" },
  { id: "offense-3", color: "#22c55e", label: "3" },
  { id: "offense-4", color: "#22c55e", label: "4" },
  { id: "offense-5", color: "#22c55e", label: "5" },
  { id: "defense-1", color: "#ef4444", label: "1" },
  { id: "defense-2", color: "#ef4444", label: "2" },
  { id: "defense-3", color: "#ef4444", label: "3" },
  { id: "defense-4", color: "#ef4444", label: "4" },
  { id: "defense-5", color: "#ef4444", label: "5" },
  { id: "ball", color: "#f97316" },
];

const BALL_OFFSET = { x: 0.36, y: -0.06 };

function makeFrame(
  id: string,
  holderId: string | null,
  positions: Record<string, { x: number; y: number }>,
  options?: {
    durationSec?: number;
    screenIds?: string[];
    defenderOf?: Record<string, string>;
    screeningIds?: string[];
  },
): Keyframe {
  const holderPos = holderId ? positions[holderId] : null;
  const ballPos =
    positions.ball ??
    (holderPos
      ? { x: holderPos.x + BALL_OFFSET.x, y: holderPos.y + BALL_OFFSET.y }
      : { x: 14, y: 7.5 });
  return {
    id,
    holderId,
    screenIds: options?.screenIds ?? [],
    durationSec: options?.durationSec ?? 1.5,
    defenderOf: options?.defenderOf,
    screeningIds: options?.screeningIds ?? [],
    positions: {
      ...positions,
      ball: ballPos,
    },
  };
}

function itemsFromFrame(frame: Keyframe): BoardItem[] {
  return ITEM_META.map((meta) => {
    const position = frame.positions[meta.id] ?? { x: 14, y: 7.5 };
    return {
      id: meta.id,
      x: position.x,
      y: position.y,
      color: meta.color,
      label: meta.label,
    };
  });
}

function boardFromFrames(frames: Keyframe[]): BoardSnapshot {
  const first = frames[0];
  return cloneBoardSnapshot({
    items: itemsFromFrame(first),
    lines: [],
    ballHolderId: first.holderId,
    keyframes: frames,
    activeKeyframeIndex: 0,
    mode: "drag",
    courtMode: "half",
    currentDrawingColor: "#ff4d4f",
    theme: "dark",
  });
}

const DEFENDER_MATCHUPS = {
  "defense-1": "offense-1",
  "defense-2": "offense-2",
  "defense-3": "offense-3",
  "defense-4": "offense-4",
  "defense-5": "offense-5",
};

const p = (courtX: number, courtY: number) => ({ x: courtY, y: courtX });

export const PRESET_TACTICS: StoredTactic[] = [
  {
    id: PRESET_IDS[0],
    name: "模板1：高位挡拆进阶 (P&R Middle Pro)",
    savedAt: 1700000000001,
    thumbnail: "",
    board: boardFromFrames([
      makeFrame(
        "preset-pr-middle-kf1",
        "offense-1",
        {
          "offense-1": p(7.5, 7.2),
          "offense-5": p(8.7, 5.1),
          "offense-2": p(1.0, 1.0),
          "offense-3": p(14.0, 1.0),
          "offense-4": p(12.2, 5.2),
          "defense-1": p(7.5, 6.2),
          "defense-5": p(8.8, 4.2),
          "defense-2": p(1.9, 2.0),
          "defense-3": p(13.1, 2.0),
          "defense-4": p(11.1, 5.0),
        },
        { durationSec: 1.2, defenderOf: DEFENDER_MATCHUPS },
      ),
      makeFrame(
        "preset-pr-middle-kf2",
        "offense-1",
        {
          "offense-1": p(6.0, 6.8),
          "offense-5": p(6.9, 7.2),
          "offense-2": p(1.0, 1.0),
          "offense-3": p(14.0, 1.0),
          "offense-4": p(12.0, 5.8),
          "defense-1": p(6.8, 6.0),
          "defense-5": p(7.3, 6.1),
          "defense-2": p(2.1, 2.0),
          "defense-3": p(13.0, 2.1),
          "defense-4": p(11.2, 5.3),
        },
        { durationSec: 1.3, defenderOf: DEFENDER_MATCHUPS, screeningIds: ["offense-5"] },
      ),
      makeFrame(
        "preset-pr-middle-kf3",
        "offense-1",
        {
          "offense-1": p(4.8, 4.4),
          "offense-5": p(7.6, 4.2),
          "offense-2": p(1.0, 1.0),
          "offense-3": p(14.0, 1.0),
          "offense-4": p(11.0, 7.0),
          "defense-1": p(5.8, 4.8),
          "defense-5": p(6.8, 4.1),
          "defense-2": p(2.3, 2.2),
          "defense-3": p(12.7, 2.2),
          "defense-4": p(10.4, 6.2),
        },
        { durationSec: 1.2, defenderOf: DEFENDER_MATCHUPS },
      ),
      makeFrame(
        "preset-pr-middle-kf4",
        "offense-5",
        {
          "offense-1": p(4.3, 3.6),
          "offense-5": p(7.5, 2.3),
          "offense-2": p(1.0, 1.0),
          "offense-3": p(14.0, 1.0),
          "offense-4": p(10.6, 7.4),
          "defense-1": p(5.0, 3.7),
          "defense-5": p(7.0, 2.9),
          "defense-2": p(2.5, 2.3),
          "defense-3": p(12.6, 2.3),
          "defense-4": p(10.1, 6.8),
        },
        { durationSec: 1.4, defenderOf: DEFENDER_MATCHUPS },
      ),
    ]),
  },
  {
    id: PRESET_IDS[1],
    name: "模板2：牛角外切进阶 (Horns Flare Pro)",
    savedAt: 1700000000002,
    thumbnail: "",
    board: boardFromFrames([
      makeFrame(
        "preset-horns-flare-kf1",
        "offense-1",
        {
          "offense-1": p(7.5, 8.2),
          "offense-4": p(5.6, 5.2),
          "offense-5": p(9.4, 5.2),
          "offense-2": p(1.0, 1.0),
          "offense-3": p(14.0, 1.0),
          "defense-1": p(7.5, 7.1),
          "defense-4": p(5.8, 4.3),
          "defense-5": p(9.2, 4.3),
          "defense-2": p(2.0, 2.0),
          "defense-3": p(13.0, 2.0),
        },
        { durationSec: 1.2, defenderOf: DEFENDER_MATCHUPS },
      ),
      makeFrame(
        "preset-horns-flare-kf2",
        "offense-4",
        {
          "offense-1": p(6.6, 7.8),
          "offense-4": p(5.6, 5.2),
          "offense-5": p(8.6, 7.6),
          "offense-2": p(1.0, 1.0),
          "offense-3": p(14.0, 1.0),
          "defense-1": p(6.9, 7.0),
          "defense-4": p(5.8, 5.0),
          "defense-5": p(8.9, 6.8),
          "defense-2": p(2.2, 2.1),
          "defense-3": p(12.9, 2.1),
        },
        { durationSec: 1.2, defenderOf: DEFENDER_MATCHUPS, screeningIds: ["offense-5"] },
      ),
      makeFrame(
        "preset-horns-flare-kf3",
        "offense-1",
        {
          "offense-1": p(11.2, 7.1),
          "offense-4": p(5.8, 5.3),
          "offense-5": p(8.9, 6.9),
          "offense-2": p(1.0, 1.0),
          "offense-3": p(14.0, 1.0),
          "defense-1": p(10.0, 7.1),
          "defense-4": p(6.0, 5.2),
          "defense-5": p(9.0, 6.3),
          "defense-2": p(2.5, 2.2),
          "defense-3": p(12.7, 2.2),
        },
        { durationSec: 1.3, defenderOf: DEFENDER_MATCHUPS },
      ),
      makeFrame(
        "preset-horns-flare-kf4",
        "offense-3",
        {
          "offense-1": p(10.6, 7.2),
          "offense-4": p(6.2, 5.4),
          "offense-5": p(8.0, 3.1),
          "offense-2": p(1.4, 1.0),
          "offense-3": p(12.0, 7.0),
          "defense-1": p(9.7, 7.2),
          "defense-4": p(6.5, 5.4),
          "defense-5": p(8.2, 3.8),
          "defense-2": p(2.1, 1.6),
          "defense-3": p(11.4, 6.5),
        },
        { durationSec: 1.4, defenderOf: DEFENDER_MATCHUPS },
      ),
    ]),
  },
  {
    id: PRESET_IDS[2],
    name: "模板3：电梯门优化 (Elevator Doors Pro)",
    savedAt: 1700000000003,
    thumbnail: "",
    board: boardFromFrames([
      makeFrame(
        "preset-elevator-doors-kf1",
        "offense-1",
        {
          "offense-1": p(3, 5),
          "offense-2": p(7.5, 1),
          "offense-4": p(6.5, 6),
          "offense-5": p(8.5, 6),
          "offense-3": p(13.5, 2),
          "defense-1": p(3.8, 5.4),
          "defense-2": p(7.6, 1.8),
          "defense-3": p(12.9, 2.3),
          "defense-4": p(6.4, 5.2),
          "defense-5": p(8.6, 5.2),
        },
        { durationSec: 1.2, defenderOf: DEFENDER_MATCHUPS },
      ),
      makeFrame(
        "preset-elevator-doors-kf2",
        "offense-1",
        {
          "offense-1": p(3.6, 5.3),
          "offense-2": p(7.5, 7.1),
          "offense-4": p(6.5, 6),
          "offense-5": p(8.5, 6),
          "offense-3": p(13.5, 2),
          "defense-1": p(4.2, 5.4),
          "defense-2": p(7.5, 6.2),
          "defense-3": p(12.8, 2.4),
          "defense-4": p(6.5, 5.4),
          "defense-5": p(8.5, 5.4),
        },
        {
          durationSec: 1.1,
          defenderOf: DEFENDER_MATCHUPS,
          screeningIds: ["offense-4", "offense-5"],
        },
      ),
      makeFrame(
        "preset-elevator-doors-kf3",
        "offense-2",
        {
          "offense-1": p(3.9, 5.5),
          "offense-2": p(7.5, 8.3),
          "offense-4": p(7.5, 6),
          "offense-5": p(7.5, 6),
          "offense-3": p(13.2, 2.1),
          "defense-1": p(4.2, 5.8),
          "defense-2": p(7.5, 5.6),
          "defense-3": p(12.4, 2.5),
          "defense-4": p(7.2, 5.5),
          "defense-5": p(7.8, 5.6),
        },
        {
          durationSec: 1.6,
          defenderOf: DEFENDER_MATCHUPS,
          screeningIds: ["offense-4", "offense-5"],
        },
      ),
      makeFrame(
        "preset-elevator-doors-kf4",
        "offense-2",
        {
          "offense-1": p(4.2, 5.7),
          "offense-2": p(8.4, 8.6),
          "offense-4": p(7.2, 6.2),
          "offense-5": p(7.8, 6.2),
          "offense-3": p(12.8, 2.2),
          "defense-1": p(4.6, 6.0),
          "defense-2": p(8.0, 6.4),
          "defense-3": p(12.3, 2.6),
          "defense-4": p(7.0, 5.8),
          "defense-5": p(8.0, 5.8),
        },
        { durationSec: 1.2, defenderOf: DEFENDER_MATCHUPS },
      ),
    ]),
  },
  {
    id: PRESET_IDS[3],
    name: "模板4：传切终结 (Give & Go Pro)",
    savedAt: 1700000000004,
    thumbnail: "",
    board: boardFromFrames([
      makeFrame(
        "preset-give-and-go-kf1",
        "offense-1",
        {
          "offense-1": p(11, 6),
          "offense-2": p(7.5, 7.5),
          "offense-3": p(2, 1.5),
          "offense-4": p(13, 4.5),
          "offense-5": p(5, 3.5),
          "defense-1": p(10.3, 5.5),
          "defense-2": p(7.0, 6.8),
          "defense-3": p(2.8, 2.2),
          "defense-4": p(12.1, 4.1),
          "defense-5": p(5.4, 2.8),
        },
        { durationSec: 1.1, defenderOf: DEFENDER_MATCHUPS },
      ),
      makeFrame(
        "preset-give-and-go-kf2",
        "offense-2",
        {
          "offense-1": p(11.9, 6.9),
          "offense-2": p(7.5, 7.5),
          "offense-3": p(2, 1.5),
          "offense-4": p(13, 4.5),
          "offense-5": p(5, 3.5),
          "defense-1": p(10.9, 6.1),
          "defense-2": p(7.0, 6.9),
          "defense-3": p(2.8, 2.2),
          "defense-4": p(12.2, 4.3),
          "defense-5": p(5.5, 3.0),
        },
        { durationSec: 1.2, defenderOf: DEFENDER_MATCHUPS },
      ),
      makeFrame(
        "preset-give-and-go-kf3",
        "offense-1",
        {
          "offense-1": p(7.5, 2.8),
          "offense-2": p(7.5, 7.5),
          "offense-3": p(2, 1.5),
          "offense-4": p(13, 4.5),
          "offense-5": p(5, 3.5),
          "defense-1": p(8.3, 3.5),
          "defense-2": p(7.2, 6.8),
          "defense-3": p(2.8, 2.2),
          "defense-4": p(12.1, 4.2),
          "defense-5": p(6.8, 3.1),
        },
        { durationSec: 1.2, defenderOf: DEFENDER_MATCHUPS },
      ),
      makeFrame(
        "preset-give-and-go-kf4",
        "offense-3",
        {
          "offense-1": p(7.6, 2.4),
          "offense-2": p(7.6, 7.6),
          "offense-3": p(12.2, 2.0),
          "offense-4": p(12.8, 4.6),
          "offense-5": p(5.2, 3.6),
          "defense-1": p(8.2, 3.1),
          "defense-2": p(7.4, 6.9),
          "defense-3": p(11.6, 2.2),
          "defense-4": p(12.0, 4.3),
          "defense-5": p(6.6, 3.1),
        },
        { durationSec: 1.3, defenderOf: DEFENDER_MATCHUPS },
      ),
    ]),
  },
  {
    id: PRESET_IDS[4],
    name: "模板5：底线球 Box 进阶 (BLOB Pro)",
    savedAt: 1700000000005,
    thumbnail: "",
    board: boardFromFrames([
      makeFrame(
        "preset-blob-box-kf1",
        "offense-1",
        {
          "offense-1": p(7.5, -0.6),
          "offense-4": p(4.8, 2.8),
          "offense-2": p(4.8, 4.9),
          "offense-5": p(10.2, 2.8),
          "offense-3": p(10.2, 4.9),
          "defense-1": p(7.5, 2.7),
          "defense-2": p(5.4, 4.3),
          "defense-3": p(9.6, 4.3),
          "defense-4": p(6.3, 2.6),
          "defense-5": p(8.7, 2.6),
        },
        { durationSec: 1.1, defenderOf: DEFENDER_MATCHUPS },
      ),
      makeFrame(
        "preset-blob-box-kf2",
        "offense-1",
        {
          "offense-1": p(7.5, -0.6),
          "offense-4": p(5.6, 3.6),
          "offense-2": p(4.0, 5.8),
          "offense-5": p(9.4, 3.6),
          "offense-3": p(11.0, 5.8),
          "defense-1": p(7.4, 3.0),
          "defense-2": p(5.1, 4.9),
          "defense-3": p(9.9, 4.9),
          "defense-4": p(6.8, 3.2),
          "defense-5": p(8.3, 3.2),
        },
        {
          durationSec: 1.2,
          defenderOf: DEFENDER_MATCHUPS,
          screeningIds: ["offense-4", "offense-5"],
        },
      ),
      makeFrame(
        "preset-blob-box-kf3",
        "offense-2",
        {
          "offense-1": p(7.5, -0.6),
          "offense-2": p(1.6, 1.0),
          "offense-3": p(7.5, 7.4),
          "offense-4": p(5.8, 3.7),
          "offense-5": p(9.2, 2.2),
          "defense-1": p(7.3, 1.8),
          "defense-2": p(2.4, 1.6),
          "defense-3": p(7.7, 6.5),
          "defense-4": p(6.9, 3.0),
          "defense-5": p(8.4, 2.6),
        },
        { durationSec: 1.2, defenderOf: DEFENDER_MATCHUPS },
      ),
      makeFrame(
        "preset-blob-box-kf4",
        "offense-5",
        {
          "offense-1": p(7.5, -0.6),
          "offense-2": p(1.6, 1.0),
          "offense-3": p(7.8, 7.6),
          "offense-4": p(6.1, 3.8),
          "offense-5": p(8.1, 1.9),
          "defense-1": p(7.1, 1.6),
          "defense-2": p(2.1, 1.5),
          "defense-3": p(7.6, 6.7),
          "defense-4": p(6.8, 3.0),
          "defense-5": p(8.0, 2.4),
        },
        { durationSec: 1.3, defenderOf: DEFENDER_MATCHUPS },
      ),
    ]),
  },
];

function cloneStoredTactic(entry: StoredTactic): StoredTactic {
  return {
    ...entry,
    board: cloneBoardSnapshot(entry.board),
  };
}

function mergePresetTactics(existing: StoredTactic[]): { changed: boolean; entries: StoredTactic[] } {
  const byId = new Map(existing.map((entry) => [entry.id, entry]));
  let changed = false;
  const boardFingerprint = (board: BoardSnapshot) =>
    JSON.stringify({
      courtMode: board.courtMode,
      ballHolderId: board.ballHolderId,
      keyframes: board.keyframes,
    });
  for (const preset of PRESET_TACTICS) {
    const current = byId.get(preset.id);
    if (!current) {
      byId.set(preset.id, cloneStoredTactic(preset));
      changed = true;
      continue;
    }
    const currentFingerprint = boardFingerprint(current.board);
    const presetFingerprint = boardFingerprint(preset.board);
    const needsUpdate =
      current.name !== preset.name ||
      current.board.courtMode !== "half" ||
      current.board.keyframes.length !== preset.board.keyframes.length ||
      current.board.keyframes.some((frame) => typeof frame.durationSec !== "number") ||
      currentFingerprint !== presetFingerprint;
    if (needsUpdate) {
      byId.set(preset.id, cloneStoredTactic(preset));
      changed = true;
    }
  }
  return {
    changed,
    entries: Array.from(byId.values()),
  };
}

function makeId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function isBoardItem(value: unknown): value is BoardSnapshot["items"][number] {
  if (typeof value !== "object" || value === null) {
    return false;
  }
  const item = value as Record<string, unknown>;
  return (
    typeof item.id === "string" &&
    typeof item.x === "number" &&
    typeof item.y === "number" &&
    typeof item.color === "string" &&
    (item.label === undefined || typeof item.label === "string")
  );
}

function isDrawLine(value: unknown): value is BoardSnapshot["lines"][number] {
  if (typeof value !== "object" || value === null) {
    return false;
  }
  const line = value as Record<string, unknown>;
  return (
    typeof line.id === "string" &&
    typeof line.color === "string" &&
    Array.isArray(line.points) &&
    line.points.every((p) => typeof p === "number")
  );
}

function parseBoardSnapshot(value: unknown): BoardSnapshot {
  if (typeof value !== "object" || value === null) {
    throw new Error("无效战术数据");
  }
  const root = value as Record<string, unknown>;
  if (!Array.isArray(root.items) || !Array.isArray(root.lines)) {
    throw new Error("无效战术数据：缺少 items 或 lines");
  }
  if (!root.items.every(isBoardItem) || !root.lines.every(isDrawLine)) {
    throw new Error("无效战术数据：元素格式错误");
  }
  const mode = root.mode === "draw" || root.mode === "erase" ? root.mode : "drag";
  const courtMode = root.courtMode === "half" ? "half" : "full";
  const ballHolderId =
    typeof root.ballHolderId === "string" ? root.ballHolderId : null;
  const keyframes = parseKeyframes(root.keyframes, root.items, ballHolderId);
  const activeKeyframeIndex =
    typeof root.activeKeyframeIndex === "number"
      ? Math.max(0, Math.min(Math.floor(root.activeKeyframeIndex), keyframes.length - 1))
      : 0;
  const currentDrawingColor =
    typeof root.currentDrawingColor === "string" ? root.currentDrawingColor : "#ff4d4f";
  const theme = root.theme === "light" ? "light" : "dark";
  return cloneBoardSnapshot({
    items: root.items,
    lines: root.lines,
    ballHolderId,
    keyframes,
    activeKeyframeIndex,
    mode,
    courtMode,
    currentDrawingColor,
    theme,
  });
}

function parseKeyframes(
  value: unknown,
  items: BoardSnapshot["items"],
  fallbackHolderId: string | null,
): Keyframe[] {
  if (!Array.isArray(value)) {
    return [
      {
        id: "kf-0",
        positions: Object.fromEntries(items.map((item) => [item.id, { x: item.x, y: item.y }])),
        holderId: fallbackHolderId,
        screenIds: [],
        durationSec: 1.5,
        defenderOf: undefined,
        screeningIds: [],
      },
    ];
  }
  const frames: Keyframe[] = [];
  for (const entry of value) {
    if (typeof entry !== "object" || entry === null) {
      continue;
    }
    const row = entry as Record<string, unknown>;
    if (typeof row.id !== "string" || typeof row.positions !== "object" || row.positions === null) {
      continue;
    }
    const positions: Record<string, { x: number; y: number }> = {};
    for (const [itemId, pos] of Object.entries(row.positions as Record<string, unknown>)) {
      if (
        typeof pos === "object" &&
        pos !== null &&
        typeof (pos as Record<string, unknown>).x === "number" &&
        typeof (pos as Record<string, unknown>).y === "number"
      ) {
        positions[itemId] = {
          x: (pos as Record<string, number>).x,
          y: (pos as Record<string, number>).y,
        };
      }
    }
    frames.push({
      id: row.id,
      positions,
      holderId: typeof row.holderId === "string" ? row.holderId : null,
      screenIds: Array.isArray(row.screenIds)
        ? row.screenIds.filter((itemId): itemId is string => typeof itemId === "string")
        : [],
      durationSec:
        typeof row.durationSec === "number" && Number.isFinite(row.durationSec)
          ? Math.max(0.2, row.durationSec)
          : 1.5,
      defenderOf:
        typeof row.defenderOf === "object" && row.defenderOf !== null
          ? Object.fromEntries(
              Object.entries(row.defenderOf as Record<string, unknown>).filter(
                (entry): entry is [string, string] => typeof entry[1] === "string",
              ),
            )
          : undefined,
      screeningIds: Array.isArray(row.screeningIds)
        ? row.screeningIds.filter((itemId): itemId is string => typeof itemId === "string")
        : undefined,
    });
  }
  if (frames.length === 0) {
    return [
      {
        id: "kf-0",
        positions: Object.fromEntries(items.map((item) => [item.id, { x: item.x, y: item.y }])),
        holderId: fallbackHolderId,
        screenIds: [],
        durationSec: 1.5,
        defenderOf: undefined,
        screeningIds: [],
      },
    ];
  }
  return frames;
}

function parseStoredTactic(value: unknown): StoredTactic | null {
  if (typeof value !== "object" || value === null) {
    return null;
  }
  try {
    const row = value as Record<string, unknown>;
    if (
      typeof row.id !== "string" ||
      typeof row.name !== "string" ||
      typeof row.savedAt !== "number"
    ) {
      return null;
    }
    return {
      id: row.id,
      name: row.name,
      savedAt: row.savedAt,
      thumbnail: typeof row.thumbnail === "string" ? row.thumbnail : "",
      board: parseBoardSnapshot(row.board),
    };
  } catch {
    return null;
  }
}

export async function readLibrary(): Promise<StoredTactic[]> {
  const rows = (await storage.getItem<unknown[]>(LIBRARY_STORAGE_KEY)) ?? [];
  const parsed = (Array.isArray(rows) ? rows : [])
    .map(parseStoredTactic)
    .filter((v): v is StoredTactic => v !== null)
    .sort((a, b) => b.savedAt - a.savedAt);
  const merged = mergePresetTactics(parsed);
  if (merged.changed) {
    await writeLibrary(merged.entries);
  }
  return merged.entries.sort((a, b) => b.savedAt - a.savedAt);
}

async function writeLibrary(entries: StoredTactic[]) {
  await storage.setItem(LIBRARY_STORAGE_KEY, entries);
}

export async function saveTacticToLibrary(
  name: string,
  board: BoardSnapshot,
  thumbnail: string,
): Promise<StoredTactic> {
  const entry: StoredTactic = {
    id: makeId(),
    name: name.trim() || "未命名战术",
    savedAt: Date.now(),
    thumbnail,
    board: cloneBoardSnapshot(board),
  };
  const next = [entry, ...(await readLibrary())];
  await writeLibrary(next);
  return entry;
}

export async function renameTactic(id: string, name: string): Promise<void> {
  const next = (await readLibrary()).map((tactic) =>
    tactic.id === id ? { ...tactic, name: name.trim() || tactic.name } : tactic,
  );
  await writeLibrary(next);
}

export async function deleteTactic(id: string): Promise<void> {
  const next = (await readLibrary()).filter((tactic) => tactic.id !== id);
  await writeLibrary(next);
}

export function buildTacticFilePayload(
  name: string,
  board: BoardSnapshot,
): TacticFileV1 {
  return {
    version: 1,
    name: name.trim() || "未命名战术",
    savedAt: Date.now(),
    board: cloneBoardSnapshot(board),
  };
}

export function parseTacticFile(json: unknown): BoardSnapshot {
  if (typeof json !== "object" || json === null) {
    throw new Error("无效文件格式");
  }
  const root = json as Record<string, unknown>;
  if (root.version === 1 && root.board) {
    return parseBoardSnapshot(root.board);
  }
  return parseBoardSnapshot(root);
}

export function downloadJson(filename: string, data: unknown): void {
  const blob = new Blob([JSON.stringify(data, null, 2)], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

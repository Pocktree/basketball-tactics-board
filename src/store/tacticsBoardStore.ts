import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

export type ToolMode = "drag" | "draw" | "erase";
export type CourtMode = "full" | "half";
export type ThemeMode = "dark" | "light";
export type TeamSide = "red" | "blue";
export type PositionMeters = { x: number; y: number };
export type Keyframe = {
  id: string;
  positions: Record<string, PositionMeters>;
  holderId: string | null;
  screenIds: string[];
  durationSec?: number;
  defenderOf?: Record<string, string>;
  screeningIds?: string[];
};

export type BoardItem = {
  id: string;
  x: number; // meters (0..28)
  y: number; // meters (0..15)
  color: string;
  label?: string;
};

export type DrawLine = {
  id: string;
  points: number[];
  color: string;
};

export type BoardSnapshot = {
  items: BoardItem[];
  lines: DrawLine[];
  ballHolderId: string | null;
  keyframes: Keyframe[];
  activeKeyframeIndex: number;
  mode: ToolMode;
  courtMode: CourtMode;
  currentDrawingColor: string;
  theme: ThemeMode;
};

function createInitialItems(): BoardItem[] {
  const cx = 14;
  const cy = 7.5;

  const offense: BoardItem[] = [
    { id: "offense-1", x: cx - 2.9, y: cy - 1.8, color: "#2563eb", label: "1" },
    { id: "offense-2", x: cx - 1.9, y: cy - 1.1, color: "#2563eb", label: "2" },
    { id: "offense-3", x: cx, y: cy + 1.1, color: "#2563eb", label: "3" },
    { id: "offense-4", x: cx + 1.9, y: cy + 1.1, color: "#2563eb", label: "4" },
    { id: "offense-5", x: cx + 3.8, y: cy + 1.1, color: "#2563eb", label: "5" },
  ];

  const defense: BoardItem[] = [
    { id: "defense-1", x: cx - 4.2, y: cy + 1.9, color: "#dc2626", label: "1" },
    { id: "defense-2", x: cx - 1.7, y: cy + 1.9, color: "#dc2626", label: "2" },
    { id: "defense-3", x: cx, y: cy + 1.9, color: "#dc2626", label: "3" },
    { id: "defense-4", x: cx + 1.9, y: cy + 1.9, color: "#dc2626", label: "4" },
    { id: "defense-5", x: cx + 3.8, y: cy + 1.9, color: "#dc2626", label: "5" },
  ];

  const ball: BoardItem = {
    id: "ball",
    x: cx,
    y: cy + 0.4,
    color: "#f97316",
  };

  return [...offense, ...defense, ball];
}

function makeId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function toPositions(items: BoardItem[]): Record<string, PositionMeters> {
  const positions: Record<string, PositionMeters> = {};
  for (const item of items) {
    positions[item.id] = { x: item.x, y: item.y };
  }
  return positions;
}

function cloneKeyframe(frame: Keyframe): Keyframe {
  const positions: Record<string, PositionMeters> = {};
  for (const [id, pos] of Object.entries(frame.positions)) {
    positions[id] = { x: pos.x, y: pos.y };
  }
  return {
    id: frame.id,
    positions,
    holderId: frame.holderId,
    screenIds: [...frame.screenIds],
    durationSec: frame.durationSec,
    defenderOf: frame.defenderOf ? { ...frame.defenderOf } : undefined,
    screeningIds: frame.screeningIds ? [...frame.screeningIds] : undefined,
  };
}

function createInitialKeyframe(items: BoardItem[], holderId: string | null): Keyframe {
  return {
    id: makeId(),
    positions: toPositions(items),
    holderId,
    screenIds: [],
    durationSec: 1.5,
    defenderOf: undefined,
    screeningIds: [],
  };
}

export function cloneBoardSnapshot(state: BoardSnapshot): BoardSnapshot {
  return {
    ...state,
    items: state.items.map((item) => ({ ...item })),
    lines: state.lines.map((line) => ({ ...line, points: [...line.points] })),
    keyframes: state.keyframes.map((frame) => cloneKeyframe(frame)),
  };
}

type TacticsBoardStore = {
  items: BoardItem[];
  lines: DrawLine[];
  keyframes: Keyframe[];
  activeKeyframeIndex: number;
  isKeyframePlaying: boolean;
  mode: ToolMode;
  courtMode: CourtMode;
  currentDrawingColor: string;
  theme: ThemeMode;
  scoreboardOpen: boolean;
  redTeamName: string;
  blueTeamName: string;
  redScore: number;
  blueScore: number;
  redFouls: number;
  blueFouls: number;
  redTimeouts: number;
  blueTimeouts: number;
  period: number;
  periodDurationSec: number;
  timeLeftSec: number;
  shotClockSec: number;
  shotClockEnabled: boolean;
  isClockRunning: boolean;
  ballHolderId: string | null;
  selectedItemId: string | null;
  past: BoardSnapshot[];
  future: BoardSnapshot[];
  setMode: (mode: ToolMode) => void;
  toggleCourtMode: () => void;
  setCourtMode: (mode: CourtMode) => void;
  setCurrentDrawingColor: (color: string) => void;
  toggleTheme: () => void;
  openScoreboard: () => void;
  closeScoreboard: () => void;
  toggleClock: () => void;
  tickClock: () => void;
  resetGameClock: () => void;
  resetShotClock: () => void;
  setPeriodDurationMinutes: (minutes: number) => void;
  setPeriod: (period: number) => void;
  toggleShotClockEnabled: () => void;
  addScore: (team: TeamSide, delta: number) => void;
  resetScores: () => void;
  addFoul: (team: TeamSide, delta: number) => void;
  addTimeout: (team: TeamSide, delta: number) => void;
  resetFoulsAndTimeouts: (team?: TeamSide) => void;
  setTeamName: (team: TeamSide, name: string) => void;
  setBallHolder: (holderId: string | null) => void;
  addKeyframeAfterCurrent: () => void;
  removeKeyframe: (index: number) => void;
  setActiveKeyframeIndex: (index: number) => void;
  setKeyframePlaying: (playing: boolean) => void;
  updateActiveKeyframeItem: (id: string, x: number, y: number) => void;
  setActiveKeyframeHolder: (holderId: string | null) => void;
  toggleActiveKeyframeScreen: (id: string) => void;
  setSelectedItem: (id: string | null) => void;
  setItems: (items: BoardItem[]) => void;
  setLines: (lines: DrawLine[]) => void;
  updateItemPosition: (id: string, x: number, y: number) => void;
  removeItem: (id: string) => void;
  removeLine: (id: string) => void;
  clearLines: () => void;
  commitAfter: (previous: BoardSnapshot) => void;
  loadBoardState: (snapshot: BoardSnapshot) => void;
  undo: () => void;
  redo: () => void;
};

function getCurrentSnapshot(state: TacticsBoardStore): BoardSnapshot {
  return cloneBoardSnapshot({
    items: state.items,
    lines: state.lines,
    ballHolderId: state.ballHolderId,
    keyframes: state.keyframes,
    activeKeyframeIndex: state.activeKeyframeIndex,
    mode: state.mode,
    courtMode: state.courtMode,
    currentDrawingColor: state.currentDrawingColor,
    theme: state.theme,
  });
}

export const useTacticsBoardStore = create<TacticsBoardStore>()(
  persist(
    (set) => {
      const initialItems = createInitialItems();
      const initialKeyframe = createInitialKeyframe(initialItems, null);
      return {
  items: initialItems,
  lines: [],
  keyframes: [initialKeyframe],
  activeKeyframeIndex: 0,
  isKeyframePlaying: false,
  mode: "drag",
  courtMode: "full",
  currentDrawingColor: "#ff4d4f",
  theme: "dark",
  scoreboardOpen: false,
  redTeamName: "红队",
  blueTeamName: "蓝队",
  redScore: 0,
  blueScore: 0,
  redFouls: 0,
  blueFouls: 0,
  redTimeouts: 0,
  blueTimeouts: 0,
  period: 1,
  periodDurationSec: 600,
  timeLeftSec: 600,
  shotClockSec: 24,
  shotClockEnabled: true,
  isClockRunning: false,
  ballHolderId: null,
  selectedItemId: null,
  past: [],
  future: [],

  setMode: (mode) => set({ mode }),
  toggleCourtMode: () =>
    set((state) => ({ courtMode: state.courtMode === "full" ? "half" : "full" })),
  setCourtMode: (courtMode) => set({ courtMode }),
  setCurrentDrawingColor: (currentDrawingColor) => set({ currentDrawingColor }),
  toggleTheme: () =>
    set((state) => ({ theme: state.theme === "dark" ? "light" : "dark" })),
  openScoreboard: () => set({ scoreboardOpen: true }),
  closeScoreboard: () => set({ scoreboardOpen: false, isClockRunning: false }),
  toggleClock: () =>
    set((state) => ({
      isClockRunning: state.timeLeftSec > 0 ? !state.isClockRunning : false,
    })),
  tickClock: () =>
    set((state) => {
      if (!state.isClockRunning) {
        return state;
      }
      const nextTime = Math.max(0, state.timeLeftSec - 1);
      const nextShot = state.shotClockEnabled
        ? Math.max(0, state.shotClockSec - 1)
        : state.shotClockSec;
      return {
        timeLeftSec: nextTime,
        shotClockSec: nextShot,
        isClockRunning: nextTime > 0,
      };
    }),
  resetGameClock: () =>
    set((state) => ({
      isClockRunning: false,
      timeLeftSec: state.periodDurationSec,
      shotClockSec: 24,
    })),
  resetShotClock: () => set({ shotClockSec: 24 }),
  setPeriodDurationMinutes: (minutes) =>
    set({
      periodDurationSec: Math.max(1, Math.floor(minutes)) * 60,
      timeLeftSec: Math.max(1, Math.floor(minutes)) * 60,
      isClockRunning: false,
    }),
  setPeriod: (period) =>
    set({
      period: Math.max(1, Math.floor(period)),
    }),
  toggleShotClockEnabled: () =>
    set((state) => ({
      shotClockEnabled: !state.shotClockEnabled,
      shotClockSec: !state.shotClockEnabled ? 24 : state.shotClockSec,
    })),
  addScore: (team, delta) =>
    set((state) =>
      team === "red"
        ? { redScore: Math.max(0, state.redScore + delta) }
        : { blueScore: Math.max(0, state.blueScore + delta) },
    ),
  resetScores: () => set({ redScore: 0, blueScore: 0 }),
  addFoul: (team, delta) =>
    set((state) =>
      team === "red"
        ? { redFouls: Math.max(0, state.redFouls + delta) }
        : { blueFouls: Math.max(0, state.blueFouls + delta) },
    ),
  addTimeout: (team, delta) =>
    set((state) =>
      team === "red"
        ? { redTimeouts: Math.max(0, state.redTimeouts + delta) }
        : { blueTimeouts: Math.max(0, state.blueTimeouts + delta) },
    ),
  resetFoulsAndTimeouts: (team) =>
    set(() => {
      if (!team) {
        return {
          redFouls: 0,
          blueFouls: 0,
          redTimeouts: 0,
          blueTimeouts: 0,
        };
      }
      return team === "red"
        ? { redFouls: 0, redTimeouts: 0 }
        : { blueFouls: 0, blueTimeouts: 0 };
    }),
  setTeamName: (team, name) =>
    set(
      team === "red"
        ? { redTeamName: name.trim() || "红队" }
        : { blueTeamName: name.trim() || "蓝队" },
    ),
  setBallHolder: (ballHolderId) =>
    set((state) => {
      const keyframes = state.keyframes.map((frame, index) =>
        index === state.activeKeyframeIndex ? { ...frame, holderId: ballHolderId } : frame,
      );
      return { ballHolderId, keyframes };
    }),
  addKeyframeAfterCurrent: () =>
    set((state) => {
      const current = state.keyframes[state.activeKeyframeIndex];
      if (!current) {
        return state;
      }
      const next: Keyframe = {
        ...cloneKeyframe(current),
        id: makeId(),
      };
      const insertAt = state.activeKeyframeIndex + 1;
      const keyframes = [
        ...state.keyframes.slice(0, insertAt),
        next,
        ...state.keyframes.slice(insertAt),
      ];
      return {
        keyframes,
        activeKeyframeIndex: insertAt,
        items: state.items.map((item) => {
          const pos = next.positions[item.id];
          return pos ? { ...item, x: pos.x, y: pos.y } : item;
        }),
        ballHolderId: next.holderId,
      };
    }),
  removeKeyframe: (index) =>
    set((state) => {
      if (state.keyframes.length <= 1) {
        return state;
      }
      const safeIndex = Math.max(0, Math.min(index, state.keyframes.length - 1));
      const keyframes = state.keyframes.filter((_, frameIndex) => frameIndex !== safeIndex);
      const nextActiveIndex =
        safeIndex < state.activeKeyframeIndex
          ? state.activeKeyframeIndex - 1
          : Math.min(state.activeKeyframeIndex, keyframes.length - 1);
      const activeFrame = keyframes[nextActiveIndex];
      if (!activeFrame) {
        return state;
      }
      return {
        keyframes,
        activeKeyframeIndex: nextActiveIndex,
        items: state.items.map((item) => {
          const pos = activeFrame.positions[item.id];
          return pos ? { ...item, x: pos.x, y: pos.y } : item;
        }),
        ballHolderId: activeFrame.holderId,
      };
    }),
  setActiveKeyframeIndex: (index) =>
    set((state) => {
      const safeIndex = Math.max(0, Math.min(index, state.keyframes.length - 1));
      const frame = state.keyframes[safeIndex];
      if (!frame) {
        return state;
      }
      const items = state.items.map((item) => {
        const pos = frame.positions[item.id];
        return pos ? { ...item, x: pos.x, y: pos.y } : item;
      });
      return {
        activeKeyframeIndex: safeIndex,
        items,
        ballHolderId: frame.holderId,
      };
    }),
  setKeyframePlaying: (isKeyframePlaying) => set({ isKeyframePlaying }),
  updateActiveKeyframeItem: (id, x, y) =>
    set((state) => {
      const keyframes = state.keyframes.map((frame, index) => {
        if (index !== state.activeKeyframeIndex) {
          return frame;
        }
        return {
          ...frame,
          positions: {
            ...frame.positions,
            [id]: { x, y },
          },
        };
      });
      return {
        items: state.items.map((item) => (item.id === id ? { ...item, x, y } : item)),
        keyframes,
      };
    }),
  setActiveKeyframeHolder: (holderId) =>
    set((state) => ({
      ballHolderId: holderId,
      keyframes: state.keyframes.map((frame, index) =>
        index === state.activeKeyframeIndex ? { ...frame, holderId } : frame,
      ),
    })),
  toggleActiveKeyframeScreen: (id) =>
    set((state) => ({
      keyframes: state.keyframes.map((frame, index) => {
        if (index !== state.activeKeyframeIndex) {
          return frame;
        }
        const has = frame.screenIds.includes(id);
        return {
          ...frame,
          screenIds: has
            ? frame.screenIds.filter((itemId) => itemId !== id)
            : [...frame.screenIds, id],
        };
      }),
    })),
  setSelectedItem: (selectedItemId) => set({ selectedItemId }),
  setItems: (items) =>
    set((state) => ({
      items,
      keyframes: state.keyframes.map((frame, index) =>
        index === state.activeKeyframeIndex
          ? {
              ...frame,
              positions: toPositions(items),
              holderId: state.ballHolderId,
            }
          : frame,
      ),
    })),
  setLines: (lines) => set({ lines }),
  updateItemPosition: (id, x, y) =>
    set((state) => ({
      items: state.items.map((item) => (item.id === id ? { ...item, x, y } : item)),
      keyframes: state.keyframes.map((frame, index) =>
        index === state.activeKeyframeIndex
          ? {
              ...frame,
              positions: {
                ...frame.positions,
                [id]: { x, y },
              },
            }
          : frame,
      ),
    })),
  removeItem: (id) =>
    set((state) => ({
      items: state.items.filter((item) => item.id !== id),
      keyframes: state.keyframes.map((frame) => {
        const positions = { ...frame.positions };
        delete positions[id];
        return {
          ...frame,
          positions,
          holderId: frame.holderId === id ? null : frame.holderId,
          screenIds: frame.screenIds.filter((screenId) => screenId !== id),
        };
      }),
    })),
  removeLine: (id) =>
    set((state) => ({ lines: state.lines.filter((line) => line.id !== id) })),
  clearLines: () => set({ lines: [] }),

  commitAfter: (previous) =>
    set((state) => ({
      past: [...state.past, cloneBoardSnapshot(previous)],
      future: [],
    })),

  loadBoardState: (snapshot) => {
    const next = cloneBoardSnapshot(snapshot);
    const fallback = createInitialKeyframe(next.items, next.ballHolderId ?? null);
    const safeKeyframes = next.keyframes.length > 0 ? next.keyframes : [fallback];
    const safeIndex = Math.max(
      0,
      Math.min(next.activeKeyframeIndex ?? 0, safeKeyframes.length - 1),
    );
    set({
      items: next.items,
      lines: next.lines,
      keyframes: safeKeyframes,
      activeKeyframeIndex: safeIndex,
      isKeyframePlaying: false,
      mode: next.mode,
      courtMode: next.courtMode,
      ballHolderId: next.ballHolderId ?? null,
      currentDrawingColor: next.currentDrawingColor ?? "#ff4d4f",
      theme: next.theme ?? "dark",
      selectedItemId: null,
      past: [],
      future: [],
    });
  },

  undo: () =>
    set((state) => {
      if (state.past.length === 0) {
        return state;
      }
      const previous = state.past[state.past.length - 1];
      const now = getCurrentSnapshot(state);
      return {
        ...state,
        ...cloneBoardSnapshot(previous),
        selectedItemId: null,
        past: state.past.slice(0, -1),
        future: [now, ...state.future],
      };
    }),

  redo: () =>
    set((state) => {
      if (state.future.length === 0) {
        return state;
      }
      const [next, ...restFuture] = state.future;
      const now = getCurrentSnapshot(state);
      return {
        ...state,
        ...cloneBoardSnapshot(next),
        selectedItemId: null,
        past: [...state.past, now],
        future: restFuture,
      };
    }),
      };
    },
    {
      name: "tactics-board-store-v1",
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        theme: state.theme,
        scoreboardOpen: state.scoreboardOpen,
        redTeamName: state.redTeamName,
        blueTeamName: state.blueTeamName,
        redScore: state.redScore,
        blueScore: state.blueScore,
        redFouls: state.redFouls,
        blueFouls: state.blueFouls,
        redTimeouts: state.redTimeouts,
        blueTimeouts: state.blueTimeouts,
        period: state.period,
        periodDurationSec: state.periodDurationSec,
        timeLeftSec: state.timeLeftSec,
        shotClockSec: state.shotClockSec,
        shotClockEnabled: state.shotClockEnabled,
        isClockRunning: state.isClockRunning,
        keyframes: state.keyframes,
        activeKeyframeIndex: state.activeKeyframeIndex,
        ballHolderId: state.ballHolderId,
        items: state.items,
      }),
    },
  ),
);

export function getBoardSnapshot(): BoardSnapshot {
  return getCurrentSnapshot(useTacticsBoardStore.getState());
}

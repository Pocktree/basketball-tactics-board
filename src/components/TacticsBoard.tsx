"use client";

import { useCallback, useEffect, useRef, useState, type ChangeEvent, type ComponentType } from "react";
import Konva from "konva";
import type { Group as KonvaGroup } from "konva/lib/Group";
import type { Layer as KonvaLayer } from "konva/lib/Layer";
import type { KonvaEventObject } from "konva/lib/Node";
import type { Stage as KonvaStage } from "konva/lib/Stage";
import {
  Arc,
  Arrow,
  Circle,
  Group,
  Layer,
  Line,
  Rect,
  Stage,
  Text,
} from "react-konva";
import {
  BookOpen,
  ChevronLeft,
  Clock3,
  Eraser,
  Menu,
  Move,
  Moon,
  PenLine,
  SlidersHorizontal,
  Sun,
  Redo2,
  Pause,
  Play,
  Plus,
  Trash2,
  Undo2,
  X,
} from "lucide-react";
import { gsap } from "gsap";
import ScoreboardOverlay from "@/components/ScoreboardOverlay";
import {
  buildTacticFilePayload,
  deleteTactic,
  downloadJson,
  parseTacticFile,
  readLibrary,
  renameTactic,
  saveTacticToLibrary,
  type StoredTactic,
} from "@/lib/tacticsStorage";
import {
  getBoardSnapshot,
  useTacticsBoardStore,
  type BoardItem,
  type DrawLine,
} from "@/store/tacticsBoardStore";

const DARK_COURT_BG = "#2563EB";
const LIGHT_COURT_BG = "#FFFFFF";
const DARK_COURT_LINE = "#FFFFFF";
const LIGHT_COURT_LINE = "#000000";
const DRAW_COLORS = ["#ff4d4f", "#3b82f6", "#ffffff", "#facc15", "#22c55e"] as const;

// ===== FIBA geometry constants (meters) =====
const COURT_LENGTH = 28;
const COURT_WIDTH = 15;
const HALF_COURT_LENGTH = COURT_LENGTH / 2;

const RIM_CENTER_FROM_BASELINE = 1.575;
const THREE_POINT_RADIUS = 6.75;
const THREE_POINT_STRAIGHT_LENGTH = 2.99;
const THREE_POINT_FROM_SIDELINE = 0.9;

const FREE_THROW_LINE_LENGTH = 3.6;
const FREE_THROW_LINE_FROM_BASELINE = 5.8;
const PAINT_WIDTH = 4.9;

const CENTER_CIRCLE_RADIUS = 1.8;
const FREE_THROW_CIRCLE_RADIUS = 1.8;
const PLAYER_REAL_RADIUS = 0.4;
const BALL_REAL_RADIUS = 0.24;
const BALL_HOLD_OFFSET_M = { x: 0.36, y: -0.06 };
const OUT_OF_BOUNDS_MARGIN_M = 1.1;
const DRAW_SAMPLE_DISTANCE_M = 0.14;
const DRAW_FINAL_SIMPLIFY_DISTANCE_M = 0.18;

function createLineId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

function distanceSquared(x1: number, y1: number, x2: number, y2: number): number {
  const dx = x2 - x1;
  const dy = y2 - y1;
  return dx * dx + dy * dy;
}

function appendSampledPoint(
  points: number[],
  x: number,
  y: number,
  minDistanceSq: number,
): number[] {
  if (points.length < 2) {
    return [...points, x, y];
  }
  const lastX = points[points.length - 2];
  const lastY = points[points.length - 1];
  if (distanceSquared(lastX, lastY, x, y) < minDistanceSq) {
    return points;
  }
  return [...points, x, y];
}

function simplifyPointsByDistance(points: number[], minDistanceSq: number): number[] {
  if (points.length <= 4) {
    return points;
  }

  const simplified: number[] = [points[0], points[1]];
  let lastKeptX = points[0];
  let lastKeptY = points[1];

  for (let index = 2; index < points.length - 2; index += 2) {
    const x = points[index];
    const y = points[index + 1];
    if (distanceSquared(lastKeptX, lastKeptY, x, y) >= minDistanceSq) {
      simplified.push(x, y);
      lastKeptX = x;
      lastKeptY = y;
    }
  }

  const endX = points[points.length - 2];
  const endY = points[points.length - 1];
  const shouldAppendEnd =
    simplified[simplified.length - 2] !== endX ||
    simplified[simplified.length - 1] !== endY;
  if (shouldAppendEnd) {
    simplified.push(endX, endY);
  }

  return simplified;
}

type CourtMetrics = {
  x: number;
  y: number;
  width: number;
  height: number;
  pxPerMeter: number;
  dpr: number;
};

function alignToDevicePixel(value: number, dpr: number): number {
  return Math.round(value * dpr) / dpr;
}

function getCourtMetrics(
  containerWidth: number,
  containerHeight: number,
  courtLengthMeters: number,
  dpr: number,
): CourtMetrics {
  const marginX = 30;
  const marginTop = 86;
  const marginBottom = 54;
  const usableWidth = Math.max(containerWidth - marginX * 2, 260);
  const usableHeight = Math.max(containerHeight - marginTop - marginBottom, 180);
  const pxPerMeter = Math.min(
    usableWidth / courtLengthMeters,
    usableHeight / COURT_WIDTH,
  );
  const width = alignToDevicePixel(courtLengthMeters * pxPerMeter, dpr);
  const height = alignToDevicePixel(COURT_WIDTH * pxPerMeter, dpr);

  return {
    x: alignToDevicePixel((containerWidth - width) / 2, dpr),
    y: alignToDevicePixel((containerHeight - height) / 2, dpr),
    width,
    height,
    pxPerMeter,
    dpr,
  };
}

function CourtArc({
  x,
  y,
  radius,
  startAngle,
  endAngle,
  stroke,
  strokeWidth,
}: {
  x: number;
  y: number;
  radius: number;
  startAngle: number;
  endAngle: number;
  stroke: string;
  strokeWidth: number;
}) {
  const startDeg = (startAngle * 180) / Math.PI;
  const endDeg = (endAngle * 180) / Math.PI;
  const clockwise = endDeg < startDeg;
  const angle = Math.abs(endDeg - startDeg);

  return (
    <Arc
      x={x}
      y={y}
      innerRadius={radius}
      outerRadius={radius}
      angle={angle}
      rotation={clockwise ? endDeg : startDeg}
      clockwise={clockwise}
      stroke={stroke}
      strokeWidth={strokeWidth}
      listening={false}
    />
  );
}

function FullCourt({
  x,
  y,
  width,
  height,
  pxPerMeter,
  dpr,
  lineColor,
}: CourtMetrics & { lineColor: string }) {
  const strokeWidth = alignToDevicePixel(Math.max(1, pxPerMeter * 0.05), dpr);
  const m = (value: number) => value * pxPerMeter;
  const cy = y + m(COURT_WIDTH / 2);
  const leftRimX = x + m(RIM_CENTER_FROM_BASELINE);
  const rightRimX = x + width - m(RIM_CENTER_FROM_BASELINE);

  const paintTop = cy - m(PAINT_WIDTH / 2);

  const leftFtX = x + m(FREE_THROW_LINE_FROM_BASELINE);
  const rightFtX = x + width - m(FREE_THROW_LINE_FROM_BASELINE);

  const leftThreeTopY = y + m(THREE_POINT_FROM_SIDELINE);
  const leftThreeBottomY = y + height - m(THREE_POINT_FROM_SIDELINE);
  const leftThreeLineEndX = x + m(THREE_POINT_STRAIGHT_LENGTH);

  const rightThreeTopY = leftThreeTopY;
  const rightThreeBottomY = leftThreeBottomY;
  const rightThreeLineStartX = x + width - m(THREE_POINT_STRAIGHT_LENGTH);

  const leftArcStart = Math.atan2(
    leftThreeTopY - cy,
    leftThreeLineEndX - leftRimX,
  );
  const leftArcEnd = Math.atan2(
    leftThreeBottomY - cy,
    leftThreeLineEndX - leftRimX,
  );

  const rightArcStart = Math.atan2(
    rightThreeBottomY - cy,
    rightThreeLineStartX - rightRimX,
  );
  const rightArcEnd = Math.atan2(
    rightThreeTopY - cy,
    rightThreeLineStartX - rightRimX,
  );

  return (
    <>
      <Rect x={x} y={y} width={width} height={height} stroke={lineColor} strokeWidth={strokeWidth} />
      <Line points={[x + width / 2, y, x + width / 2, y + height]} stroke={lineColor} strokeWidth={strokeWidth} />
      <Circle x={x + width / 2} y={cy} radius={m(CENTER_CIRCLE_RADIUS)} stroke={lineColor} strokeWidth={strokeWidth} />

      <Rect
        x={x}
        y={paintTop}
        width={m(FREE_THROW_LINE_FROM_BASELINE)}
        height={m(PAINT_WIDTH)}
        stroke={lineColor}
        strokeWidth={strokeWidth}
      />
      <Rect
        x={x + width - m(FREE_THROW_LINE_FROM_BASELINE)}
        y={paintTop}
        width={m(FREE_THROW_LINE_FROM_BASELINE)}
        height={m(PAINT_WIDTH)}
        stroke={lineColor}
        strokeWidth={strokeWidth}
      />

      <Line
        points={[
          leftFtX,
          cy - m(FREE_THROW_LINE_LENGTH / 2),
          leftFtX,
          cy + m(FREE_THROW_LINE_LENGTH / 2),
        ]}
        stroke={lineColor}
        strokeWidth={strokeWidth}
      />
      <Line
        points={[
          rightFtX,
          cy - m(FREE_THROW_LINE_LENGTH / 2),
          rightFtX,
          cy + m(FREE_THROW_LINE_LENGTH / 2),
        ]}
        stroke={lineColor}
        strokeWidth={strokeWidth}
      />

      <CourtArc x={leftFtX} y={cy} radius={m(FREE_THROW_CIRCLE_RADIUS)} startAngle={-Math.PI / 2} endAngle={Math.PI / 2} stroke={lineColor} strokeWidth={strokeWidth} />
      <CourtArc x={rightFtX} y={cy} radius={m(FREE_THROW_CIRCLE_RADIUS)} startAngle={Math.PI / 2} endAngle={(3 * Math.PI) / 2} stroke={lineColor} strokeWidth={strokeWidth} />

      <Circle x={leftRimX} y={cy} radius={m(0.225)} stroke={lineColor} strokeWidth={strokeWidth} />
      <Circle x={rightRimX} y={cy} radius={m(0.225)} stroke={lineColor} strokeWidth={strokeWidth} />
      <CourtArc x={leftRimX} y={cy} radius={m(1.25)} startAngle={-Math.PI / 2} endAngle={Math.PI / 2} stroke={lineColor} strokeWidth={strokeWidth} />
      <CourtArc x={rightRimX} y={cy} radius={m(1.25)} startAngle={Math.PI / 2} endAngle={(3 * Math.PI) / 2} stroke={lineColor} strokeWidth={strokeWidth} />

      <Line points={[x, leftThreeTopY, leftThreeLineEndX, leftThreeTopY]} stroke={lineColor} strokeWidth={strokeWidth} />
      <Line points={[x, leftThreeBottomY, leftThreeLineEndX, leftThreeBottomY]} stroke={lineColor} strokeWidth={strokeWidth} />
      <Line points={[rightThreeLineStartX, rightThreeTopY, x + width, rightThreeTopY]} stroke={lineColor} strokeWidth={strokeWidth} />
      <Line points={[rightThreeLineStartX, rightThreeBottomY, x + width, rightThreeBottomY]} stroke={lineColor} strokeWidth={strokeWidth} />

      <CourtArc x={leftRimX} y={cy} radius={m(THREE_POINT_RADIUS)} startAngle={leftArcStart} endAngle={leftArcEnd} stroke={lineColor} strokeWidth={strokeWidth} />
      <CourtArc x={rightRimX} y={cy} radius={m(THREE_POINT_RADIUS)} startAngle={rightArcStart} endAngle={rightArcEnd} stroke={lineColor} strokeWidth={strokeWidth} />
    </>
  );
}

function HalfCourt({
  x,
  y,
  width,
  height,
  pxPerMeter,
  dpr,
  lineColor,
}: CourtMetrics & { lineColor: string }) {
  const strokeWidth = alignToDevicePixel(Math.max(1, pxPerMeter * 0.05), dpr);
  const m = (value: number) => value * pxPerMeter;
  const cy = y + m(COURT_WIDTH / 2);
  const rimX = x + m(RIM_CENTER_FROM_BASELINE);
  const paintTop = cy - m(PAINT_WIDTH / 2);
  const ftX = x + m(FREE_THROW_LINE_FROM_BASELINE);

  const threeTopY = y + m(THREE_POINT_FROM_SIDELINE);
  const threeBottomY = y + height - m(THREE_POINT_FROM_SIDELINE);
  const threeLineEndX = x + m(THREE_POINT_STRAIGHT_LENGTH);
  const arcStart = Math.atan2(threeTopY - cy, threeLineEndX - rimX);
  const arcEnd = Math.atan2(threeBottomY - cy, threeLineEndX - rimX);

  return (
    <>
      <Rect x={x} y={y} width={width} height={height} stroke={lineColor} strokeWidth={strokeWidth} />
      <Rect
        x={x}
        y={paintTop}
        width={m(FREE_THROW_LINE_FROM_BASELINE)}
        height={m(PAINT_WIDTH)}
        stroke={lineColor}
        strokeWidth={strokeWidth}
      />
      <Line
        points={[ftX, cy - m(FREE_THROW_LINE_LENGTH / 2), ftX, cy + m(FREE_THROW_LINE_LENGTH / 2)]}
        stroke={lineColor}
        strokeWidth={strokeWidth}
      />
      <CourtArc x={ftX} y={cy} radius={m(FREE_THROW_CIRCLE_RADIUS)} startAngle={-Math.PI / 2} endAngle={Math.PI / 2} stroke={lineColor} strokeWidth={strokeWidth} />
      <Circle x={rimX} y={cy} radius={m(0.225)} stroke={lineColor} strokeWidth={strokeWidth} />
      <CourtArc x={rimX} y={cy} radius={m(1.25)} startAngle={-Math.PI / 2} endAngle={Math.PI / 2} stroke={lineColor} strokeWidth={strokeWidth} />

      <Line points={[x, threeTopY, threeLineEndX, threeTopY]} stroke={lineColor} strokeWidth={strokeWidth} />
      <Line points={[x, threeBottomY, threeLineEndX, threeBottomY]} stroke={lineColor} strokeWidth={strokeWidth} />
      <CourtArc x={rimX} y={cy} radius={m(THREE_POINT_RADIUS)} startAngle={arcStart} endAngle={arcEnd} stroke={lineColor} strokeWidth={strokeWidth} />

      <CourtArc x={x + width} y={cy} radius={m(CENTER_CIRCLE_RADIUS)} startAngle={Math.PI / 2} endAngle={(3 * Math.PI) / 2} stroke={lineColor} strokeWidth={strokeWidth} />
    </>
  );
}

type ToolbarAction = {
  key: "drag" | "draw" | "erase" | "court" | "undo" | "redo" | "clear";
  label: string;
  icon: ComponentType<{ size?: number; className?: string }>;
  active?: boolean;
  disabled?: boolean;
  onClick: () => void;
};

function safeFilename(name: string): string {
  const cleaned = name.replace(/[/\\?%*:|"<>]/g, "-").trim();
  return cleaned.slice(0, 80) || "tactic";
}

export default function TacticsBoard() {
  const boardContainerRef = useRef<HTMLDivElement | null>(null);
  const stageRef = useRef<KonvaStage | null>(null);
  const topLayerRef = useRef<KonvaLayer | null>(null);
  const pieceNodeRefs = useRef<Record<string, KonvaGroup | null>>({});
  const passAnimationRef = useRef<Konva.Animation | null>(null);
  const importInputRef = useRef<HTMLInputElement>(null);
  const drawSnapshotRef = useRef(getBoardSnapshot());
  const dragSnapshotRef = useRef(getBoardSnapshot());
  const [activeDragId, setActiveDragId] = useState<string | null>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [viewport, setViewport] = useState({ width: 1280, height: 780 });
  const [libraryOpen, setLibraryOpen] = useState(false);
  const [saveOpen, setSaveOpen] = useState(false);
  const [saveName, setSaveName] = useState("");
  const [renameOpen, setRenameOpen] = useState(false);
  const [renameId, setRenameId] = useState<string | null>(null);
  const [renameName, setRenameName] = useState("");
  const [library, setLibrary] = useState<StoredTactic[]>([]);
  const [importError, setImportError] = useState<string | null>(null);
  const [controlPanelVisible, setControlPanelVisible] = useState(true);
  const [tacticMode, setTacticMode] = useState(false);
  const [screeningPickMode, setScreeningPickMode] = useState(false);
  const [ballPassArmed, setBallPassArmed] = useState(false);
  const [isBallPassing, setIsBallPassing] = useState(false);
  const [timelineAnimating, setTimelineAnimating] = useState(false);
  const [screenMenu, setScreenMenu] = useState<{
    x: number;
    y: number;
    playerId: string;
  } | null>(null);
  const timelineStopRef = useRef(false);
  const timelineTweenRef = useRef<gsap.core.Tween[] | null>(null);

  const items = useTacticsBoardStore((s) => s.items);
  const lines = useTacticsBoardStore((s) => s.lines);
  const keyframes = useTacticsBoardStore((s) => s.keyframes);
  const activeKeyframeIndex = useTacticsBoardStore((s) => s.activeKeyframeIndex);
  const isKeyframePlaying = useTacticsBoardStore((s) => s.isKeyframePlaying);
  const mode = useTacticsBoardStore((s) => s.mode);
  const courtMode = useTacticsBoardStore((s) => s.courtMode);
  const currentDrawingColor = useTacticsBoardStore((s) => s.currentDrawingColor);
  const theme = useTacticsBoardStore((s) => s.theme);
  const scoreboardOpen = useTacticsBoardStore((s) => s.scoreboardOpen);
  const ballHolderId = useTacticsBoardStore((s) => s.ballHolderId);
  const selectedItemId = useTacticsBoardStore((s) => s.selectedItemId);
  const canUndo = useTacticsBoardStore((s) => s.past.length > 0);
  const canRedo = useTacticsBoardStore((s) => s.future.length > 0);

  const setMode = useTacticsBoardStore((s) => s.setMode);
  const toggleCourtMode = useTacticsBoardStore((s) => s.toggleCourtMode);
  const setCurrentDrawingColor = useTacticsBoardStore((s) => s.setCurrentDrawingColor);
  const toggleTheme = useTacticsBoardStore((s) => s.toggleTheme);
  const openScoreboard = useTacticsBoardStore((s) => s.openScoreboard);
  const addKeyframeAfterCurrent = useTacticsBoardStore((s) => s.addKeyframeAfterCurrent);
  const removeKeyframe = useTacticsBoardStore((s) => s.removeKeyframe);
  const setActiveKeyframeIndex = useTacticsBoardStore((s) => s.setActiveKeyframeIndex);
  const setKeyframePlaying = useTacticsBoardStore((s) => s.setKeyframePlaying);
  const updateActiveKeyframeItem = useTacticsBoardStore((s) => s.updateActiveKeyframeItem);
  const setActiveKeyframeHolder = useTacticsBoardStore((s) => s.setActiveKeyframeHolder);
  const toggleActiveKeyframeScreen = useTacticsBoardStore((s) => s.toggleActiveKeyframeScreen);
  const setSelectedItem = useTacticsBoardStore((s) => s.setSelectedItem);
  const setLines = useTacticsBoardStore((s) => s.setLines);
  const removeLine = useTacticsBoardStore((s) => s.removeLine);
  const removeItem = useTacticsBoardStore((s) => s.removeItem);
  const clearLines = useTacticsBoardStore((s) => s.clearLines);
  const commitAfter = useTacticsBoardStore((s) => s.commitAfter);
  const loadBoardState = useTacticsBoardStore((s) => s.loadBoardState);
  const undo = useTacticsBoardStore((s) => s.undo);
  const redo = useTacticsBoardStore((s) => s.redo);

  useEffect(() => {
    const target = boardContainerRef.current;
    if (!target) {
      return;
    }

    const update = () => {
      setViewport({
        width: Math.max(target.clientWidth, 320),
        height: Math.max(target.clientHeight, 240),
      });
    };

    update();
    const observer = new ResizeObserver(update);
    observer.observe(target);
    return () => observer.disconnect();
  }, []);

  const refreshLibrary = useCallback(async () => {
    setLibrary(await readLibrary());
  }, []);

  useEffect(() => {
    let mounted = true;
    void readLibrary().then((rows) => {
      if (mounted) {
        setLibrary(rows);
      }
    });
    return () => {
      mounted = false;
    };
  }, []);

  const stageWidth = viewport.width;
  const stageHeight = viewport.height;
  const dpr =
    typeof window !== "undefined" ? window.devicePixelRatio || 1 : 1;
  const visibleStartX = 0;
  const visibleLength = courtMode === "full" ? COURT_LENGTH : HALF_COURT_LENGTH;
  const visibleEndX = visibleStartX + visibleLength;
  const court = getCourtMetrics(
    stageWidth,
    stageHeight,
    visibleLength,
    dpr,
  );
  const courtLineColor = theme === "dark" ? DARK_COURT_LINE : LIGHT_COURT_LINE;
  const courtBaseA = theme === "dark" ? DARK_COURT_BG : LIGHT_COURT_BG;
  const currentKeyframe = keyframes[activeKeyframeIndex] ?? null;
  const screenedIds = new Set([
    ...(currentKeyframe?.screeningIds ?? []),
    ...(currentKeyframe?.screenIds ?? []),
  ]);

  const getArrowPoints = (points: number[]): number[] | null => {
    if (points.length < 4) {
      return null;
    }
    return points.slice(points.length - 4);
  };

  const getPlayerGradient = (item: BoardItem, selected: boolean) => {
    if (item.id.startsWith("offense")) {
      if (theme === "light") {
        return selected ? ["#86efac", "#15803d"] : ["#4ade80", "#166534"];
      }
      return selected
        ? ["#86efac", "#16a34a"]
        : ["#4ade80", "#15803d"];
    }
    if (item.id.startsWith("defense")) {
      if (theme === "light") {
        return selected ? ["#fda4af", "#b91c1c"] : ["#f87171", "#991b1b"];
      }
      return selected
        ? ["#fda4af", "#dc2626"]
        : ["#fb7185", "#be123c"];
    }
    return ["#fdba74", "#f97316"];
  };

  const getRenderRadius = (item: BoardItem) =>
    court.pxPerMeter * (item.id === "ball" ? BALL_REAL_RADIUS : PLAYER_REAL_RADIUS);

  const getLabelSize = (radiusPx: number) =>
    Math.max(10, Math.min(26, radiusPx * 0.95));

  const toPixels = (meterX: number, meterY: number) => ({
    x: court.x + (meterX - visibleStartX) * court.pxPerMeter,
    y: court.y + meterY * court.pxPerMeter,
  });

  const toMeters = (pixelX: number, pixelY: number) => ({
    x: clamp((pixelX - court.x) / court.pxPerMeter + visibleStartX, visibleStartX, visibleEndX),
    y: clamp((pixelY - court.y) / court.pxPerMeter, 0, COURT_WIDTH),
  });

  const toMetersForPiece = (pixelX: number, pixelY: number, pieceId: string) => {
    const minX =
      pieceId === "ball" ? visibleStartX : visibleStartX - OUT_OF_BOUNDS_MARGIN_M;
    const maxX =
      pieceId === "ball" ? visibleEndX : visibleEndX + OUT_OF_BOUNDS_MARGIN_M;
    const minY = pieceId === "ball" ? 0 : -OUT_OF_BOUNDS_MARGIN_M;
    const maxY = pieceId === "ball" ? COURT_WIDTH : COURT_WIDTH + OUT_OF_BOUNDS_MARGIN_M;
    return {
      x: clamp((pixelX - court.x) / court.pxPerMeter + visibleStartX, minX, maxX),
      y: clamp((pixelY - court.y) / court.pxPerMeter, minY, maxY),
    };
  };

  const getBall = () => useTacticsBoardStore.getState().items.find((item) => item.id === "ball");
  const getPlayers = () =>
    useTacticsBoardStore.getState().items.filter((item) => item.id !== "ball");

  const getHeldBallMeters = (playerX: number, playerY: number) => ({
    x: clamp(
      playerX + BALL_HOLD_OFFSET_M.x,
      visibleStartX - OUT_OF_BOUNDS_MARGIN_M,
      visibleEndX + OUT_OF_BOUNDS_MARGIN_M,
    ),
    y: clamp(
      playerY + BALL_HOLD_OFFSET_M.y,
      -OUT_OF_BOUNDS_MARGIN_M,
      COURT_WIDTH + OUT_OF_BOUNDS_MARGIN_M,
    ),
  });

  const findBallSnapTarget = (ballX: number, ballY: number): BoardItem | null => {
    const players = getPlayers();
    let best: BoardItem | null = null;
    let bestDistSq = Number.POSITIVE_INFINITY;
    for (const player of players) {
      const distSq = distanceSquared(player.x, player.y, ballX, ballY);
      if (distSq <= 0.5 * 0.5 && distSq < bestDistSq) {
        best = player;
        bestDistSq = distSq;
      }
    }
    return best;
  };

  const startPassAnimation = (targetPlayerId: string) => {
    const state = useTacticsBoardStore.getState();
    const target = state.items.find((item) => item.id === targetPlayerId);
    const ballNode = pieceNodeRefs.current.ball;
    const ball = getBall();
    if (!target || target.id === "ball" || !ballNode || !ball) {
      return;
    }

    passAnimationRef.current?.stop();
    const fromPixels = toPixels(ball.x, ball.y);
    const heldMeters = getHeldBallMeters(target.x, target.y);
    const toPixelsPos = toPixels(heldMeters.x, heldMeters.y);
    const durationMs = 420;
    const before = getBoardSnapshot();

    setIsBallPassing(true);
    setBallPassArmed(false);
    setActiveKeyframeHolder(null);
    setSelectedItem(target.id);

    const animation = new Konva.Animation((frame) => {
      const elapsed = frame?.time ?? 0;
      const t = Math.min(1, elapsed / durationMs);
      const eased = 1 - (1 - t) * (1 - t);
      const x = fromPixels.x + (toPixelsPos.x - fromPixels.x) * eased;
      const y = fromPixels.y + (toPixelsPos.y - fromPixels.y) * eased;
      ballNode.position({ x, y });
      ballNode.getLayer()?.batchDraw();

      if (t >= 1) {
        animation.stop();
        updateActiveKeyframeItem("ball", heldMeters.x, heldMeters.y);
        setActiveKeyframeHolder(target.id);
        commitAfter(before);
        setIsBallPassing(false);
      }
    }, topLayerRef.current ?? undefined);

    passAnimationRef.current = animation;
    animation.start();
  };

  const stopTimelineTweens = () => {
    if (timelineTweenRef.current) {
      for (const tween of timelineTweenRef.current) {
        tween.kill();
      }
      timelineTweenRef.current = null;
    }
  };

  const animateToKeyframe = (
    targetIndex: number,
    options?: {
      durationSec?: number;
      excludeIds?: string[];
    },
  ): Promise<void> => {
    const safeTarget = Math.max(0, Math.min(targetIndex, keyframes.length - 1));
    if (safeTarget === activeKeyframeIndex || keyframes.length === 0) {
      setActiveKeyframeIndex(safeTarget);
      return Promise.resolve();
    }
    const targetFrame = keyframes[safeTarget];
    if (!targetFrame) {
      return Promise.resolve();
    }

    stopTimelineTweens();
    const exclude = new Set(options?.excludeIds ?? []);
    const sourceItems = useTacticsBoardStore.getState().items.map((item) => ({ ...item }));
    const tweens: gsap.core.Tween[] = [];
    const durationSec = options?.durationSec ?? targetFrame.durationSec ?? 1.1;
    const doneMap: Record<string, boolean> = {};
    let resolver: (() => void) | null = null;
    let pending = 0;

    setTimelineAnimating(true);
    setBallPassArmed(false);

    const finish = () => {
      setActiveKeyframeIndex(safeTarget);
      setActiveKeyframeHolder(targetFrame.holderId ?? null);
      setTimelineAnimating(false);
      timelineTweenRef.current = null;
      resolver?.();
    };

    const onTweenDone = (id: string) => {
      if (doneMap[id]) {
        return;
      }
      doneMap[id] = true;
      pending -= 1;
      if (pending <= 0) {
        finish();
      }
    };

    for (const item of sourceItems) {
      if (exclude.has(item.id)) {
        continue;
      }
      const node = pieceNodeRefs.current[item.id];
      const target = targetFrame.positions[item.id];
      if (!node || !target) {
        continue;
      }
      const from = sourceItems.find((row) => row.id === item.id);
      if (!from) {
        continue;
      }
      const targetPx = toPixels(target.x, target.y);
      pending += 1;
      const tween = gsap.to(node, {
        x: targetPx.x,
        y: targetPx.y,
        duration: durationSec,
        ease: "power2.inOut",
        onUpdate: () => {
          node.getLayer()?.batchDraw();
        },
        onComplete: () => onTweenDone(item.id),
      });
      tweens.push(tween);
    }

    if (pending === 0) {
      finish();
      return Promise.resolve();
    }

    timelineTweenRef.current = tweens;
    return new Promise((resolve) => {
      resolver = resolve;
    });
  };

  const playKeyframes = async () => {
    if (keyframes.length <= 1) {
      return;
    }
    timelineStopRef.current = false;
    setKeyframePlaying(true);
    for (let next = activeKeyframeIndex + 1; next < keyframes.length; next += 1) {
      if (timelineStopRef.current) {
        break;
      }
      await animateToKeyframe(next, { durationSec: 1.1 });
      if (timelineStopRef.current) {
        break;
      }
      await new Promise((resolve) => window.setTimeout(resolve, 180));
    }
    setKeyframePlaying(false);
  };

  useEffect(() => {
    Konva.pixelRatio = window.devicePixelRatio || 1;
  }, []);

  useEffect(
    () => () => {
      timelineStopRef.current = true;
      stopTimelineTweens();
      passAnimationRef.current?.stop();
    },
    [],
  );

  useEffect(() => {
    try {
      window.localStorage.removeItem("tactics-board-store-v1");
      window.localStorage.removeItem("tactics-board-store-v2");
    } catch {
      // Ignore storage access failures.
    }
  }, []);

  const onStagePointerDown = (event: KonvaEventObject<MouseEvent | TouchEvent>) => {
    setScreenMenu(null);
    if (scoreboardOpen) {
      return;
    }
    if (
      mode === "drag" &&
      ballPassArmed &&
      event.target === event.target.getStage()
    ) {
      setBallPassArmed(false);
    }
    const stage = event.target.getStage();
    const point = stage?.getPointerPosition();
    if (!point) {
      return;
    }
    if (mode === "draw") {
      const meterPoint = toMeters(point.x, point.y);
      drawSnapshotRef.current = getBoardSnapshot();
      setIsDrawing(true);
      setLines([
        ...useTacticsBoardStore.getState().lines,
        {
          id: createLineId(),
          points: [meterPoint.x, meterPoint.y],
          color: currentDrawingColor,
        },
      ]);
    }
  };

  const onStagePointerMove = (event: KonvaEventObject<MouseEvent | TouchEvent>) => {
    if (scoreboardOpen) {
      return;
    }
    if (mode !== "draw" || !isDrawing) {
      return;
    }
    const stage = event.target.getStage();
    const point = stage?.getPointerPosition();
    if (!point) {
      return;
    }
    const currentLines = useTacticsBoardStore.getState().lines;
    if (currentLines.length === 0) {
      return;
    }
    const next = [...currentLines];
    const last = next[next.length - 1];
    const meterPoint = toMeters(point.x, point.y);
    const sampledPoints = appendSampledPoint(
      last.points,
      meterPoint.x,
      meterPoint.y,
      DRAW_SAMPLE_DISTANCE_M * DRAW_SAMPLE_DISTANCE_M,
    );
    if (sampledPoints === last.points) {
      return;
    }
    next[next.length - 1] = {
      ...last,
      points: sampledPoints,
    };
    setLines(next);
  };

  const onStagePointerUp = () => {
    if (scoreboardOpen) {
      return;
    }
    if (mode === "draw" && isDrawing) {
      const currentLines = useTacticsBoardStore.getState().lines;
      if (currentLines.length > 0) {
        const next = [...currentLines];
        const last = next[next.length - 1];
        const simplifiedPoints = simplifyPointsByDistance(
          last.points,
          DRAW_FINAL_SIMPLIFY_DISTANCE_M * DRAW_FINAL_SIMPLIFY_DISTANCE_M,
        );
        if (simplifiedPoints.length !== last.points.length) {
          next[next.length - 1] = { ...last, points: simplifiedPoints };
          setLines(next);
        }
      }
      commitAfter(drawSnapshotRef.current);
      setIsDrawing(false);
    }
  };

  const onEraseLine = (id: string) => {
    if (mode !== "erase") {
      return;
    }
    const before = getBoardSnapshot();
    removeLine(id);
    commitAfter(before);
  };

  const onEraseItem = (id: string) => {
    if (mode !== "erase") {
      return;
    }
    const before = getBoardSnapshot();
    removeItem(id);
    commitAfter(before);
  };

  const onClearLines = () => {
    const before = getBoardSnapshot();
    clearLines();
    commitAfter(before);
  };

  const stopTimelinePlayback = () => {
    timelineStopRef.current = true;
    stopTimelineTweens();
    setTimelineAnimating(false);
    setKeyframePlaying(false);
  };

  const enterTacticMode = () => {
    stopTimelinePlayback();
    setMode("drag");
    setScreeningPickMode(false);
    setBallPassArmed(false);
    setControlPanelVisible(false);
    setTacticMode(true);
  };

  const exitTacticMode = () => {
    stopTimelinePlayback();
    setScreeningPickMode(false);
    setBallPassArmed(false);
    setMode("drag");
    setControlPanelVisible(true);
    setTacticMode(false);
  };

  const toolbarActions: ToolbarAction[] = [
    {
      key: "drag",
      label: "拖拽模式",
      icon: Move,
      active: mode === "drag",
      onClick: () => {
        setBallPassArmed(false);
        setMode("drag");
      },
    },
    {
      key: "draw",
      label: "画笔模式",
      icon: PenLine,
      active: mode === "draw",
      onClick: () => {
        setBallPassArmed(false);
        setMode("draw");
      },
    },
    {
      key: "erase",
      label: "橡皮擦模式",
      icon: Eraser,
      active: mode === "erase",
      onClick: () => {
        setBallPassArmed(false);
        setMode("erase");
      },
    },
    {
      key: "court",
      label: "全场/半场",
      icon: BookOpen,
      active: courtMode === "full",
      onClick: toggleCourtMode,
    },
    { key: "undo", label: "撤销", icon: Undo2, onClick: undo, disabled: !canUndo },
    { key: "redo", label: "重做", icon: Redo2, onClick: redo, disabled: !canRedo },
    { key: "clear", label: "清空", icon: Trash2, onClick: onClearLines },
  ];

  const captureThumbnail = () => {
    try {
      return stageRef.current?.toDataURL({ pixelRatio: 0.25 }) ?? "";
    } catch {
      return "";
    }
  };

  const onSaveCurrent = async () => {
    await saveTacticToLibrary(saveName, getBoardSnapshot(), captureThumbnail());
    await refreshLibrary();
    setSaveOpen(false);
    setSaveName("");
  };

  const onExport = () => {
    const name = window.prompt("导出战术名称", "未命名战术");
    if (name === null) {
      return;
    }
    const payload = buildTacticFilePayload(name, getBoardSnapshot());
    downloadJson(`${safeFilename(payload.name)}-${payload.savedAt}.json`, payload);
  };

  const onImportFile = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) {
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const raw = typeof reader.result === "string" ? reader.result : "";
        const parsed = parseTacticFile(JSON.parse(raw) as unknown);
        loadBoardState(parsed);
        setImportError(null);
      } catch (error) {
        setImportError(error instanceof Error ? error.message : "导入失败");
      }
    };
    reader.readAsText(file, "utf-8");
  };

  const onRenameTactic = async () => {
    if (!renameId) {
      return;
    }
    await renameTactic(renameId, renameName);
    await refreshLibrary();
    setRenameOpen(false);
    setRenameId(null);
    setRenameName("");
  };

  const onDeleteTactic = async (id: string) => {
    if (!window.confirm("确定删除该战术吗？")) {
      return;
    }
    await deleteTactic(id);
    await refreshLibrary();
  };

  return (
    <div
      ref={boardContainerRef}
      className="relative h-screen w-screen overflow-hidden bg-[#0b0f18] text-white"
      style={{ touchAction: "none" }}
    >
      <div className="absolute inset-0">
        <Stage
          ref={(node) => {
            stageRef.current = node;
          }}
          width={stageWidth}
          height={stageHeight}
          onMouseDown={onStagePointerDown}
          onMouseMove={onStagePointerMove}
          onMouseUp={onStagePointerUp}
          onMouseLeave={onStagePointerUp}
          onTouchStart={onStagePointerDown}
          onTouchMove={onStagePointerMove}
          onTouchEnd={onStagePointerUp}
        >
          <Layer listening={false}>
            <Rect
              x={0}
              y={0}
              width={stageWidth}
              height={stageHeight}
              fill={courtBaseA}
            />
            {Array.from({ length: 16 }).map((_, index) => (
              <Rect
                key={`stripe-${index}`}
                x={court.x + (court.width / 16) * index}
                y={court.y}
                width={court.width / 16}
                height={court.height}
                fill={
                  theme === "dark"
                    ? index % 2 === 0
                      ? "#60A5FA"
                      : "#1D4ED8"
                    : index % 2 === 0
                      ? "#DBEAFE"
                      : "#EFF6FF"
                }
                opacity={theme === "dark" ? 0.12 : 0.16}
              />
            ))}
            {courtMode === "full" ? (
              <FullCourt {...court} lineColor={courtLineColor} />
            ) : (
              <HalfCourt {...court} lineColor={courtLineColor} />
            )}
          </Layer>

          <Layer>
            {lines.map((line: DrawLine) => {
              const arrowPoints = getArrowPoints(line.points);
              const drawStroke = Math.max(2.4, court.pxPerMeter * 0.09);
              const pixelPoints: number[] = [];
              for (let i = 0; i < line.points.length; i += 2) {
                const mapped = toPixels(line.points[i], line.points[i + 1]);
                pixelPoints.push(mapped.x, mapped.y);
              }
              const pixelArrowPoints = arrowPoints
                ? (() => {
                    const p1 = toPixels(arrowPoints[0], arrowPoints[1]);
                    const p2 = toPixels(arrowPoints[2], arrowPoints[3]);
                    return [p1.x, p1.y, p2.x, p2.y];
                  })()
                : null;
              return (
                <Group key={line.id}>
                  <Line
                    points={pixelPoints}
                    stroke={line.color}
                    strokeWidth={drawStroke}
                    lineCap="round"
                    lineJoin="round"
                    tension={0.45}
                    shadowColor="#cbd5e1"
                    shadowBlur={7}
                    shadowOpacity={0.3}
                    listening={mode === "erase"}
                    onMouseDown={() => onEraseLine(line.id)}
                    onTouchStart={() => onEraseLine(line.id)}
                    perfectDrawEnabled={false}
                    shadowForStrokeEnabled={false}
                  />
                  {arrowPoints ? (
                    <Arrow
                      points={pixelArrowPoints ?? []}
                      stroke={line.color}
                      fill={line.color}
                      strokeWidth={drawStroke}
                      pointerLength={Math.max(10, drawStroke * 3.2)}
                      pointerWidth={Math.max(10, drawStroke * 3.2)}
                      lineCap="round"
                      lineJoin="round"
                      tension={0.3}
                      shadowColor="#cbd5e1"
                      shadowBlur={7}
                      shadowOpacity={0.3}
                      listening={mode === "erase"}
                      onMouseDown={() => onEraseLine(line.id)}
                      onTouchStart={() => onEraseLine(line.id)}
                      perfectDrawEnabled={false}
                      shadowForStrokeEnabled={false}
                    />
                  ) : null}
                </Group>
              );
            })}
          </Layer>

          <Layer listening={false}>
            {tacticMode && keyframes.length > 1
              ? items
                  .filter((item) => item.id !== "ball")
                  .map((item) => {
                    const pathPoints: number[] = [];
                    const waypoints: { x: number; y: number; frameId: string }[] = [];
                    for (const frame of keyframes) {
                      const pos = frame.positions[item.id];
                      if (!pos) {
                        continue;
                      }
                      const point = toPixels(pos.x, pos.y);
                      pathPoints.push(point.x, point.y);
                      waypoints.push({ x: point.x, y: point.y, frameId: frame.id });
                    }
                    if (pathPoints.length < 4) {
                      return null;
                    }
                    const isSelectedPath = selectedItemId === item.id;
                    const currentPos = currentKeyframe?.positions[item.id];
                    const currentPx = currentPos ? toPixels(currentPos.x, currentPos.y) : null;
                    return (
                      <Group key={`ghost-path-${item.id}`}>
                        <Line
                          points={pathPoints}
                          stroke={isSelectedPath ? "#22d3ee" : "#a5b4fc"}
                          strokeWidth={Math.max(
                            isSelectedPath ? 1.8 : 1,
                            court.pxPerMeter * (isSelectedPath ? 0.05 : 0.03),
                          )}
                          dash={[8, 8]}
                          opacity={isSelectedPath ? 0.95 : 0.4}
                          lineCap="round"
                          lineJoin="round"
                        />
                        {waypoints.map((point, index) => (
                          <Circle
                            key={`${item.id}-${point.frameId}-${index}`}
                            x={point.x}
                            y={point.y}
                            radius={Math.max(
                              isSelectedPath ? 4 : 3,
                              getRenderRadius(item) * (isSelectedPath ? 0.34 : 0.28),
                            )}
                            stroke={isSelectedPath ? "#67e8f9" : "#c7d2fe"}
                            strokeWidth={Math.max(
                              1,
                              court.pxPerMeter * (isSelectedPath ? 0.03 : 0.02),
                            )}
                            dash={[4, 3]}
                            opacity={isSelectedPath ? 0.95 : 0.58}
                          />
                        ))}
                        {currentPx ? (
                          <Circle
                            x={currentPx.x}
                            y={currentPx.y}
                            radius={getRenderRadius(item) * (isSelectedPath ? 0.92 : 0.82)}
                            stroke={isSelectedPath ? "#22d3ee" : "#bfdbfe"}
                            strokeWidth={Math.max(
                              1,
                              court.pxPerMeter * (isSelectedPath ? 0.05 : 0.03),
                            )}
                            opacity={isSelectedPath ? 0.8 : 0.46}
                          />
                        ) : null}
                      </Group>
                    );
                  })
              : null}
          </Layer>

          <Layer ref={topLayerRef}>
            {items.map((item: BoardItem) => {
              const selected = selectedItemId === item.id || activeDragId === item.id;
              const renderRadius = getRenderRadius(item);
              const labelSize = getLabelSize(renderRadius);
              const [gradStart, gradEnd] = getPlayerGradient(item, selected);
              const dragging = activeDragId === item.id;
              const pixelPos = toPixels(item.x, item.y);
              const isBall = item.id === "ball";
              const isBallHolder = !isBall && ballHolderId === item.id;

              return (
                <Group
                  key={item.id}
                  ref={(node) => {
                    pieceNodeRefs.current[item.id] = node;
                  }}
                  x={pixelPos.x}
                  y={pixelPos.y}
                  draggable={
                    mode === "drag" && !scoreboardOpen && !isBallPassing && !timelineAnimating
                  }
                  dragBoundFunc={(pos) => {
                    const outsidePx = OUT_OF_BOUNDS_MARGIN_M * court.pxPerMeter;
                    const minX =
                      item.id === "ball"
                        ? court.x + renderRadius
                        : court.x - outsidePx + renderRadius;
                    const maxX =
                      item.id === "ball"
                        ? court.x + court.width - renderRadius
                        : court.x + court.width + outsidePx - renderRadius;
                    const minY =
                      item.id === "ball"
                        ? court.y + renderRadius
                        : court.y - outsidePx + renderRadius;
                    const maxY =
                      item.id === "ball"
                        ? court.y + court.height - renderRadius
                        : court.y + court.height + outsidePx - renderRadius;
                    return {
                      x: clamp(pos.x, minX, maxX),
                      y: clamp(pos.y, minY, maxY),
                    };
                  }}
                  onClick={() => {
                    if (mode === "erase") {
                      onEraseItem(item.id);
                    } else if (
                      tacticMode &&
                      screeningPickMode &&
                      mode === "drag" &&
                      item.id.startsWith("offense")
                    ) {
                      toggleActiveKeyframeScreen(item.id);
                      setSelectedItem(item.id);
                    } else if (mode === "drag") {
                      if (isBall) {
                        setBallPassArmed(true);
                        setSelectedItem(item.id);
                      } else if (ballPassArmed) {
                        startPassAnimation(item.id);
                      } else {
                        setSelectedItem(item.id);
                      }
                    } else {
                      setSelectedItem(item.id);
                    }
                  }}
                  onTap={() => {
                    if (mode === "erase") {
                      onEraseItem(item.id);
                    } else if (
                      tacticMode &&
                      screeningPickMode &&
                      mode === "drag" &&
                      item.id.startsWith("offense")
                    ) {
                      toggleActiveKeyframeScreen(item.id);
                      setSelectedItem(item.id);
                    } else if (mode === "drag") {
                      if (isBall) {
                        setBallPassArmed(true);
                        setSelectedItem(item.id);
                      } else if (ballPassArmed) {
                        startPassAnimation(item.id);
                      } else {
                        setSelectedItem(item.id);
                      }
                    } else {
                      setSelectedItem(item.id);
                    }
                  }}
                  onDblClick={() => {
                    if (mode === "drag" && !screeningPickMode && item.id !== "ball") {
                      startPassAnimation(item.id);
                    }
                  }}
                  onDblTap={() => {
                    if (mode === "drag" && !screeningPickMode && item.id !== "ball") {
                      startPassAnimation(item.id);
                    }
                  }}
                  onContextMenu={(event) => {
                    if (!item.id.startsWith("offense")) {
                      return;
                    }
                    event.evt.preventDefault();
                    if (mode !== "drag") {
                      return;
                    }
                    setScreenMenu({
                      x: event.evt.clientX,
                      y: event.evt.clientY,
                      playerId: item.id,
                    });
                  }}
                  onDragStart={(event) => {
                    dragSnapshotRef.current = getBoardSnapshot();
                    setSelectedItem(item.id);
                    if (isBall) {
                      setActiveKeyframeHolder(null);
                    }
                    setActiveDragId(item.id);
                    event.target.moveToTop();
                    event.target.getLayer()?.batchDraw();
                  }}
                  onDragMove={(event) => {
                    const meter = toMetersForPiece(event.target.x(), event.target.y(), item.id);
                    updateActiveKeyframeItem(item.id, meter.x, meter.y);
                    if (isBallHolder) {
                      const held = getHeldBallMeters(meter.x, meter.y);
                      const heldPx = toPixels(held.x, held.y);
                      const ballNode = pieceNodeRefs.current.ball;
                      if (ballNode) {
                        ballNode.position(heldPx);
                        ballNode.getLayer()?.batchDraw();
                      }
                      updateActiveKeyframeItem("ball", held.x, held.y);
                    }
                  }}
                  onDragEnd={(event) => {
                    const meter = toMetersForPiece(event.target.x(), event.target.y(), item.id);
                    updateActiveKeyframeItem(item.id, meter.x, meter.y);
                    if (isBall) {
                      const snapTarget = findBallSnapTarget(meter.x, meter.y);
                      if (snapTarget) {
                        const held = getHeldBallMeters(snapTarget.x, snapTarget.y);
                        updateActiveKeyframeItem("ball", held.x, held.y);
                        setActiveKeyframeHolder(snapTarget.id);
                      } else {
                        setActiveKeyframeHolder(null);
                      }
                    } else {
                      const ball = getBall();
                      if (isBallHolder) {
                        const held = getHeldBallMeters(meter.x, meter.y);
                        updateActiveKeyframeItem("ball", held.x, held.y);
                        setActiveKeyframeHolder(item.id);
                      } else if (ball) {
                        const distSq = distanceSquared(meter.x, meter.y, ball.x, ball.y);
                        if (distSq <= 0.5 * 0.5) {
                          const held = getHeldBallMeters(meter.x, meter.y);
                          updateActiveKeyframeItem("ball", held.x, held.y);
                          setActiveKeyframeHolder(item.id);
                        }
                      }
                    }
                    setBallPassArmed(false);
                    setActiveDragId(null);
                    commitAfter(dragSnapshotRef.current);
                    event.target.getLayer()?.batchDraw();
                  }}
                >
                  {selected ? (
                    <>
                      <Circle
                        y={renderRadius * 0.9}
                        radius={renderRadius * 0.95}
                        fill="rgba(96,165,250,0.35)"
                        opacity={0.45}
                        scaleY={0.32}
                        shadowColor="#93c5fd"
                        shadowBlur={dragging ? 0 : 18}
                        shadowOpacity={dragging ? 0 : 0.5}
                        listening={false}
                        perfectDrawEnabled={false}
                        shadowForStrokeEnabled={false}
                      />
                      <Circle
                        y={renderRadius * 0.9}
                        radius={renderRadius * 1.35}
                        fill="rgba(147,197,253,0.2)"
                        opacity={0.3}
                        scaleY={0.22}
                        listening={false}
                        perfectDrawEnabled={false}
                        shadowForStrokeEnabled={false}
                      />
                    </>
                  ) : null}
                  {screenedIds.has(item.id) ? (
                    <Circle
                      radius={renderRadius * 1.26}
                      stroke="#facc15"
                      strokeWidth={Math.max(1.8, renderRadius * 0.16)}
                      dash={[6, 4]}
                      opacity={0.92}
                      listening={false}
                    />
                  ) : null}
                  <Circle
                    radius={renderRadius}
                    fillLinearGradientStartPoint={{ x: -renderRadius, y: -renderRadius }}
                    fillLinearGradientEndPoint={{ x: renderRadius, y: renderRadius }}
                    fillLinearGradientColorStops={[0, gradStart, 1, gradEnd]}
                    shadowColor={selected ? "#93c5fd" : theme === "light" ? "#0f172a" : "#020617"}
                    shadowBlur={dragging ? 0 : selected ? 24 : theme === "light" ? 14 : 11}
                    shadowOpacity={dragging ? 0 : selected ? 0.85 : theme === "light" ? 0.55 : 0.45}
                    stroke={selected ? "#93c5fd" : "rgba(255,255,255,0.06)"}
                    strokeWidth={selected ? Math.max(1.2, renderRadius * 0.12) : Math.max(0.8, renderRadius * 0.05)}
                    perfectDrawEnabled={false}
                    shadowForStrokeEnabled={false}
                  />
                  {item.label ? (
                    <Text
                      x={-renderRadius}
                      y={-renderRadius}
                      width={renderRadius * 2}
                      height={renderRadius * 2}
                      align="center"
                      verticalAlign="middle"
                      text={item.label}
                      fill="#ffffff"
                      fontStyle="bold"
                      fontSize={labelSize}
                      listening={false}
                    />
                  ) : null}
                </Group>
              );
            })}
          </Layer>
        </Stage>
      </div>

      {controlPanelVisible && !tacticMode ? (
        <div className="pointer-events-none absolute left-1/2 top-4 z-30 -translate-x-1/2">
          <div className="pointer-events-auto flex flex-col gap-2 rounded-xl border border-white/20 bg-blue-950/70 px-3 py-2 shadow-2xl backdrop-blur-md">
            <div className="flex items-end gap-1">
              {toolbarActions.map(({ key, label, icon: Icon, onClick, active, disabled }) => (
                <button
                  key={key}
                  type="button"
                  disabled={disabled}
                  onClick={onClick}
                  className={[
                    "group flex w-[72px] transform flex-col items-center justify-center gap-1 rounded-lg px-2 py-1 transition duration-200",
                    active ? "bg-sky-400/25 text-sky-200" : "text-slate-100 hover:bg-white/12",
                    disabled ? "cursor-not-allowed opacity-40" : "hover:scale-105 active:scale-95",
                  ].join(" ")}
                >
                  <Icon size={16} />
                  <span className="text-[11px]">{label}</span>
                </button>
              ))}
              <button
                type="button"
                onClick={() => {
                  setBallPassArmed(false);
                  openScoreboard();
                }}
                className="group flex w-[72px] transform flex-col items-center justify-center gap-1 rounded-lg px-2 py-1 text-slate-100 transition duration-200 hover:scale-105 hover:bg-white/12 active:scale-95"
              >
                <Clock3 size={16} />
                <span className="text-[11px]">计时/计分</span>
              </button>
              <button
                type="button"
                onClick={enterTacticMode}
                className="group flex w-[72px] transform flex-col items-center justify-center gap-1 rounded-lg px-2 py-1 text-slate-100 transition duration-200 hover:scale-105 hover:bg-white/12 active:scale-95"
              >
                <Play size={16} />
                <span className="text-[11px]">战术模式</span>
              </button>
            </div>
            {mode === "draw" ? (
              <div className="flex items-center justify-center gap-2">
                <span className="text-[11px] text-slate-200">画笔颜色</span>
                {DRAW_COLORS.map((color) => (
                  <button
                    key={color}
                    type="button"
                    onClick={() => setCurrentDrawingColor(color)}
                    className={[
                      "h-5 w-5 rounded-full border transition",
                      currentDrawingColor === color
                        ? "scale-110 border-white ring-2 ring-white/40"
                        : "border-white/40 hover:scale-105",
                    ].join(" ")}
                    style={{ backgroundColor: color }}
                    aria-label={`选择颜色 ${color}`}
                  />
                ))}
              </div>
            ) : null}
          </div>
        </div>
      ) : null}

      {tacticMode ? (
        <div className="pointer-events-none absolute left-1/2 top-4 z-40 -translate-x-1/2">
          <div className="pointer-events-auto flex items-center justify-between gap-2 rounded-xl border border-white/20 bg-blue-950/80 px-3 py-2 shadow-2xl backdrop-blur-md">
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => {
                  addKeyframeAfterCurrent();
                }}
                className="flex items-center gap-1 rounded bg-white/10 px-2 py-1 text-[11px] hover:bg-white/20"
                aria-label="插入关键帧"
              >
                <Plus size={13} />
                <span>关键帧</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  if (isKeyframePlaying) {
                    stopTimelinePlayback();
                  } else {
                    void playKeyframes();
                  }
                }}
                disabled={keyframes.length <= 1}
                className={[
                  "flex items-center gap-1 rounded px-2 py-1 text-[11px]",
                  keyframes.length <= 1
                    ? "cursor-not-allowed bg-white/10 opacity-40"
                    : "bg-emerald-500/25 hover:bg-emerald-500/40",
                ].join(" ")}
              >
                {isKeyframePlaying ? <Pause size={13} /> : <Play size={13} />}
                <span>{isKeyframePlaying ? "暂停" : "播放"}</span>
              </button>
              <button
                type="button"
                onClick={() => setScreeningPickMode((value) => !value)}
                className={[
                  "rounded px-2 py-1 text-[11px]",
                  screeningPickMode
                    ? "bg-amber-500/35 hover:bg-amber-500/50"
                    : "bg-white/10 hover:bg-white/20",
                ].join(" ")}
              >
                {screeningPickMode ? "点球员设掩护" : "设置掩护点"}
              </button>
              <button
                type="button"
                onClick={() => {
                  setSaveName("");
                  setSaveOpen(true);
                }}
                className="rounded bg-sky-500/30 px-2 py-1 text-[11px] hover:bg-sky-500/45"
              >
                保存战术
              </button>
              <button
                type="button"
                onClick={onExport}
                className="rounded bg-white/10 px-2 py-1 text-[11px] hover:bg-white/20"
              >
                导出
              </button>
              <button
                type="button"
                onClick={() => importInputRef.current?.click()}
                className="rounded bg-white/10 px-2 py-1 text-[11px] hover:bg-white/20"
              >
                导入
              </button>
            </div>
            <div className="max-w-[420px] overflow-x-auto">
              <div className="flex items-center gap-1 pr-1">
                {keyframes.map((frame, index) => (
                  <div
                    key={frame.id}
                    className={[
                      "flex items-center rounded border text-[11px]",
                      index === activeKeyframeIndex
                        ? "border-sky-300/60 bg-sky-400/25 text-sky-100"
                        : "border-white/20 bg-white/5 text-slate-100",
                    ].join(" ")}
                  >
                    <button
                      type="button"
                      onClick={() => {
                        if (index === activeKeyframeIndex) {
                          return;
                        }
                        void animateToKeyframe(index, { durationSec: 0.46 });
                      }}
                      className="min-w-[42px] px-2 py-1 hover:bg-white/10"
                    >
                      帧{index + 1}
                    </button>
                    <button
                      type="button"
                      onClick={(event) => {
                        event.stopPropagation();
                        if (keyframes.length <= 1) {
                          return;
                        }
                        stopTimelinePlayback();
                        removeKeyframe(index);
                      }}
                      disabled={keyframes.length <= 1}
                      className={[
                        "border-l border-white/20 px-1.5 py-1 leading-none",
                        keyframes.length <= 1
                          ? "cursor-not-allowed opacity-40"
                          : "hover:bg-rose-500/30",
                      ].join(" ")}
                      aria-label={`删除关键帧 ${index + 1}`}
                      title={`删除关键帧 ${index + 1}`}
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            </div>
            <button
              type="button"
              onClick={exitTacticMode}
              className="flex items-center gap-1 rounded bg-white/10 px-2 py-1 text-[11px] hover:bg-white/20"
            >
              <X size={13} />
              <span>退出</span>
            </button>
          </div>
        </div>
      ) : null}

      <div className="absolute left-4 top-4 z-40 flex items-center gap-2">
        <button
          type="button"
          className="rounded-lg border border-white/15 bg-slate-900/70 p-2 text-slate-100 backdrop-blur-md hover:bg-slate-800/80"
          onClick={() => setLibraryOpen((v) => !v)}
        >
          <Menu size={18} />
        </button>
        <button
          type="button"
          className={[
            "rounded-lg border p-2 backdrop-blur-md",
            controlPanelVisible
              ? "border-sky-300/40 bg-sky-500/20 text-sky-100"
              : "border-white/15 bg-slate-900/70 text-slate-100 hover:bg-slate-800/80",
          ].join(" ")}
          onClick={() => setControlPanelVisible((v) => !v)}
          aria-label="显示或隐藏控制面板"
        >
          <SlidersHorizontal size={18} />
        </button>
      </div>

      <div className="absolute right-4 top-4 z-40">
        <button
          type="button"
          onClick={toggleTheme}
          className="rounded-lg border border-white/15 bg-slate-900/70 p-2 text-slate-100 backdrop-blur-md hover:bg-slate-800/80"
          aria-label="切换主题"
        >
          {theme === "dark" ? <Sun size={18} /> : <Moon size={18} />}
        </button>
      </div>

      <aside
        className={[
          "absolute left-0 top-0 z-50 h-full w-[300px] border-r border-white/10 bg-slate-900/80 p-4 shadow-2xl backdrop-blur-xl transition-transform duration-500",
          "ease-out",
          libraryOpen ? "translate-x-0" : "-translate-x-full",
        ].join(" ")}
      >
        <div className="mb-2 flex items-center justify-between">
          <h2 className="text-sm font-semibold tracking-wide text-slate-100">战术库</h2>
          <button
            type="button"
            onClick={() => setLibraryOpen(false)}
            className="rounded-md p-1 text-slate-300 hover:bg-white/10 hover:text-white"
            aria-label="隐藏战术库"
          >
            <ChevronLeft size={16} />
          </button>
        </div>
        <div className="mt-4 space-y-2">
          <button
            type="button"
            onClick={() => {
              setSaveName("");
              setSaveOpen(true);
            }}
            className="w-full rounded-md bg-slate-800 px-3 py-2 text-xs font-semibold tracking-wide text-slate-100 hover:bg-slate-700"
          >
            保存当前战术
          </button>
          <button
            type="button"
            onClick={onExport}
            className="w-full rounded-md border border-slate-600 bg-slate-900 px-3 py-2 text-xs font-semibold tracking-wide text-slate-100 hover:bg-slate-800"
          >
            导出 JSON
          </button>
          <button
            type="button"
            onClick={() => importInputRef.current?.click()}
            className="w-full rounded-md border border-slate-600 bg-slate-900 px-3 py-2 text-xs font-semibold tracking-wide text-slate-100 hover:bg-slate-800"
          >
            导入 JSON
          </button>
          <input
            ref={importInputRef}
            type="file"
            accept=".json,application/json"
            className="hidden"
            onChange={onImportFile}
          />
          {importError ? <p className="text-xs text-rose-300">{importError}</p> : null}
        </div>

        <div className="mt-4 border-t border-white/10 pt-4">
          <p className="mb-2 text-[11px] font-semibold tracking-wide text-slate-300">已保存战术</p>
          <div className="space-y-2 overflow-y-auto pr-1">
            {library.map((tactic) => (
              <div
                key={tactic.id}
                className="flex w-full items-center gap-2 rounded-lg border border-white/10 bg-slate-800/80 p-2 hover:bg-slate-700/80"
              >
                <button
                  type="button"
                  onClick={() => loadBoardState(tactic.board)}
                  className="flex min-w-0 flex-1 items-center text-left"
                >
                  <span className="min-w-0 flex-1 truncate text-xs text-slate-100">{tactic.name}</span>
                </button>
                <button
                  type="button"
                  onClick={(event) => {
                    event.stopPropagation();
                    setRenameId(tactic.id);
                    setRenameName(tactic.name);
                    setRenameOpen(true);
                  }}
                  className="rounded p-1 text-slate-300 hover:bg-slate-600 hover:text-white"
                >
                  <PenLine size={14} />
                </button>
                <button
                  type="button"
                  onClick={(event) => {
                    event.stopPropagation();
                    void onDeleteTactic(tactic.id);
                  }}
                  className="rounded p-1 text-slate-300 hover:bg-rose-500/30 hover:text-rose-100"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
          </div>
        </div>
      </aside>

      {screenMenu ? (
        <div
          className="absolute z-[70] rounded-md border border-white/15 bg-slate-900/95 p-1 shadow-xl"
          style={{ left: screenMenu.x, top: screenMenu.y }}
        >
          <button
            type="button"
            onClick={() => {
              toggleActiveKeyframeScreen(screenMenu.playerId);
              setScreenMenu(null);
            }}
            className="rounded px-2 py-1 text-xs text-slate-100 hover:bg-white/10"
          >
            {screenedIds.has(screenMenu.playerId) ? "取消掩护点" : "设为掩护点"}
          </button>
        </div>
      ) : null}

      <ScoreboardOverlay />

      {renameOpen ? (
        <div className="absolute inset-0 z-[61] flex items-center justify-center bg-black/45 p-4">
          <div className="w-full max-w-sm rounded-xl border border-white/15 bg-slate-900 p-5 shadow-2xl">
            <h3 className="text-sm font-semibold text-slate-100">重命名战术</h3>
            <p className="mt-1 text-xs text-slate-300">请输入新的战术名称</p>
            <input
              value={renameName}
              onChange={(event) => setRenameName(event.target.value)}
              className="mt-3 w-full rounded-md border border-slate-600 bg-slate-800 px-3 py-2 text-sm text-slate-100 outline-none focus:border-blue-400"
              placeholder="战术名称"
              autoFocus
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  void onRenameTactic();
                } else if (event.key === "Escape") {
                  setRenameOpen(false);
                  setRenameId(null);
                  setRenameName("");
                }
              }}
            />
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                className="rounded-md px-3 py-1.5 text-xs text-slate-200 hover:bg-slate-800"
                onClick={() => {
                  setRenameOpen(false);
                  setRenameId(null);
                  setRenameName("");
                }}
              >
                取消
              </button>
              <button
                type="button"
                className="rounded-md bg-blue-500 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-400"
                onClick={() => {
                  void onRenameTactic();
                }}
              >
                保存
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {saveOpen ? (
        <div className="absolute inset-0 z-[60] flex items-center justify-center bg-black/45 p-4">
          <div className="w-full max-w-sm rounded-xl border border-white/15 bg-slate-900 p-5 shadow-2xl">
            <h3 className="text-sm font-semibold text-slate-100">保存战术</h3>
            <p className="mt-1 text-xs text-slate-300">请输入战术名称（如：绝杀球-底线跑位）</p>
            <input
              value={saveName}
              onChange={(event) => setSaveName(event.target.value)}
              className="mt-3 w-full rounded-md border border-slate-600 bg-slate-800 px-3 py-2 text-sm text-slate-100 outline-none focus:border-blue-400"
              placeholder="战术名称"
              autoFocus
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  void onSaveCurrent();
                }
              }}
            />
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                className="rounded-md px-3 py-1.5 text-xs text-slate-200 hover:bg-slate-800"
                onClick={() => setSaveOpen(false)}
              >
                取消
              </button>
              <button
                type="button"
                className="rounded-md bg-blue-500 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-400"
                onClick={() => {
                  void onSaveCurrent();
                }}
              >
                保存
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

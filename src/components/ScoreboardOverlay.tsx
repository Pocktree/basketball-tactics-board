"use client";

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type MouseEvent,
  type PointerEvent,
} from "react";
import { Pause, Play, RotateCcw, Settings2, X } from "lucide-react";
import { useTacticsBoardStore, type TeamSide } from "@/store/tacticsBoardStore";

type QuickMenuState = {
  open: boolean;
  x: number;
  y: number;
  team: TeamSide;
};

const LONG_PRESS_MS = 420;
const RESET_SCORE_CONFIRM_MS = 3000;

function formatClock(totalSeconds: number): string {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

function formatScore(score: number): string {
  return String(Math.max(0, score)).padStart(3, "0");
}

export default function ScoreboardOverlay() {
  const scoreboardOpen = useTacticsBoardStore((s) => s.scoreboardOpen);
  const redTeamName = useTacticsBoardStore((s) => s.redTeamName);
  const blueTeamName = useTacticsBoardStore((s) => s.blueTeamName);
  const redScore = useTacticsBoardStore((s) => s.redScore);
  const blueScore = useTacticsBoardStore((s) => s.blueScore);
  const redFouls = useTacticsBoardStore((s) => s.redFouls);
  const blueFouls = useTacticsBoardStore((s) => s.blueFouls);
  const redTimeouts = useTacticsBoardStore((s) => s.redTimeouts);
  const blueTimeouts = useTacticsBoardStore((s) => s.blueTimeouts);
  const period = useTacticsBoardStore((s) => s.period);
  const periodDurationSec = useTacticsBoardStore((s) => s.periodDurationSec);
  const timeLeftSec = useTacticsBoardStore((s) => s.timeLeftSec);
  const shotClockSec = useTacticsBoardStore((s) => s.shotClockSec);
  const shotClockEnabled = useTacticsBoardStore((s) => s.shotClockEnabled);
  const isClockRunning = useTacticsBoardStore((s) => s.isClockRunning);

  const closeScoreboard = useTacticsBoardStore((s) => s.closeScoreboard);
  const toggleClock = useTacticsBoardStore((s) => s.toggleClock);
  const tickClock = useTacticsBoardStore((s) => s.tickClock);
  const resetGameClock = useTacticsBoardStore((s) => s.resetGameClock);
  const resetShotClock = useTacticsBoardStore((s) => s.resetShotClock);
  const setPeriodDurationMinutes = useTacticsBoardStore((s) => s.setPeriodDurationMinutes);
  const setPeriod = useTacticsBoardStore((s) => s.setPeriod);
  const toggleShotClockEnabled = useTacticsBoardStore((s) => s.toggleShotClockEnabled);
  const addScore = useTacticsBoardStore((s) => s.addScore);
  const resetScores = useTacticsBoardStore((s) => s.resetScores);
  const addFoul = useTacticsBoardStore((s) => s.addFoul);
  const addTimeout = useTacticsBoardStore((s) => s.addTimeout);
  const resetFoulsAndTimeouts = useTacticsBoardStore((s) => s.resetFoulsAndTimeouts);
  const setTeamName = useTacticsBoardStore((s) => s.setTeamName);

  const [settingsOpen, setSettingsOpen] = useState(false);
  const [periodMinutesInput, setPeriodMinutesInput] = useState(
    String(Math.floor(periodDurationSec / 60)),
  );
  const [periodInput, setPeriodInput] = useState(String(period));
  const [editingTeam, setEditingTeam] = useState<TeamSide | null>(null);
  const [teamNameDraft, setTeamNameDraft] = useState("");
  const [quickMenu, setQuickMenu] = useState<QuickMenuState>({
    open: false,
    x: 0,
    y: 0,
    team: "red",
  });
  const longPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const resetScoreConfirmTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const suppressClickRef = useRef(false);
  const [scoreResetConfirming, setScoreResetConfirming] = useState(false);

  useEffect(() => {
    if (!scoreboardOpen) {
      setScoreResetConfirming(false);
      if (resetScoreConfirmTimerRef.current) {
        clearTimeout(resetScoreConfirmTimerRef.current);
        resetScoreConfirmTimerRef.current = null;
      }
      return;
    }
    const timer = setInterval(() => {
      tickClock();
    }, 1000);
    return () => clearInterval(timer);
  }, [scoreboardOpen, tickClock]);

  useEffect(() => {
    if (!scoreboardOpen) {
      return;
    }

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.code === "Space") {
        event.preventDefault();
        toggleClock();
      } else if (event.key === "ArrowLeft") {
        event.preventDefault();
        addScore("red", 1);
      } else if (event.key === "ArrowRight") {
        event.preventDefault();
        addScore("blue", 1);
      } else if (event.key === "Escape") {
        event.preventDefault();
        closeScoreboard();
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [scoreboardOpen, toggleClock, addScore, closeScoreboard]);

  useEffect(() => {
    const closeMenus = () => setQuickMenu((prev) => ({ ...prev, open: false }));
    window.addEventListener("pointerdown", closeMenus);
    return () => window.removeEventListener("pointerdown", closeMenus);
  }, []);

  useEffect(
    () => () => {
      if (resetScoreConfirmTimerRef.current) {
        clearTimeout(resetScoreConfirmTimerRef.current);
      }
    },
    [],
  );

  useEffect(() => {
    setPeriodInput(String(period));
  }, [period]);

  const handleScorePointerDown =
    (team: TeamSide) => (event: PointerEvent<HTMLButtonElement>) => {
      if (!scoreboardOpen) {
        return;
      }
      const x = event.clientX;
      const y = event.clientY;
      longPressTimerRef.current = setTimeout(() => {
        suppressClickRef.current = true;
        setQuickMenu({ open: true, x, y, team });
      }, LONG_PRESS_MS);
    };

  const clearLongPress = () => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  };

  const handleScoreClick = (team: TeamSide) => {
    if (suppressClickRef.current) {
      suppressClickRef.current = false;
      return;
    }
    addScore(team, 1);
  };

  const handleScoreContextMenu =
    (team: TeamSide) => (event: MouseEvent<HTMLButtonElement>) => {
      event.preventDefault();
      setQuickMenu({
        open: true,
        x: event.clientX,
        y: event.clientY,
        team,
      });
    };

  const quickActions = useMemo(
    () => [
      { label: "+2", delta: 2 },
      { label: "+3", delta: 3 },
      { label: "-1", delta: -1 },
    ],
    [],
  );

  const scoreDigitStyle = {
    fontFamily:
      '"Roboto Condensed","DIN Condensed","Arial Narrow","Bahnschrift Condensed",sans-serif',
    fontStretch: "condensed" as const,
    letterSpacing: "0.02em",
    fontVariantNumeric: "tabular-nums" as const,
  };

  const startTeamNameEdit = (team: TeamSide) => {
    setEditingTeam(team);
    setTeamNameDraft(team === "red" ? redTeamName : blueTeamName);
  };

  const commitTeamNameEdit = () => {
    if (!editingTeam) {
      return;
    }
    setTeamName(editingTeam, teamNameDraft);
    setEditingTeam(null);
  };

  const onResetScoresSafe = () => {
    if (scoreResetConfirming) {
      resetScores();
      setScoreResetConfirming(false);
      if (resetScoreConfirmTimerRef.current) {
        clearTimeout(resetScoreConfirmTimerRef.current);
        resetScoreConfirmTimerRef.current = null;
      }
      return;
    }
    setScoreResetConfirming(true);
    if (resetScoreConfirmTimerRef.current) {
      clearTimeout(resetScoreConfirmTimerRef.current);
    }
    resetScoreConfirmTimerRef.current = setTimeout(() => {
      setScoreResetConfirming(false);
      resetScoreConfirmTimerRef.current = null;
    }, RESET_SCORE_CONFIRM_MS);
  };

  if (!scoreboardOpen) {
    return null;
  }

  return (
    <div className="absolute inset-0 z-[80] flex items-center justify-center bg-black/95 backdrop-blur-[12px]">
      <div className="relative flex h-full w-full flex-col px-6 py-6 text-white">
        <div className="mx-auto w-full max-w-4xl rounded-xl border border-white/20 bg-white/8 px-4 py-3">
          <div className="flex items-center justify-center gap-3">
            <button
              type="button"
              onClick={toggleClock}
              className={[
                "text-4xl font-black tracking-tight text-white",
                isClockRunning ? "animate-pulse" : "",
              ].join(" ")}
              style={scoreDigitStyle}
            >
              {formatClock(timeLeftSec)}
            </button>
            <p className="text-2xl font-extrabold text-amber-300" style={scoreDigitStyle}>
              24s: {shotClockEnabled ? String(shotClockSec).padStart(2, "0") : "--"}
            </p>
            <p className="rounded bg-white/10 px-2 py-1 text-xs">第 {period} 节</p>
            <button
              type="button"
              className="rounded-lg border border-white/20 bg-white/10 p-2 hover:bg-white/20"
              onClick={() => {
                setPeriodMinutesInput(String(Math.floor(periodDurationSec / 60)));
                setSettingsOpen((v) => !v);
              }}
              aria-label="打开时间设置"
            >
              <Settings2 size={18} />
            </button>
            <button
              type="button"
              className="rounded-lg border border-white/20 bg-white/10 p-2 hover:bg-white/20"
              onClick={closeScoreboard}
              aria-label="退出计分器模式"
            >
              <X size={18} />
            </button>
          </div>
          <div className="mt-2 flex flex-wrap items-center justify-center gap-2">
            <button
              type="button"
              className="inline-flex items-center gap-2 rounded-lg bg-white/20 px-3 py-1.5 text-xs font-semibold hover:bg-white/30"
              onClick={toggleClock}
            >
              {isClockRunning ? <Pause size={16} /> : <Play size={16} />}
              {isClockRunning ? "暂停" : "开始"}
            </button>
            <button
              type="button"
              className="inline-flex items-center gap-2 rounded-lg bg-white/10 px-3 py-1.5 text-xs font-semibold hover:bg-white/20"
              onClick={resetGameClock}
            >
              <RotateCcw size={16} />
              重置比赛时间
            </button>
            <button
              type="button"
              className="rounded-lg bg-white/10 px-3 py-1.5 text-xs font-semibold hover:bg-white/20"
              onClick={resetShotClock}
              disabled={!shotClockEnabled}
            >
              重置 24 秒
            </button>
            <button
              type="button"
              className={[
                "rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors",
                scoreResetConfirming
                  ? "bg-rose-500/45 text-rose-50 hover:bg-rose-500/60"
                  : "bg-white/10 hover:bg-white/20",
              ].join(" ")}
              onClick={onResetScoresSafe}
            >
              {scoreResetConfirming ? "再次点击确认重置比分" : "重置比分"}
            </button>
            <button
              type="button"
              className={[
                "rounded-lg px-3 py-1.5 text-xs font-semibold",
                shotClockEnabled
                  ? "bg-emerald-500/30 hover:bg-emerald-500/45"
                  : "bg-white/10 hover:bg-white/20",
              ].join(" ")}
              onClick={toggleShotClockEnabled}
            >
              {shotClockEnabled ? "关闭 24 秒" : "开启 24 秒"}
            </button>
          </div>
        </div>

        {settingsOpen ? (
          <div className="mx-auto mt-3 inline-flex items-center gap-2 rounded-lg border border-white/15 bg-white/10 px-3 py-2 text-sm">
            <span>每节时长（分钟）</span>
            <input
              type="number"
              min={1}
              max={30}
              value={periodMinutesInput}
              onChange={(event) => setPeriodMinutesInput(event.target.value)}
              className="w-16 rounded bg-white/15 px-2 py-1 text-center text-sm outline-none ring-1 ring-white/20"
            />
            <button
              type="button"
              className="rounded bg-white/20 px-2 py-1 hover:bg-white/30"
              onClick={() => {
                const value = Number(periodMinutesInput);
                if (Number.isFinite(value) && value > 0) {
                  setPeriodDurationMinutes(Math.min(30, Math.floor(value)));
                }
              }}
            >
              应用
            </button>
            <span className="ml-2">第几节</span>
            <input
              type="number"
              min={1}
              max={20}
              value={periodInput}
              onChange={(event) => setPeriodInput(event.target.value)}
              className="w-14 rounded bg-white/15 px-2 py-1 text-center text-sm outline-none ring-1 ring-white/20"
            />
            <button
              type="button"
              className="rounded bg-white/20 px-2 py-1 hover:bg-white/30"
              onClick={() => {
                const value = Number(periodInput);
                if (Number.isFinite(value) && value > 0) {
                  setPeriod(Math.min(20, Math.floor(value)));
                }
              }}
            >
              设置
            </button>
            <button
              type="button"
              className={[
                "rounded px-2 py-1",
                periodDurationSec === 600 ? "bg-white/30" : "bg-white/10 hover:bg-white/20",
              ].join(" ")}
              onClick={() => {
                setPeriodDurationMinutes(10);
                setPeriodMinutesInput("10");
              }}
            >
              10 分钟
            </button>
            <button
              type="button"
              className={[
                "rounded px-2 py-1",
                periodDurationSec === 720 ? "bg-white/30" : "bg-white/10 hover:bg-white/20",
              ].join(" ")}
              onClick={() => {
                setPeriodDurationMinutes(12);
                setPeriodMinutesInput("12");
              }}
            >
              12 分钟
            </button>
          </div>
        ) : null}

        <div className="mt-6 grid flex-1 grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-1">
          <div className="flex min-w-0 flex-col items-center">
            {editingTeam === "red" ? (
              <input
                value={teamNameDraft}
                onChange={(event) => setTeamNameDraft(event.target.value)}
                onBlur={commitTeamNameEdit}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    commitTeamNameEdit();
                  } else if (event.key === "Escape") {
                    event.preventDefault();
                    setEditingTeam(null);
                  }
                }}
                className="mb-5 w-44 rounded bg-white/15 px-2 py-1 text-center text-lg font-bold text-rose-100 outline-none ring-1 ring-rose-200"
                autoFocus
              />
            ) : (
              <button
                type="button"
                className="mb-5 text-xl font-bold tracking-wide text-rose-200 hover:underline"
                onClick={() => startTeamNameEdit("red")}
              >
                {redTeamName}
              </button>
            )}
            <button
              type="button"
              onPointerDown={handleScorePointerDown("red")}
              onPointerUp={clearLongPress}
              onPointerLeave={clearLongPress}
              onClick={() => handleScoreClick("red")}
              onContextMenu={handleScoreContextMenu("red")}
              className="whitespace-nowrap text-center font-black leading-none text-[clamp(9rem,34vw,26rem)] text-rose-400"
              style={scoreDigitStyle}
            >
              {formatScore(redScore)}
            </button>
            <div className="mt-2 flex gap-2 text-xs text-rose-100/90">
              <button type="button" onClick={() => addScore("red", 1)} className="rounded bg-white/10 px-2 py-1 hover:bg-white/20">
                +1
              </button>
              <button type="button" onClick={() => addScore("red", -1)} className="rounded bg-white/10 px-2 py-1 hover:bg-white/20">
                -1
              </button>
              <button type="button" onClick={() => addFoul("red", 1)} className="rounded bg-white/10 px-2 py-1 hover:bg-white/20">
                犯规 {redFouls}
              </button>
              <button type="button" onClick={() => addTimeout("red", 1)} className="rounded bg-white/10 px-2 py-1 hover:bg-white/20">
                暂停 {redTimeouts}
              </button>
              <button
                type="button"
                onClick={() => resetFoulsAndTimeouts("red")}
                className="rounded bg-white/10 px-2 py-1 hover:bg-white/20"
              >
                重置
              </button>
            </div>
          </div>

          <div className="flex h-full items-center justify-center px-1 -translate-y-2">
            <svg
              viewBox="0 0 40 120"
              className={[
                "h-[clamp(7rem,18vw,14rem)] w-[clamp(2.4rem,6vw,4.2rem)]",
                isClockRunning && timeLeftSec % 2 === 1 ? "opacity-30" : "opacity-100",
              ].join(" ")}
            >
              <circle cx="20" cy="36" r="8.5" fill="#ffffff" />
              <circle cx="20" cy="84" r="8.5" fill="#ffffff" />
            </svg>
          </div>

          <div className="flex min-w-0 flex-col items-center">
            {editingTeam === "blue" ? (
              <input
                value={teamNameDraft}
                onChange={(event) => setTeamNameDraft(event.target.value)}
                onBlur={commitTeamNameEdit}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    commitTeamNameEdit();
                  } else if (event.key === "Escape") {
                    event.preventDefault();
                    setEditingTeam(null);
                  }
                }}
                className="mb-5 w-44 rounded bg-white/15 px-2 py-1 text-center text-lg font-bold text-sky-100 outline-none ring-1 ring-sky-200"
                autoFocus
              />
            ) : (
              <button
                type="button"
                className="mb-5 text-xl font-bold tracking-wide text-sky-200 hover:underline"
                onClick={() => startTeamNameEdit("blue")}
              >
                {blueTeamName}
              </button>
            )}
            <button
              type="button"
              onPointerDown={handleScorePointerDown("blue")}
              onPointerUp={clearLongPress}
              onPointerLeave={clearLongPress}
              onClick={() => handleScoreClick("blue")}
              onContextMenu={handleScoreContextMenu("blue")}
              className="whitespace-nowrap text-center font-black leading-none text-[clamp(9rem,34vw,26rem)] text-sky-300"
              style={scoreDigitStyle}
            >
              {formatScore(blueScore)}
            </button>
            <div className="mt-2 flex gap-2 text-xs text-sky-100/90">
              <button type="button" onClick={() => addScore("blue", 1)} className="rounded bg-white/10 px-2 py-1 hover:bg-white/20">
                +1
              </button>
              <button type="button" onClick={() => addScore("blue", -1)} className="rounded bg-white/10 px-2 py-1 hover:bg-white/20">
                -1
              </button>
              <button type="button" onClick={() => addFoul("blue", 1)} className="rounded bg-white/10 px-2 py-1 hover:bg-white/20">
                犯规 {blueFouls}
              </button>
              <button type="button" onClick={() => addTimeout("blue", 1)} className="rounded bg-white/10 px-2 py-1 hover:bg-white/20">
                暂停 {blueTimeouts}
              </button>
              <button
                type="button"
                onClick={() => resetFoulsAndTimeouts("blue")}
                className="rounded bg-white/10 px-2 py-1 hover:bg-white/20"
              >
                重置
              </button>
            </div>
          </div>
        </div>

        {quickMenu.open ? (
          <div
            className="fixed z-[95] flex gap-1 rounded-lg border border-white/20 bg-slate-900/95 p-2 shadow-xl"
            style={{ left: quickMenu.x, top: quickMenu.y }}
          >
            {quickActions.map((action) => (
              <button
                key={action.label}
                type="button"
                onClick={(event) => {
                  event.stopPropagation();
                  addScore(quickMenu.team, action.delta);
                  setQuickMenu((prev) => ({ ...prev, open: false }));
                }}
                className="rounded bg-white/10 px-3 py-1 text-sm hover:bg-white/20"
              >
                {action.label}
              </button>
            ))}
          </div>
        ) : null}
      </div>
    </div>
  );
}


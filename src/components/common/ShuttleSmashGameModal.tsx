import React, { useEffect, useRef, useState } from 'react';
import { Coins, Gamepad2, Pause, Play, RotateCcw, ShoppingBag, Trophy, X, Zap } from 'lucide-react';
import { useAppStore } from '../../store/useAppStore';
import type { SyncResult } from '../../lib/supabaseErrors';
import { GameCosmeticsShop } from './GameCosmeticsShop';
import { GameCosmeticTryout } from './GameCosmeticTryout';
import { COURT_VISUALS, hasVictoryEffect, RACKET_VISUALS, SHUTTLE_VISUALS, type CosmeticCategory, type GameCosmeticItem } from './gameCosmetics';
import {
  drawCourtDecoration, drawFlightTrail, drawRacketAccent, drawShuttleAccent, drawTrailTimingTarget,
  getFlightTrailWindow,
} from './gameCosmeticEffects';
import {
  CosmeticEvents, drawRacketMotion, TRIAL_EVENT_AT, TRIAL_STAGES, TRIAL_STAGE_LENGTH,
  type EffectQuality, type TrialMode, type TrialStage,
} from './gameCosmeticEvents';
import { FlightHistory } from './gameFlightHistory';
import type { CourtStyle, RacketStyle, ShuttleGameDifficulty, ShuttleStyle, TrailStyle } from '../../types';

type GamePhase = 'ready' | 'playing' | 'finished';
type HitQuality = 'none' | 'bad' | 'normal' | 'perfect';
type CourtSide = 'player' | 'cpu';
type CourtZone = 'front' | 'mid' | 'back';
type SwingSpeedBand = 'slow' | 'medium' | 'fast';
type IncomingQualityBand = 'bad' | 'normal' | 'good';
type ShotType = 'clear' | 'drop' | 'smash' | 'drive' | 'push' | 'block' | 'half-smash' | 'net-shot' | 'lift' | 'net-kill';

const EFFECT_QUALITY = 'high';
const AUTO_TRIAL_STAGES = TRIAL_STAGES.map(({ id }) => id);

interface TryoutState {
  mode: TrialMode;
  startedAt: number;
  stageNumber: number;
  playedEvent: boolean;
  hasVictory: boolean;
}

const GAME_DIFFICULTIES = [
  { value: 'easy', label: '簡單' },
  { value: 'hard', label: '困難' },
] as const;

const WIN_REWARD_COINS: Record<ShuttleGameDifficulty, number> = { easy: 1, hard: 3 };

const GAME_PREVIEW_URL = `${import.meta.env.BASE_URL}shuttle-game-preview.mp4`;
const GAME_PREVIEW_POSTER = `${import.meta.env.BASE_URL}shuttle-game-preview.webp`;

const EASY_RULES = {
  powerWindowScale: 1.6,
  smashMissChance: 0.98,
  cpuReturnDurationScale: 1.6,
} as const;

interface ShotProfile {
  duration: number;
  arcScale: number;
  contactHeight: number;
  targetDepth: readonly [number, number];
}

interface DragSample {
  at: number;
  courtX: number;
  courtY: number;
}

interface TouchSweep {
  from: DragSample;
  to: DragSample;
}

interface RacketMotion {
  velocityX: number;
  velocityY: number;
  dragPower: number;
}

interface HitResult {
  timingQuality: Exclude<HitQuality, 'none'>;
  contactQuality: number;
  swingPower: number;
  effectivePower: number;
  accuracy: number;
  powerTiming: boolean;
  defensivePerfect: boolean;
}

const GAME_CONFIG = {
  pointsToWin: 3,
  court: {
    length: 13.4,
    width: 6.1,
    forcePortrait: true,
    viewportMarginRatio: 0.025,
    minimumViewportMargin: 8,
  },
  catchRadius: 0.22,
  playerCourtLimit: 0.46,
  playerFrontStart: 0.34,
  playerBackEnd: 0.18,
  cpuFrontEnd: 0.66,
  cpuBackStart: 0.82,
  aiMoveSpeed: 0.55,
  aiAttack: {
    minimumProbability: 0.08,
    maximumProbability: 0.94,
    timingBonus: 0.1,
    shortBallBonus: 0.16,
    badTimingBonus: 0.18,
    deepRearPenalty: 0.24,
    speedPressurePenalty: 0.16,
  },
  rallyPressure: {
    memory: 0.72,
    playerQualityWeight: 0.72,
    greenBonus: 0.2,
    defensivePerfectBonus: 0.22,
    powerAttackBonus: 0.3,
    badTimingPenalty: 0.24,
    aiResponseWeight: 0.55,
  },
  aiResponse: {
    minimumQuality: 0.18,
    maximumQuality: 0.9,
    qualityVariance: 0.12,
    playerQualityResponseWeight: 0.52,
    playerPressurePenalty: 0.18,
    aiPressureBonus: 0.12,
    yellowAttackCap: 0.34,
    poorReturnQualityThreshold: 0.42,
    badTimingFullSmashMin: 0.76,
    badTimingFullSmashMax: 0.96,
    forcedDefenseAttackCap: 0.18,
    powerAttackAttackCap: 0.05,
    powerShotMissChance: {
      smash: [0.45, 0.7],
      drive: [0.15, 0.3],
      net: [0.08, 0.2],
    },
    greenShotMissChance: 0.04,
    defensiveCounterMissChance: 0.03,
    defensiveCounterMaximumResponseQuality: 0.64,
    forcedDefenseQualityPenalty: 0.08,
    powerAttackQualityPenalty: 0.12,
    normalPowerMin: 0.42,
    normalPowerMax: 0.76,
    attackPowerMin: 0.82,
    attackPowerMax: 0.96,
    accuracyMin: 0.55,
    accuracyMax: 0.9,
  },
  defensiveRecovery: {
    slowPowerFloor: 0.42,
    mediumPowerFloor: 0.72,
    fastPowerFloor: 0.8,
  },
  aiFatigue: {
    consecutiveAttackLimit: 2,
    attackProbabilityPenalty: 0.24,
    moveSpeedScale: 0.82,
    accuracyPenalty: 0.12,
    executionErrorBonus: 0.1,
  },
  aiPreciseDefense: {
    minimumChance: 0.05,
    maximumChance: 0.4,
    contactWeight: 0.2,
    timingWeight: 0.16,
    setupBonus: 0.08,
    incomingDifficultyPenalty: 0.18,
    fatiguePenalty: 0.1,
    responseQualityBonus: 0.42,
    minimumResponseQuality: 0.68,
    maximumResponseQuality: 0.82,
  },
  input: {
    velocitySampleMs: 100,
    maximumVelocity: 3,
    maximumTouchSweepMs: 50,
  },
  smashPower: 0.96,
  powerTimingPower: {
    slow: 0.92,
    medium: 0.9,
    fast: 0.98,
  },
  aiTiming: {
    baseScore: 0.32,
    flightTimingWeight: 0.34,
    contactWeight: 0.18,
    setupBonus: 0.08,
    incomingQualityPenalty: 0.32,
    fatiguePenalty: 0.12,
    randomVariance: 0.16,
    perfectMinimum: 0.72,
    normalMinimum: 0.42,
    perfectResponseBonus: 0.16,
    badResponsePenalty: 0.22,
    normalResponseMaximum: 0.67,
    badResponseMaximum: 0.4,
  },
  powerTimingSpeedMultiplier: {
    smash: 1.05,
    control: 1.18,
    net: 1.38,
  },
  attackFlight: {
    referenceDistance: 0.62,
    minimumDistanceScale: 0.58,
    maximumDistanceScale: 1.18,
  },
  aiContact: {
    interceptProgress: 0.84,
  },
  landingSlide: {
    duration: 280,
    distance: 0.065,
    smashDuration: 430,
    smashDistance: 0.13,
  },
  shotSelection: {
    slowMax: 0.32,
    fastMin: 0.72,
    powerDepthInfluence: 0.18,
  },
  timingEfficiency: {
    perfect: 1,
    normal: 0.78,
    bad: 0.5,
  },
  baseAccuracy: {
    perfect: 0.96,
    normal: 0.8,
    bad: 0.5,
  },
  qualityPhysics: {
    // 相同球種與揮力下，飛行時間直接拉開，讓速度清楚維持綠 > 黃 > 橘。
    perfect: { durationScale: 0.8, arcScale: 0.9, depthError: 0 },
    normal: { durationScale: 1.08, arcScale: 1.08, depthError: 0.04 },
    bad: { durationScale: 1.52, arcScale: 1.45, depthError: 0.2 },
  },
  shotQualityWeights: {
    timing: 0.36,
    speed: 0.14,
    depth: 0.18,
    height: 0.08,
    placement: 0.08,
    pressure: 0.16,
  },
  landingIndicator: {
    lerpSpeed: 9,
    minimumRadius: 18,
    maximumRadius: 34,
  },
  incomingQuality: {
    shotQualityWeight: 0.68,
    speedWeight: 0.32,
    badMaximum: 0.4,
    goodMinimum: 0.68,
    badWindowScale: 1.3,
    normalWindowScale: 1,
    goodWindowScale: 0.7,
  },
  timing: {
    optimalLeadRatioSlow: 0.2,
    optimalLeadRatioFast: 0.38,
    optimalLeadMin: 145,
    optimalLeadMax: 270,
    greenWindowMin: 68,
    greenWindowMax: 165,
    orangeWindowMin: 280,
    orangeWindowMax: 600,
    yellowMultiplierMin: 1.8,
    yellowMultiplierMax: 2.3,
    defensivePerfectWindowMin: 34,
    defensivePerfectWindowMax: 50,
    powerWindowRatioMin: 0.65,
    powerWindowRatioMax: 0.75,
  },
} as const;

const SHOT_PROFILES: Record<ShotType, ShotProfile> = {
  clear: { duration: 1620, arcScale: 1.9, contactHeight: 0.8, targetDepth: [0.88, 0.99] },
  drop: { duration: 900, arcScale: 0.92, contactHeight: 0.26, targetDepth: [0.05, 0.24] },
  smash: { duration: 500, arcScale: 0.38, contactHeight: 0.14, targetDepth: [0.42, 0.86] },
  drive: { duration: 640, arcScale: 0.42, contactHeight: 0.32, targetDepth: [0.38, 0.76] },
  push: { duration: 780, arcScale: 0.62, contactHeight: 0.28, targetDepth: [0.45, 0.82] },
  block: { duration: 930, arcScale: 0.72, contactHeight: 0.18, targetDepth: [0.07, 0.28] },
  'half-smash': { duration: 560, arcScale: 0.44, contactHeight: 0.18, targetDepth: [0.36, 0.74] },
  'net-shot': { duration: 930, arcScale: 0.6, contactHeight: 0.12, targetDepth: [0.02, 0.17] },
  lift: { duration: 1570, arcScale: 1.96, contactHeight: 0.78, targetDepth: [0.86, 0.99] },
  'net-kill': { duration: 390, arcScale: 0.23, contactHeight: 0.06, targetDepth: [0.03, 0.23] },
};

const getCourtZone = (x: number, side: CourtSide): CourtZone => {
  if (side === 'player') {
    if (x >= GAME_CONFIG.playerFrontStart) return 'front';
    if (x <= GAME_CONFIG.playerBackEnd) return 'back';
    return 'mid';
  }
  if (x <= GAME_CONFIG.cpuFrontEnd) return 'front';
  if (x >= GAME_CONFIG.cpuBackStart) return 'back';
  return 'mid';
};

const getSwingSpeedBand = (swingPower: number): SwingSpeedBand => {
  if (swingPower < GAME_CONFIG.shotSelection.slowMax) return 'slow';
  if (swingPower >= GAME_CONFIG.shotSelection.fastMin) return 'fast';
  return 'medium';
};

const targetXForDepth = (receiver: CourtSide, depth: number) => (
  receiver === 'cpu'
    ? 0.55 + clamp(depth, 0, 1) * 0.39
    : 0.45 - clamp(depth, 0, 1) * 0.39
);

const getTimingWindows = (incomingShotQuality = 0.5) => {
  const quality = clamp(incomingShotQuality, 0, 1);
  const qualityBand: IncomingQualityBand = quality >= GAME_CONFIG.incomingQuality.goodMinimum
    ? 'good'
    : quality <= GAME_CONFIG.incomingQuality.badMaximum ? 'bad' : 'normal';
  const windowScale = qualityBand === 'good'
    ? GAME_CONFIG.incomingQuality.goodWindowScale
    : qualityBand === 'bad'
      ? GAME_CONFIG.incomingQuality.badWindowScale
      : GAME_CONFIG.incomingQuality.normalWindowScale;
  const perfect = (
    GAME_CONFIG.timing.greenWindowMax
    + (GAME_CONFIG.timing.greenWindowMin - GAME_CONFIG.timing.greenWindowMax) * quality
  ) / 2 * windowScale;
  const normal = (
    GAME_CONFIG.timing.orangeWindowMax
    + (GAME_CONFIG.timing.orangeWindowMin - GAME_CONFIG.timing.orangeWindowMax) * quality
  ) / 2 * windowScale;
  const yellowMultiplier = GAME_CONFIG.timing.yellowMultiplierMax
    + (GAME_CONFIG.timing.yellowMultiplierMin - GAME_CONFIG.timing.yellowMultiplierMax) * quality;
  return { normal: Math.max(normal, perfect), perfect, bad: Math.max(normal, perfect) * yellowMultiplier };
};

const getDefensivePerfectWindow = (incomingShotQuality = 0.5) => {
  const quality = clamp(incomingShotQuality, 0, 1);
  const qualityBand: IncomingQualityBand = quality >= GAME_CONFIG.incomingQuality.goodMinimum
    ? 'good'
    : quality <= GAME_CONFIG.incomingQuality.badMaximum ? 'bad' : 'normal';
  const windowScale = qualityBand === 'good'
    ? GAME_CONFIG.incomingQuality.goodWindowScale
    : qualityBand === 'bad'
      ? GAME_CONFIG.incomingQuality.badWindowScale
      : GAME_CONFIG.incomingQuality.normalWindowScale;
  return lerp(
    GAME_CONFIG.timing.defensivePerfectWindowMax,
    GAME_CONFIG.timing.defensivePerfectWindowMin,
    quality
  ) * windowScale;
};

const getPowerTimingWindow = (incomingShotQuality: number, difficulty: ShuttleGameDifficulty) => {
  const quality = clamp(incomingShotQuality, 0, 1);
  const timingWindows = getTimingWindows(quality);
  const powerWindowRatio = lerp(
    GAME_CONFIG.timing.powerWindowRatioMax,
    GAME_CONFIG.timing.powerWindowRatioMin,
    quality
  );
  return timingWindows.perfect * powerWindowRatio * (difficulty === 'easy' ? EASY_RULES.powerWindowScale : 1);
};

interface ShuttleState {
  x: number;
  y: number;
  vx: number;
  vy: number;
}

interface ShotQualityBreakdown {
  total: number;
  timing: number;
  speed: number;
  depth: number;
  height: number;
  placement: number;
  pressure: number;
}

interface ArenaState {
  playerX: number;
  playerY: number;
  cpuX: number;
  cpuY: number;
  shuttle: ShuttleState;
  flightStartX: number;
  flightStartY: number;
  landingX: number;
  landingY: number;
  predictedLandingX: number;
  predictedLandingY: number;
  landingCircleX: number;
  landingCircleY: number;
  landingSlideStartedAt: number;
  landingSlideStartX: number;
  landingSlideStartY: number;
  landingSlideEndX: number;
  landingSlideEndY: number;
  landingSlideWinner: CourtSide | null;
  flightStartedAt: number;
  flightDuration: number;
  receiver: 'player' | 'cpu';
  receiverReady: boolean;
  canBeHit: boolean;
  dragSamples: DragSample[];
  classicTrail: { x: number; y: number }[];
  playerHitThisFlight: boolean;
  rallyStrokeCount: number;
  cpuWillMiss: boolean;
  shotArcScale: number;
  shotType: ShotType;
  shotWasPowerTiming: boolean;
  contactHeight: number;
  aiHadSetupTime: boolean;
  lastShotQuality: Exclude<HitQuality, 'none'>;
  currentShotQuality: ShotQualityBreakdown;
  incomingShotQuality: number;
  playerShotQuality: number;
  aiShotQuality: number;
  aiConsecutiveAttacks: number;
  rallyPressure: number;
  lastPlayerTimingQuality: Exclude<HitQuality, 'none'>;
  lastPlayerHitZone: CourtZone;
  lastPlayerDefensivePerfect: boolean;
  lastPlayerWasPowerAttack: boolean;
  lastHitPerfect: boolean;
  lastHitDefensivePerfect: boolean;
  lastHitSmash: boolean;
  shakeUntil: number;
  shakeStrength: number;
  playerScore: number;
  cpuScore: number;
  waitingForServe: boolean;
  pauseUntil: number;
  lastTime: number;
  hitAt: number;
  hitX: number;
  hitY: number;
}

const isPreciseDefenseIncomingShot = (arena: ArenaState) => arena.shotWasPowerTiming;

interface ShuttleSmashGameModalProps {
  onClose: () => void;
  onGameComplete?: (result: {
    winner: 'player' | 'cpu';
    playerScore: number;
    cpuScore: number;
    difficulty: ShuttleGameDifficulty;
  }) => Promise<SyncResult>;
}

const clamp = (value: number, minimum: number, maximum: number) => Math.max(minimum, Math.min(maximum, value));
const lerp = (from: number, to: number, amount: number) => from + (to - from) * clamp(amount, 0, 1);
const isLandingOutOfBounds = (x: number, y: number) => (
  x < 0.055 || x > 0.945 || y < 0.055 || y > 0.945
);

interface CourtLayout {
  left: number;
  top: number;
  width: number;
  height: number;
}

const getCourtLayout = (viewportWidth: number, viewportHeight: number, portrait: boolean): CourtLayout => {
  const margin = Math.max(
    GAME_CONFIG.court.minimumViewportMargin,
    Math.min(viewportWidth, viewportHeight) * GAME_CONFIG.court.viewportMarginRatio
  );
  const availableWidth = Math.max(1, viewportWidth - margin * 2);
  const availableHeight = Math.max(1, viewportHeight - margin * 2);
  const landscapeAspect = GAME_CONFIG.court.length / GAME_CONFIG.court.width;
  const targetAspect = portrait ? 1 / landscapeAspect : landscapeAspect;
  let courtWidth = availableWidth;
  let courtHeight = courtWidth / targetAspect;

  if (courtHeight > availableHeight) {
    courtHeight = availableHeight;
    courtWidth = courtHeight * targetAspect;
  }

  return {
    left: (viewportWidth - courtWidth) / 2,
    top: (viewportHeight - courtHeight) / 2,
    width: courtWidth,
    height: courtHeight,
  };
};

const courtToScreen = (
  logicalX: number,
  logicalY: number,
  layout: CourtLayout,
  portrait: boolean
) => portrait
  ? { x: layout.left + logicalY * layout.width, y: layout.top + (1 - logicalX) * layout.height }
  : { x: layout.left + logicalX * layout.width, y: layout.top + logicalY * layout.height };

const getArcLiftPixels = (progress: number, arcScale: number, layout: CourtLayout, portrait: boolean) => {
  const courtCrossSize = portrait ? layout.width : layout.height;
  return Math.sin(clamp(progress, 0, 1) * Math.PI) * clamp(courtCrossSize * 0.075, 18, 34) * arcScale;
};

interface ShotQualityInput {
  shotType: ShotType;
  executionQuality: Exclude<HitQuality, 'none'>;
  power: number;
  accuracy: number;
  duration: number;
  arcScale: number;
  depth: number;
  targetX: number;
  targetY: number;
  receiverX: number;
  receiverY: number;
}

const calculateShotQuality = ({
  shotType,
  executionQuality,
  power,
  accuracy,
  duration,
  arcScale,
  depth,
  targetX,
  targetY,
  receiverX,
  receiverY,
}: ShotQualityInput): ShotQualityBreakdown => {
  const timing = executionQuality === 'perfect' ? 1 : executionQuality === 'normal' ? 0.68 : 0.24;
  const speed = clamp(power * 0.62 + clamp((1450 - duration) / 1050, 0, 1) * 0.38, 0, 1);
  const depthTarget = shotType === 'clear' || shotType === 'lift'
    ? depth
    : shotType === 'drop' || shotType === 'block' || shotType === 'net-shot' || shotType === 'net-kill'
      ? 1 - depth
      : 1 - Math.abs(depth - 0.62) / 0.62;
  const depthScore = clamp(depthTarget * (0.58 + accuracy * 0.42), 0, 1);
  const height = shotType === 'clear' || shotType === 'lift'
    ? clamp(arcScale / 1.7, 0, 1)
    : shotType === 'smash' || shotType === 'half-smash' || shotType === 'net-kill' || shotType === 'drive'
      ? clamp(1 - arcScale / 1.35, 0, 1)
      : clamp(1 - Math.abs(arcScale - 0.72) / 1.1, 0, 1);
  const receiverDistance = Math.hypot(receiverX - targetX, receiverY - targetY);
  const cornerPressure = clamp(Math.abs(targetY - 0.5) / 0.45, 0, 1);
  const placement = clamp(
    Math.max(receiverDistance / 0.58, cornerPressure) * (0.55 + accuracy * 0.45),
    0,
    1
  );
  const reactionPressure = clamp(receiverDistance / Math.max(duration / 1000, 0.18) / 0.9, 0, 1);
  const attackingShot = shotType === 'smash' || shotType === 'half-smash' || shotType === 'net-kill';
  const pressure = clamp(speed * 0.5 + reactionPressure * 0.32 + (attackingShot ? 0.18 : 0), 0, 1);
  const weights = GAME_CONFIG.shotQualityWeights;
  const weightedTotal = timing * weights.timing
    + speed * weights.speed
    + depthScore * weights.depth
    + height * weights.height
    + placement * weights.placement
    + pressure * weights.pressure;
  const executionFactor = executionQuality === 'perfect' ? 1 : executionQuality === 'normal' ? 0.84 : 0.58;

  return {
    total: clamp(weightedTotal * executionFactor, 0, 1),
    timing,
    speed,
    depth: depthScore,
    height,
    placement,
    pressure,
  };
};

const calculateIncomingShotQuality = (shotQuality: ShotQualityBreakdown) => clamp(
  shotQuality.total * GAME_CONFIG.incomingQuality.shotQualityWeight
    + shotQuality.speed * GAME_CONFIG.incomingQuality.speedWeight,
  0,
  1
);

const getPredictedOptimalHitTime = (arena: ArenaState) => {
  const speedIntensity = clamp((1450 - arena.flightDuration) / 1050, 0, 1);
  const leadRatio = lerp(
    GAME_CONFIG.timing.optimalLeadRatioSlow,
    GAME_CONFIG.timing.optimalLeadRatioFast,
    speedIntensity
  );
  const leadTime = clamp(
    arena.flightDuration * leadRatio,
    GAME_CONFIG.timing.optimalLeadMin,
    GAME_CONFIG.timing.optimalLeadMax
  );
  return arena.flightStartedAt + arena.flightDuration - leadTime;
};

const getShuttleHeightAtProgress = (arena: ArenaState, progress: number) => clamp(
  arena.contactHeight + Math.sin(clamp(progress, 0, 1) * Math.PI) * 0.52 * arena.shotArcScale,
  0.04,
  1
);

const newServe = (direction: 1 | -1): ShuttleState => ({
  x: 0.5,
  y: 0.35 + Math.random() * 0.3,
  vx: 0.43 * direction,
  vy: (Math.random() - 0.5) * 0.28,
});

const GameIntroBackground = () => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [reducedMotion] = useState(() => window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  const [playing, setPlaying] = useState(false);
  const mediaClassName = 'absolute inset-0 h-full w-full object-cover object-top md:object-contain md:object-center';

  const togglePlayback = () => {
    const video = videoRef.current;
    if (!video) return;
    if (video.paused) void video.play().catch(() => undefined);
    else video.pause();
  };

  return (
    <>
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden">
        <img src={GAME_PREVIEW_POSTER} alt="" className={mediaClassName} />
        {!reducedMotion && (
          <video
            ref={videoRef}
            src={GAME_PREVIEW_URL}
            poster={GAME_PREVIEW_POSTER}
            autoPlay
            muted
            loop
            playsInline
            onPlay={() => setPlaying(true)}
            onPause={() => setPlaying(false)}
            className={mediaClassName}
          />
        )}
      </div>
      {!reducedMotion && (
        <button
          type="button"
          onClick={togglePlayback}
          aria-label={playing ? '暫停背景影片' : '播放背景影片'}
          className="absolute right-16 top-4 z-10 grid size-11 place-items-center rounded-full bg-slate-950/75 text-slate-200 transition-colors hover:bg-slate-900 focus-visible:outline-2 focus-visible:outline-emerald-400"
        >
          {playing ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
        </button>
      )}
    </>
  );
};

export const ShuttleSmashGameModal: React.FC<ShuttleSmashGameModalProps> = ({ onClose, onGameComplete }) => {
  const currentUserId = useAppStore((state) => state.currentUser.id);
  const equippedLoadout = useAppStore((state) => state.gameLoadouts.find((loadout) => loadout.user_id === state.currentUser.id));
  const [trialItem, setTrialItem] = useState<GameCosmeticItem | null>(null);
  const [trialMode, setTrialMode] = useState<TrialMode>('move');
  const [trialStage, setTrialStage] = useState<TrialStage>('move');
  const [shopCategory, setShopCategory] = useState<CosmeticCategory>('racket');
  const trialRef = useRef<TryoutState | null>(null);
  const [effects] = useState(() => new CosmeticEvents());
  const [flightHistory] = useState(() => new FlightHistory());
  const equippedRacketStyle = trialItem?.category === 'racket' ? trialItem.style as RacketStyle : equippedLoadout?.racket_style || 'classic';
  const equippedShuttleStyle = trialItem?.category === 'shuttle' ? trialItem.style as ShuttleStyle : equippedLoadout?.shuttle_style || 'classic';
  const equippedCourtStyle = trialItem?.category === 'court' ? trialItem.style as CourtStyle : equippedLoadout?.court_style || 'classic';
  const equippedTrailStyle = trialItem?.category === 'trail' ? trialItem.style as TrailStyle : equippedLoadout?.trail_style || 'classic';
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const frameRef = useRef(0);
  const activeTouchRef = useRef<{ pointerId: number; sample: DragSample | null } | null>(null);
  const touchSweepsRef = useRef<TouchSweep[]>([]);
  const audioContextRef = useRef<AudioContext | null>(null);
  const onGameCompleteRef = useRef(onGameComplete);
  const racketStyleRef = useRef<RacketStyle>(equippedRacketStyle);
  const shuttleStyleRef = useRef<ShuttleStyle>(equippedShuttleStyle);
  const courtStyleRef = useRef<CourtStyle>(equippedCourtStyle);
  const trailStyleRef = useRef<TrailStyle>(equippedTrailStyle);
  const phaseRef = useRef<GamePhase>('ready');
  const [difficulty, setDifficulty] = useState<ShuttleGameDifficulty>('easy');
  const matchDifficultyRef = useRef<ShuttleGameDifficulty>(difficulty);
  const matchNumberRef = useRef(0);
  const [resultSaveError, setResultSaveError] = useState('');
  const difficultyLabel = difficulty === 'easy' ? '簡單' : '困難';
  const arenaRef = useRef<ArenaState>({
    playerX: 0.085,
    playerY: 0.5,
    cpuX: 0.915,
    cpuY: 0.5,
    shuttle: newServe(-1),
    flightStartX: 0.5,
    flightStartY: 0.5,
    landingX: 0.2,
    landingY: 0.5,
    predictedLandingX: 0.2,
    predictedLandingY: 0.5,
    landingCircleX: 0.2,
    landingCircleY: 0.5,
    landingSlideStartedAt: 0,
    landingSlideStartX: 0.2,
    landingSlideStartY: 0.5,
    landingSlideEndX: 0.2,
    landingSlideEndY: 0.5,
    landingSlideWinner: null,
    flightStartedAt: Number.POSITIVE_INFINITY,
    flightDuration: 1000,
    receiver: 'player',
    receiverReady: false,
    canBeHit: true,
    dragSamples: [],
    classicTrail: [],
    playerHitThisFlight: false,
    rallyStrokeCount: 0,
    cpuWillMiss: false,
    shotArcScale: 1,
    shotType: 'clear',
    shotWasPowerTiming: false,
    contactHeight: 0.6,
    aiHadSetupTime: true,
    lastShotQuality: 'normal',
    currentShotQuality: {
      total: 0.5,
      timing: 0.5,
      speed: 0.5,
      depth: 0.5,
      height: 0.5,
      placement: 0.5,
      pressure: 0.5,
    },
    incomingShotQuality: 0.5,
    playerShotQuality: 0.5,
    aiShotQuality: 0.5,
    aiConsecutiveAttacks: 0,
    rallyPressure: 0,
    lastPlayerTimingQuality: 'normal',
    lastPlayerHitZone: 'mid',
    lastPlayerDefensivePerfect: false,
    lastPlayerWasPowerAttack: false,
    lastHitPerfect: false,
    lastHitDefensivePerfect: false,
    lastHitSmash: false,
    shakeUntil: 0,
    shakeStrength: 0,
    playerScore: 0,
    cpuScore: 0,
    waitingForServe: true,
    pauseUntil: Number.POSITIVE_INFINITY,
    lastTime: 0,
    hitAt: 0,
    hitX: 0.5,
    hitY: 0.5,
  });

  const [phase, setPhase] = useState<GamePhase>('ready');
  const [playerScore, setPlayerScore] = useState(0);
  const [cpuScore, setCpuScore] = useState(0);
  const [winner, setWinner] = useState<'player' | 'cpu' | null>(null);
  const [waitingForServe, setWaitingForServe] = useState(false);
  const [isShopOpen, setIsShopOpen] = useState(false);

  useEffect(() => {
    onGameCompleteRef.current = onGameComplete;
  }, [onGameComplete]);

  useEffect(() => {
    racketStyleRef.current = equippedRacketStyle;
    shuttleStyleRef.current = equippedShuttleStyle;
    courtStyleRef.current = equippedCourtStyle;
    trailStyleRef.current = equippedTrailStyle;
  }, [currentUserId, equippedRacketStyle, equippedShuttleStyle, equippedCourtStyle, equippedTrailStyle]);

  const playHitSound = (quality: Exclude<HitQuality, 'none'>, isSmash = false, power = 0.65) => {
    const audioContext = audioContextRef.current;
    if (!audioContext || audioContext.state !== 'running') return;
    const oscillator = audioContext.createOscillator();
    const gain = audioContext.createGain();
    const now = audioContext.currentTime;
    const normalizedPower = clamp(power, 0, 1);
    const qualityGain = isSmash || quality === 'perfect' ? 0.09 : quality === 'normal' ? 0.055 : 0.028;
    const peakGain = qualityGain * (0.45 + normalizedPower * 0.55);
    oscillator.type = isSmash ? 'sawtooth' : quality === 'perfect' ? 'square' : 'triangle';
    const baseFrequency = isSmash ? 760 : quality === 'perfect' ? 620 : quality === 'normal' ? 430 : 260;
    oscillator.frequency.setValueAtTime(baseFrequency * (0.72 + normalizedPower * 0.28), now);
    oscillator.frequency.exponentialRampToValueAtTime(isSmash ? 180 : 150, now + 0.09);
    gain.gain.setValueAtTime(peakGain, now);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + (isSmash ? 0.13 : 0.09));
    oscillator.connect(gain);
    gain.connect(audioContext.destination);
    oscillator.start(now);
    oscillator.stop(now + (isSmash ? 0.14 : 0.1));
  };

  const startGame = () => {
    matchDifficultyRef.current = difficulty;
    matchNumberRef.current += 1;
    effects.reset();
    flightHistory.reset();
    activeTouchRef.current = null;
    touchSweepsRef.current = [];
    setResultSaveError('');
    if (!audioContextRef.current && typeof AudioContext !== 'undefined') {
      audioContextRef.current = new AudioContext();
    }
    if (audioContextRef.current?.state === 'suspended') {
      void audioContextRef.current.resume();
    }
    const arena = arenaRef.current;
    arena.playerX = 0.085;
    arena.playerY = 0.5;
    arena.cpuX = 0.915;
    arena.cpuY = 0.5;
    const servingSide: CourtSide = Math.random() > 0.5 ? 'player' : 'cpu';
    const serveToPlayer = servingSide === 'cpu';
    const serveStartX = servingSide === 'player' ? 0.14 : 0.86;
    const serveDuration = 1050;
    const landingX = serveToPlayer ? 0.2 : 0.8;
    const landingY = 0.28 + Math.random() * 0.44;
    arena.shuttle = {
      x: serveStartX,
      y: 0.5,
      vx: (landingX - serveStartX) / (serveDuration / 1000),
      vy: (landingY - 0.5) / (serveDuration / 1000),
    };
    arena.flightStartX = serveStartX;
    arena.flightStartY = 0.5;
    arena.landingX = landingX;
    arena.landingY = landingY;
    arena.predictedLandingX = arena.landingX;
    arena.predictedLandingY = arena.landingY;
    arena.landingCircleX = arena.landingX;
    arena.landingCircleY = arena.landingY;
    arena.landingSlideStartedAt = 0;
    arena.landingSlideStartX = arena.landingX;
    arena.landingSlideStartY = arena.landingY;
    arena.landingSlideEndX = arena.landingX;
    arena.landingSlideEndY = arena.landingY;
    arena.landingSlideWinner = null;
    arena.flightStartedAt = Number.POSITIVE_INFINITY;
    arena.flightDuration = serveDuration;
    arena.receiver = serveToPlayer ? 'player' : 'cpu';
    arena.receiverReady = false;
    arena.canBeHit = false;
    arena.dragSamples = [];
    arena.classicTrail.length = 0;
    arena.playerHitThisFlight = false;
    arena.rallyStrokeCount = 0;
    arena.cpuWillMiss = false;
    arena.shotArcScale = 1;
    arena.shotType = 'clear';
    arena.shotWasPowerTiming = false;
    arena.contactHeight = 0.6;
    arena.aiHadSetupTime = true;
    arena.lastShotQuality = 'normal';
    arena.currentShotQuality = {
      total: 0.5,
      timing: 0.5,
      speed: 0.5,
      depth: 0.5,
      height: 0.5,
      placement: 0.5,
      pressure: 0.5,
    };
    arena.incomingShotQuality = 0.5;
    arena.playerShotQuality = 0.5;
    arena.aiShotQuality = 0.5;
    arena.aiConsecutiveAttacks = 0;
    arena.rallyPressure = 0;
    arena.lastPlayerTimingQuality = 'normal';
    arena.lastPlayerHitZone = 'mid';
    arena.lastPlayerDefensivePerfect = false;
    arena.lastPlayerWasPowerAttack = false;
    arena.lastHitPerfect = false;
    arena.lastHitDefensivePerfect = false;
    arena.lastHitSmash = false;
    arena.shakeUntil = 0;
    arena.shakeStrength = 0;
    arena.playerScore = 0;
    arena.cpuScore = 0;
    arena.waitingForServe = true;
    arena.pauseUntil = Number.POSITIVE_INFINITY;
    arena.lastTime = 0;
    arena.hitAt = 0;
    phaseRef.current = 'playing';
    setPlayerScore(0);
    setCpuScore(0);
    setWinner(null);
    setWaitingForServe(true);
    setPhase('playing');
  };

  const startTryout = (item: GameCosmeticItem, mode: TrialMode) => {
    trialRef.current = { mode, startedAt: performance.now(), stageNumber: -1, playedEvent: false, hasVictory: hasVictoryEffect(item) };
    setTrialItem(item);
    setTrialMode(mode);
    setShopCategory(item.category);
    setResultSaveError('');
    if (mode === 'free') {
      startGame();
    } else {
      phaseRef.current = 'playing';
      setPhase('playing');
      setWaitingForServe(false);
    }
  };

  const leaveTryout = () => {
    trialRef.current = null;
    effects.reset();
    flightHistory.reset();
    activeTouchRef.current = null;
    touchSweepsRef.current = [];
    setTrialItem(null);
    phaseRef.current = 'ready';
    setPhase('ready');
  };

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        if (trialRef.current) leaveTryout();
        else onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [onClose]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const context = canvas.getContext('2d');
    if (!context) return;

    const prepareNextRally = (servingSide: CourtSide) => {
      const arena = arenaRef.current;
      const serveToPlayer = servingSide === 'cpu';
      const serveStartX = servingSide === 'player' ? 0.14 : 0.86;
      const landingX = serveToPlayer ? 0.2 : 0.8;
      const landingY = 0.28 + Math.random() * 0.44;
      const serveDuration = 1050;

      arena.playerX = 0.085;
      arena.playerY = 0.5;
      arena.cpuX = 0.915;
      arena.cpuY = 0.5;
      arena.shuttle = {
        x: serveStartX,
        y: 0.5,
        vx: (landingX - serveStartX) / (serveDuration / 1000),
        vy: (landingY - 0.5) / (serveDuration / 1000),
      };
      arena.flightStartX = serveStartX;
      arena.flightStartY = 0.5;
      arena.landingX = landingX;
      arena.landingY = landingY;
      arena.predictedLandingX = landingX;
      arena.predictedLandingY = landingY;
      arena.landingCircleX = landingX;
      arena.landingCircleY = landingY;
      arena.landingSlideStartedAt = 0;
      arena.landingSlideWinner = null;
      arena.flightStartedAt = Number.POSITIVE_INFINITY;
      arena.flightDuration = serveDuration;
      arena.receiver = serveToPlayer ? 'player' : 'cpu';
      arena.receiverReady = false;
      arena.canBeHit = false;
      arena.dragSamples = [];
      arena.classicTrail.length = 0;
      arena.playerHitThisFlight = false;
      arena.rallyStrokeCount = 0;
      arena.cpuWillMiss = false;
      arena.shotArcScale = 1;
      arena.shotType = 'clear';
      arena.shotWasPowerTiming = false;
      arena.contactHeight = 0.6;
      arena.aiHadSetupTime = true;
      arena.lastShotQuality = 'normal';
      arena.incomingShotQuality = 0.5;
      arena.playerShotQuality = 0.5;
      arena.aiShotQuality = 0.5;
      arena.aiConsecutiveAttacks = 0;
      arena.rallyPressure = 0;
      arena.lastPlayerTimingQuality = 'normal';
      arena.lastPlayerHitZone = 'mid';
      arena.lastPlayerDefensivePerfect = false;
      arena.lastPlayerWasPowerAttack = false;
      arena.lastHitPerfect = false;
      arena.lastHitDefensivePerfect = false;
      arena.lastHitSmash = false;
      arena.shakeUntil = 0;
      arena.waitingForServe = true;
      arena.pauseUntil = Number.POSITIVE_INFINITY;
      arena.hitAt = 0;
      setWaitingForServe(true);
    };

    const awardPoint = (side: 'player' | 'cpu', now: number) => {
      const arena = arenaRef.current;
      arena.canBeHit = false;
      effects.emit('score', now, arena.shuttle.x, arena.shuttle.y, side === 'player');
      if (side === 'player') {
        arena.playerScore += 1;
        setPlayerScore(arena.playerScore);
      } else {
        arena.cpuScore += 1;
        setCpuScore(arena.cpuScore);
      }

      if (arena.playerScore >= GAME_CONFIG.pointsToWin || arena.cpuScore >= GAME_CONFIG.pointsToWin) {
        const nextWinner = arena.playerScore >= GAME_CONFIG.pointsToWin ? 'player' : 'cpu';
        if (nextWinner === 'player') effects.emit('win', now, 0.15, 0.5, true);
        phaseRef.current = 'finished';
        arena.waitingForServe = false;
        arena.pauseUntil = Number.POSITIVE_INFINITY;
        setWaitingForServe(false);
        setWinner(nextWinner);
        setPhase('finished');
        if (trialRef.current) return;
        const finishedMatch = matchNumberRef.current;
        void onGameCompleteRef.current?.({
          winner: nextWinner,
          playerScore: arena.playerScore,
          cpuScore: arena.cpuScore,
          difficulty: matchDifficultyRef.current,
        }).then((sync) => {
          if (!sync.success && finishedMatch === matchNumberRef.current) {
            setResultSaveError(sync.message || '戰績儲存失敗，請稍後再試。');
          }
        }, () => {
          if (finishedMatch === matchNumberRef.current) {
            setResultSaveError('戰績儲存失敗，請稍後再試。');
          }
        });
      } else {
        prepareNextRally(side);
      }
    };

    const beginLandingSlide = (winner: CourtSide, now: number) => {
      const arena = arenaRef.current;
      if (arena.landingSlideWinner !== null) return;

      const travelX = arena.landingX - arena.flightStartX;
      const travelY = arena.landingY - arena.flightStartY;
      const travelLength = Math.max(Math.hypot(travelX, travelY), 0.001);
      const speedIntensity = clamp((1450 - arena.flightDuration) / 880, 0, 1);
      const isSmashLanding = arena.shotWasPowerTiming;
      const baseSlideDistance = isSmashLanding
        ? GAME_CONFIG.landingSlide.smashDistance
        : GAME_CONFIG.landingSlide.distance;
      const slideDistance = baseSlideDistance * (0.72 + speedIntensity * 0.38);

      arena.canBeHit = false;
      arena.landingSlideStartedAt = now;
      arena.landingSlideStartX = arena.landingX;
      arena.landingSlideStartY = arena.landingY;
      arena.landingSlideEndX = clamp(
        arena.landingX + (travelX / travelLength) * slideDistance,
        -0.05,
        1.05
      );
      arena.landingSlideEndY = clamp(
        arena.landingY + (travelY / travelLength) * slideDistance,
        -0.07,
        1.07
      );
      arena.landingSlideWinner = winner;
    };

    const launchShot = (
      receiver: CourtSide,
      shotType: ShotType,
      targetY: number,
      now: number,
      shotQuality: Exclude<HitQuality, 'none'> = 'normal',
      effectivePower = 0.65,
      accuracy = 0.82,
      powerTiming = false
    ) => {
      const arena = arenaRef.current;
      const profile = SHOT_PROFILES[shotType];
      const qualityPhysics = GAME_CONFIG.qualityPhysics[shotQuality];
      const startX = arena.shuttle.x;
      const startY = arena.shuttle.y;
      const depthRange = profile.targetDepth;
      const accuracyError = 1 - clamp(accuracy, 0, 1);
      const power = clamp(effectivePower, 0, 1);
      const isFrontTargetShot = shotType === 'drop' || shotType === 'block' || shotType === 'net-shot' || shotType === 'net-kill';
      const depthQualityOffset = qualityPhysics.depthError * (isFrontTargetShot ? 1 : -1);
      const powerDepthEfficiency = shotQuality === 'perfect' ? 1 : shotQuality === 'normal' ? 0.65 : 0.2;
      const powerDepthOffset = isFrontTargetShot
        ? 0
        : (power - 0.5) * GAME_CONFIG.shotSelection.powerDepthInfluence * powerDepthEfficiency;
      const rawDepth = clamp(
        depthRange[0]
          + Math.random() * (depthRange[1] - depthRange[0])
          + depthQualityOffset
          + powerDepthOffset
          + (Math.random() - 0.5) * accuracyError * 0.26,
        0.01,
        1.04
      );
      const isRearCourtShot = shotType === 'clear' || shotType === 'lift';
      const minimumRearDepth = shotQuality === 'perfect' ? 0.88 : shotQuality === 'normal' ? 0.82 : 0.68;
      const depth = isRearCourtShot ? Math.max(rawDepth, minimumRearDepth) : rawDepth;
      const targetX = targetXForDepth(receiver, depth);
      const isPlayerPowerShot = receiver === 'cpu' && powerTiming;
      let duration = profile.duration
        * (1.17 - power * 0.34)
        * qualityPhysics.durationScale
        / (powerTiming
          ? shotType === 'smash' || shotType === 'net-kill'
            ? GAME_CONFIG.powerTimingSpeedMultiplier.smash
            : shotType === 'net-shot'
              ? GAME_CONFIG.powerTimingSpeedMultiplier.net
              : GAME_CONFIG.powerTimingSpeedMultiplier.control
          : 1);
      let resolvedTargetY = targetY + (Math.random() - 0.5) * accuracyError * 0.38;
      if (shotQuality === 'bad' && Math.random() < 0.05 + accuracyError * 0.2) {
        resolvedTargetY = Math.random() < 0.5 ? -0.035 : 1.035;
      } else {
        resolvedTargetY = clamp(resolvedTargetY, 0.055, 0.945);
      }
      const isAttackingShot = shotType === 'smash' || shotType === 'half-smash' || shotType === 'net-kill';
      if (isAttackingShot) {
        const travelDistance = Math.hypot(targetX - startX, resolvedTargetY - startY);
        const distanceScale = clamp(
          travelDistance / GAME_CONFIG.attackFlight.referenceDistance,
          GAME_CONFIG.attackFlight.minimumDistanceScale,
          GAME_CONFIG.attackFlight.maximumDistanceScale
        );
        duration *= distanceScale;
      }
      if (receiver === 'player' && matchDifficultyRef.current === 'easy' && shotQuality !== 'bad') {
        duration *= EASY_RULES.cpuReturnDurationScale;
      }
      const resolvedArcScale = profile.arcScale * (1.08 - power * 0.13) * qualityPhysics.arcScale;
      const receiverX = receiver === 'cpu' ? arena.cpuX : arena.playerX;
      const receiverY = receiver === 'cpu' ? arena.cpuY : arena.playerY;
      const shotQualityBreakdown = calculateShotQuality({
        shotType,
        executionQuality: shotQuality,
        power,
        accuracy,
        duration,
        arcScale: resolvedArcScale,
        depth,
        targetX,
        targetY: resolvedTargetY,
        receiverX,
        receiverY,
      });
      const cpuDistanceToTarget = Math.hypot(arena.cpuX - targetX, arena.cpuY - resolvedTargetY);
      const cpuSetupSeconds = cpuDistanceToTarget / GAME_CONFIG.aiMoveSpeed;
      const speedPressure = clamp((900 - duration) / 520, 0, 1);
      const perfectMissChance = clamp(0.2 + speedPressure * 0.25 + cpuDistanceToTarget * 0.18, 0.2, 0.56);
      const isPlayerDefensiveCounter = receiver === 'cpu' && arena.lastHitDefensivePerfect;
      const isPlayerGreenSetupShot = receiver === 'cpu' && shotQuality === 'perfect' && !powerTiming;
      const powerShotMissRange = shotType === 'smash' || shotType === 'net-kill'
        ? GAME_CONFIG.aiResponse.powerShotMissChance.smash
        : shotType === 'drive'
          ? GAME_CONFIG.aiResponse.powerShotMissChance.drive
          : GAME_CONFIG.aiResponse.powerShotMissChance.net;
      const powerShotThreat = clamp(shotQualityBreakdown.total * 0.58 + speedPressure * 0.42, 0, 1);
      const powerShotMissChance = lerp(powerShotMissRange[0], powerShotMissRange[1], powerShotThreat);
      const cpuMissChance = isPlayerDefensiveCounter
        ? GAME_CONFIG.aiResponse.defensiveCounterMissChance
        : isPlayerPowerShot
          ? powerShotMissChance
          : isPlayerGreenSetupShot
            ? GAME_CONFIG.aiResponse.greenShotMissChance
          : perfectMissChance;
      const cpuMissQualityThreshold = isPlayerPowerShot ? 0.62 : isPlayerGreenSetupShot ? 0.82 : 0.72;
      const easyMode = matchDifficultyRef.current === 'easy';
      const isUnreturnablePowerShot = easyMode && isPlayerPowerShot;
      const isEasySmash = easyMode && shotType === 'smash';
      const shotLandingIsOut = isLandingOutOfBounds(targetX, resolvedTargetY);

      arena.flightStartX = startX;
      arena.flightStartY = startY;
      arena.landingX = targetX;
      arena.landingY = resolvedTargetY;
      arena.predictedLandingX = targetX;
      arena.predictedLandingY = resolvedTargetY;
      arena.landingCircleX = targetX;
      arena.landingCircleY = resolvedTargetY;
      arena.landingSlideStartedAt = 0;
      arena.landingSlideStartX = targetX;
      arena.landingSlideStartY = resolvedTargetY;
      arena.landingSlideEndX = targetX;
      arena.landingSlideEndY = resolvedTargetY;
      arena.landingSlideWinner = null;
      arena.flightStartedAt = now;
      arena.flightDuration = duration;
      arena.receiver = receiver;
      arena.receiverReady = false;
      arena.canBeHit = receiver === 'player';
      arena.playerHitThisFlight = false;
      arena.cpuWillMiss = receiver === 'cpu'
        && (
          shotLandingIsOut
          || isUnreturnablePowerShot
          || (isEasySmash
            ? Math.random() < EASY_RULES.smashMissChance
            : shotQualityBreakdown.total >= cpuMissQualityThreshold && Math.random() < cpuMissChance)
        );
      arena.shotArcScale = resolvedArcScale;
      arena.shotType = shotType;
      arena.shotWasPowerTiming = powerTiming;
      arena.contactHeight = profile.contactHeight;
      arena.aiHadSetupTime = receiver !== 'cpu' || cpuSetupSeconds + 0.12 < duration / 1000;
      arena.lastShotQuality = shotQuality;
      arena.currentShotQuality = shotQualityBreakdown;
      arena.incomingShotQuality = calculateIncomingShotQuality(shotQualityBreakdown);
      if (receiver === 'cpu') {
        arena.playerShotQuality = shotQualityBreakdown.total;
      } else {
        arena.aiShotQuality = shotQualityBreakdown.total;
      }
      arena.pauseUntil = now;
      arena.shuttle.vx = (arena.landingX - startX) / (duration / 1000);
      arena.shuttle.vy = (arena.landingY - startY) / (duration / 1000);
      arena.classicTrail.length = 0;
      arena.rallyStrokeCount += 1;
    };

    const choosePlayerShot = (hit: HitResult) => {
      const arena = arenaRef.current;
      const zone = getCourtZone(arena.shuttle.x, 'player');
      const speedBand = getSwingSpeedBand(hit.swingPower);
      const quality = hit.timingQuality;
      let shotType: ShotType;

      // 紅色來球只能回防守球；精準碰到藍白窗時提高防守品質，不能直接反殺。
      if (isPreciseDefenseIncomingShot(arena)) {
        if (speedBand === 'fast') {
          shotType = 'drive';
        } else if (speedBand === 'medium') {
          shotType = zone === 'front' ? 'lift' : 'clear';
        } else {
          shotType = zone === 'front' ? 'net-shot' : 'block';
        }
        const recoveryTargetY = arena.cpuY < 0.5 ? 0.82 : 0.18;
        return { shotType, targetY: recoveryTargetY };
      }

      // 攻擊資格完全由 Timing 決定，不再檢查網高或擊球高度。
      if (hit.powerTiming) {
        shotType = speedBand === 'fast'
          ? 'smash'
          : speedBand === 'medium' ? 'drive' : 'net-shot';
      } else if (
        speedBand === 'fast'
        && quality === 'perfect'
        && arena.rallyStrokeCount > 0
      ) {
        shotType = 'smash';
      } else if (zone === 'back') {
        if (speedBand === 'fast') {
          shotType = quality === 'normal' ? 'drive' : 'clear';
        } else {
          shotType = speedBand === 'medium' ? 'clear' : 'drop';
        }
      } else if (zone === 'mid') {
        if (speedBand === 'fast') {
          shotType = quality === 'normal' ? 'drive' : 'clear';
        } else if (speedBand === 'medium') {
          shotType = 'clear';
        } else {
          shotType = 'block';
        }
      } else {
        if (speedBand === 'fast') {
          shotType = 'push';
        } else {
          shotType = speedBand === 'medium' ? 'push' : 'net-shot';
        }
      }

      const targetY = clamp(0.5 + (arena.shuttle.y - 0.5) * 0.55, 0.12, 0.88);
      return { shotType, targetY };
    };

    const evaluatePlayerHit = (contactAt: number, motion: RacketMotion, contactQuality: number): HitResult => {
      const arena = arenaRef.current;
      const timingWindows = getTimingWindows(arena.incomingShotQuality);
      const powerTimingWindow = getPowerTimingWindow(arena.incomingShotQuality, matchDifficultyRef.current);
      const predictedOptimalHitTime = getPredictedOptimalHitTime(arena);
      const timingError = Math.abs(contactAt - predictedOptimalHitTime);
      const baseTimingQuality: Exclude<HitQuality, 'none'> = timingError <= timingWindows.perfect
        ? 'perfect'
        : timingError <= timingWindows.normal ? 'normal' : 'bad';
      const defensivePerfectWindow = getDefensivePerfectWindow(arena.incomingShotQuality);
      const canUsePreciseDefense = isPreciseDefenseIncomingShot(arena);
      const defensivePerfect = canUsePreciseDefense
        && timingError <= defensivePerfectWindow;
      const powerTiming = !canUsePreciseDefense
        && arena.rallyStrokeCount > 0
        && timingError <= powerTimingWindow;
      const timingQuality = powerTiming ? 'perfect' : defensivePerfect ? 'normal' : baseTimingQuality;
      const timingEfficiency = defensivePerfect ? 0.92 : GAME_CONFIG.timingEfficiency[timingQuality];
      const contactEfficiency = 0.68 + contactQuality * 0.32;
      const effectivePower = clamp(motion.dragPower * timingEfficiency * contactEfficiency, 0, 1);
      const accuracy = clamp(
        (defensivePerfect ? 0.92 : GAME_CONFIG.baseAccuracy[timingQuality]) * (0.62 + contactQuality * 0.38),
        0.22,
        0.99
      );

      return {
        timingQuality,
        contactQuality,
        swingPower: motion.dragPower,
        effectivePower,
        accuracy,
        powerTiming,
        defensivePerfect,
      };
    };

    const chooseAiShot = (contactProgress: number) => {
      const arena = arenaRef.current;
      const contactX = arena.flightStartX + (arena.landingX - arena.flightStartX) * contactProgress;
      const zone = getCourtZone(contactX, 'cpu');
      const incomingSpeedPressure = clamp((900 - arena.flightDuration) / 520, 0, 1);
      const playerShotQuality = clamp(arena.playerShotQuality, 0, 1);
      const qualityPressure = 1 - playerShotQuality;
      const isOrangeBadReturn = arena.lastPlayerTimingQuality === 'bad';
      const isPoorPlayerReturn = isOrangeBadReturn
        || playerShotQuality <= GAME_CONFIG.aiResponse.poorReturnQualityThreshold;
      const frontCourtBadReturn = arena.lastPlayerHitZone === 'front'
        && isOrangeBadReturn;
      const forcedDefense = !isPoorPlayerReturn && (
        arena.lastPlayerTimingQuality === 'perfect'
        || arena.lastPlayerDefensivePerfect
        || arena.lastPlayerWasPowerAttack
      );
      const shortBallBonus = zone === 'mid' ? GAME_CONFIG.aiAttack.shortBallBonus : 0;
      const deepRearPenalty = zone === 'back' ? GAME_CONFIG.aiAttack.deepRearPenalty : 0;
      const aiIsFatigued = arena.aiConsecutiveAttacks >= GAME_CONFIG.aiFatigue.consecutiveAttackLimit;
      const contactY = arena.flightStartY + (arena.landingY - arena.flightStartY) * contactProgress;
      const contactDistance = Math.hypot(arena.cpuX - contactX, arena.cpuY - contactY);
      const contactScore = 1 - clamp(contactDistance / GAME_CONFIG.catchRadius, 0, 1);
      const timingScore = 1 - clamp(
        Math.abs(contactProgress - GAME_CONFIG.aiContact.interceptProgress)
          / Math.max(1 - GAME_CONFIG.aiContact.interceptProgress, 0.01),
        0,
        1
      );
      const aiExecutionScore = clamp(
        GAME_CONFIG.aiTiming.baseScore
          + timingScore * GAME_CONFIG.aiTiming.flightTimingWeight
          + contactScore * GAME_CONFIG.aiTiming.contactWeight
          + (arena.aiHadSetupTime ? GAME_CONFIG.aiTiming.setupBonus : 0)
          - arena.incomingShotQuality * GAME_CONFIG.aiTiming.incomingQualityPenalty
          - (aiIsFatigued ? GAME_CONFIG.aiTiming.fatiguePenalty : 0)
          + (Math.random() - 0.5) * GAME_CONFIG.aiTiming.randomVariance * 2,
        0,
        1
      );
      const aiTimingQuality: Exclude<HitQuality, 'none'> = aiExecutionScore >= GAME_CONFIG.aiTiming.perfectMinimum
        ? 'perfect'
        : aiExecutionScore >= GAME_CONFIG.aiTiming.normalMinimum ? 'normal' : 'bad';
      const hasCleanTiming = arena.aiHadSetupTime && timingScore >= 0.52;
      const hasPowerTiming = matchDifficultyRef.current === 'hard'
        && arena.aiHadSetupTime
        && aiTimingQuality === 'perfect';
      const preciseDefenseChance = clamp(
        GAME_CONFIG.aiPreciseDefense.minimumChance
          + contactScore * GAME_CONFIG.aiPreciseDefense.contactWeight
          + timingScore * GAME_CONFIG.aiPreciseDefense.timingWeight
          + (arena.aiHadSetupTime ? GAME_CONFIG.aiPreciseDefense.setupBonus : 0)
          - playerShotQuality * GAME_CONFIG.aiPreciseDefense.incomingDifficultyPenalty
          - (aiIsFatigued ? GAME_CONFIG.aiPreciseDefense.fatiguePenalty : 0),
        GAME_CONFIG.aiPreciseDefense.minimumChance,
        GAME_CONFIG.aiPreciseDefense.maximumChance
      );
      const aiPreciseDefense = matchDifficultyRef.current === 'hard'
        && (forcedDefense || playerShotQuality >= 0.68)
        && arena.aiHadSetupTime
        && Math.random() < preciseDefenseChance;
      const opportunityBonusScale = 0.35 + qualityPressure * 0.65;
      const rawAttackProbability = clamp(
        GAME_CONFIG.aiAttack.minimumProbability
          + qualityPressure * (GAME_CONFIG.aiAttack.maximumProbability - GAME_CONFIG.aiAttack.minimumProbability)
          + (timingScore * GAME_CONFIG.aiAttack.timingBonus + shortBallBonus) * opportunityBonusScale
          + (arena.lastPlayerTimingQuality === 'bad' ? GAME_CONFIG.aiAttack.badTimingBonus : 0)
          - deepRearPenalty
          - incomingSpeedPressure * GAME_CONFIG.aiAttack.speedPressurePenalty
          - arena.rallyPressure * 0.15
          - (aiIsFatigued ? GAME_CONFIG.aiFatigue.attackProbabilityPenalty : 0),
        GAME_CONFIG.aiAttack.minimumProbability,
        GAME_CONFIG.aiAttack.maximumProbability
      );
      const attackProbability = forcedDefense
        ? Math.min(
          rawAttackProbability,
          arena.lastPlayerWasPowerAttack
            ? GAME_CONFIG.aiResponse.powerAttackAttackCap
            : GAME_CONFIG.aiResponse.forcedDefenseAttackCap
        )
        : arena.lastPlayerTimingQuality === 'normal'
          ? Math.min(rawAttackProbability, GAME_CONFIG.aiResponse.yellowAttackCap)
          : rawAttackProbability;
      const responseQualityBase = clamp(
        0.82
          - playerShotQuality * GAME_CONFIG.aiResponse.playerQualityResponseWeight
          - Math.max(arena.rallyPressure, 0) * GAME_CONFIG.aiResponse.playerPressurePenalty
          + Math.max(-arena.rallyPressure, 0) * GAME_CONFIG.aiResponse.aiPressureBonus
          - (forcedDefense ? GAME_CONFIG.aiResponse.forcedDefenseQualityPenalty : 0)
          - (arena.lastPlayerWasPowerAttack ? GAME_CONFIG.aiResponse.powerAttackQualityPenalty : 0),
        GAME_CONFIG.aiResponse.minimumQuality,
        GAME_CONFIG.aiResponse.maximumQuality
      );
      const buildAiShot = (
        shotType: ShotType,
        targetY: number,
        intendedQuality: Exclude<HitQuality, 'none'> = 'normal',
        defensivePerfect = false,
        powerTiming = false
      ) => {
        const styleBias = intendedQuality === 'perfect' ? 0.1 : intendedQuality === 'bad' ? -0.1 : 0;
        const resolvedTimingQuality: Exclude<HitQuality, 'none'> = powerTiming || defensivePerfect
          ? 'perfect'
          : aiTimingQuality;
        const timingQualityMaximum = resolvedTimingQuality === 'bad'
          ? GAME_CONFIG.aiTiming.badResponseMaximum
          : resolvedTimingQuality === 'normal'
            ? GAME_CONFIG.aiTiming.normalResponseMaximum
            : GAME_CONFIG.aiResponse.maximumQuality;
        const maximumResponseQuality = powerTiming
          ? GAME_CONFIG.aiResponse.maximumQuality
          : defensivePerfect
          ? GAME_CONFIG.aiPreciseDefense.maximumResponseQuality
          : arena.lastPlayerDefensivePerfect
            ? GAME_CONFIG.aiResponse.defensiveCounterMaximumResponseQuality
            : Math.min(GAME_CONFIG.aiResponse.maximumQuality, timingQualityMaximum);
        const minimumResponseQuality = powerTiming
          ? 0.82
          : defensivePerfect
          ? GAME_CONFIG.aiPreciseDefense.minimumResponseQuality
          : GAME_CONFIG.aiResponse.minimumQuality;
        const timingQualityAdjustment = resolvedTimingQuality === 'perfect'
          ? GAME_CONFIG.aiTiming.perfectResponseBonus
          : resolvedTimingQuality === 'bad' ? -GAME_CONFIG.aiTiming.badResponsePenalty : 0;
        const responseQuality = clamp(
          responseQualityBase
            + styleBias
            + timingQualityAdjustment
            + (defensivePerfect ? GAME_CONFIG.aiPreciseDefense.responseQualityBonus : 0)
            + (Math.random() - 0.5) * GAME_CONFIG.aiResponse.qualityVariance * 2
            - (aiIsFatigued ? GAME_CONFIG.aiFatigue.executionErrorBonus : 0),
          minimumResponseQuality,
          maximumResponseQuality
        );
        const quality: Exclude<HitQuality, 'none'> = responseQuality >= 0.68
          ? 'perfect'
          : responseQuality >= 0.42 ? 'normal' : 'bad';
        return { shotType, quality, targetY, responseQuality, defensivePerfect, powerTiming };
      };
      const isFloatingNetBall = (arena.shotType === 'net-shot' || arena.shotType === 'block' || arena.shotType === 'drop')
        && (arena.lastShotQuality === 'bad' || arena.shotArcScale >= 0.92);
      const isRaisedDrive = (arena.shotType === 'drive' || arena.shotType === 'push')
        && (arena.lastShotQuality === 'bad' || arena.shotArcScale >= 0.72);
      const isShortHighBall = arena.flightDuration >= 900
        && arena.shotArcScale >= 1.12
        && zone !== 'back';
      const fullSmashProbability = frontCourtBadReturn
          ? 1
          : isOrangeBadReturn
          ? lerp(
            GAME_CONFIG.aiResponse.badTimingFullSmashMin,
            GAME_CONFIG.aiResponse.badTimingFullSmashMax,
            qualityPressure
          )
          : 0;
      const isServeReturn = arena.rallyStrokeCount === 0;
      const shouldFullSmash = !isServeReturn
        && hasPowerTiming
        && (frontCourtBadReturn || Math.random() < fullSmashProbability);
      const shouldAttack = hasCleanTiming && Math.random() < attackProbability;

      if (aiPreciseDefense) {
        const defenseRoll = Math.random();
        const recoveryTargetY = arena.playerY < 0.5 ? 0.82 : 0.18;
        const defensiveType: ShotType = defenseRoll < 0.34
          ? 'drive'
          : defenseRoll < 0.67
            ? zone === 'front' ? 'net-shot' : 'block'
            : zone === 'front' ? 'lift' : 'clear';
        return buildAiShot(defensiveType, recoveryTargetY, 'perfect', true);
      }

      // 紅圈球讓接球方只能防守；若沒有精準防守，也不能立即反殺。
      if (arena.lastPlayerWasPowerAttack) {
        const recoveryTargetY = arena.playerY < 0.5 ? 0.82 : 0.18;
        const defensiveType: ShotType = zone === 'front'
          ? Math.random() < 0.5 ? 'net-shot' : 'lift'
          : Math.random() < 0.5 ? 'block' : 'clear';
        return buildAiShot(defensiveType, recoveryTargetY, 'bad');
      }

      // 綠球主要用來建立下一拍紅圈機會：AI 能救回，但只能回普通或偏弱防守球。
      if (forcedDefense) {
        const recoveryTargetY = arena.playerY < 0.5 ? 0.82 : 0.18;
        const defensiveType: ShotType = zone === 'front'
          ? Math.random() < 0.55 ? 'lift' : 'net-shot'
          : zone === 'mid'
            ? Math.random() < 0.55 ? 'block' : 'clear'
            : Math.random() < 0.65 ? 'clear' : 'drop';
        return buildAiShot(
          defensiveType,
          recoveryTargetY,
          arena.lastPlayerTimingQuality === 'perfect' ? 'bad' : 'normal'
        );
      }

      if (shouldFullSmash) {
        const pressureTargetY = arena.playerY < 0.5 ? 0.84 : 0.16;
        const simulatedSwing = Math.random();
        const powerShotType: ShotType = simulatedSwing < 0.62
          ? 'smash'
          : simulatedSwing < 0.82 ? 'drive' : 'net-shot';
        return buildAiShot(powerShotType, pressureTargetY, 'perfect', false, true);
      }

      if (shouldAttack) {
        const pressureTargetY = arena.playerY < 0.5 ? 0.84 : 0.16;
        // 黃色普通球只能被一般施壓，不能從這條分支升級成紅色半殺／爆殺。
        if (arena.lastPlayerTimingQuality === 'normal') {
          if (arena.shotType === 'clear' || arena.shotType === 'lift' || isShortHighBall) {
            return buildAiShot(zone === 'back' ? 'drop' : 'drive', pressureTargetY, 'normal');
          }
          if (isRaisedDrive) {
            return buildAiShot('drive', pressureTargetY, 'normal');
          }
          return buildAiShot(zone === 'front' ? 'push' : 'drive', pressureTargetY, 'normal');
        }
        if (isRaisedDrive) {
          return buildAiShot('half-smash', pressureTargetY, 'perfect');
        }
        if (isShortHighBall || arena.shotType === 'clear' || arena.shotType === 'lift') {
          return buildAiShot(zone === 'back' && playerShotQuality >= 0.45 ? 'drop' : 'half-smash', pressureTargetY, 'perfect');
        }
        return buildAiShot(zone === 'front' ? 'push' : 'half-smash', pressureTargetY, 'perfect');
      }

      if (playerShotQuality >= 0.72) {
        const defensiveType: ShotType = zone === 'front'
          ? 'lift'
          : zone === 'mid' ? 'block' : Math.random() < 0.7 ? 'clear' : 'drop';
        return buildAiShot(
          defensiveType,
          0.18 + Math.random() * 0.64,
          arena.lastPlayerWasPowerAttack ? 'bad' : 'normal'
        );
      }
      if (zone === 'mid') {
        const middleType: ShotType = Math.random() < 0.55 ? 'drive' : 'push';
        return buildAiShot(middleType, 0.16 + Math.random() * 0.68);
      }
      if (zone === 'front') {
        return buildAiShot('net-shot', 0.2 + Math.random() * 0.6);
      }
      const rearType: ShotType = Math.random() < 0.42 ? 'drop' : 'clear';
      return buildAiShot(rearType, 0.16 + Math.random() * 0.68);
    };

    const executeAiHit = (now: number, contactProgress: number) => {
      const arena = arenaRef.current;
      arena.hitAt = now;
      arena.hitX = arena.shuttle.x;
      arena.hitY = arena.shuttle.y;
      const aiShot = chooseAiShot(contactProgress);
      const cpuPowerTiming = aiShot.powerTiming;
      const cpuAttack = cpuPowerTiming || aiShot.shotType === 'half-smash';
      const aiWasFatigued = arena.aiConsecutiveAttacks >= GAME_CONFIG.aiFatigue.consecutiveAttackLimit;
      arena.aiConsecutiveAttacks = cpuAttack ? arena.aiConsecutiveAttacks + 1 : 0;
      arena.lastHitPerfect = false;
      arena.lastHitDefensivePerfect = aiShot.defensivePerfect;
      arena.lastHitSmash = cpuPowerTiming;
      arena.shakeStrength = cpuPowerTiming ? 5 : cpuAttack ? 3.2 : aiShot.defensivePerfect ? 2.2 : 1.4;
      arena.shakeUntil = now + (cpuPowerTiming ? 140 : cpuAttack ? 100 : aiShot.defensivePerfect ? 110 : 60);
      const baseAiPower = cpuPowerTiming
        ? aiShot.shotType === 'net-shot'
          ? GAME_CONFIG.powerTimingPower.slow
          : aiShot.shotType === 'drive'
            ? GAME_CONFIG.powerTimingPower.medium
            : GAME_CONFIG.powerTimingPower.fast
        : cpuAttack
        ? lerp(GAME_CONFIG.aiResponse.attackPowerMin, GAME_CONFIG.aiResponse.attackPowerMax, aiShot.responseQuality)
        : lerp(GAME_CONFIG.aiResponse.normalPowerMin, GAME_CONFIG.aiResponse.normalPowerMax, aiShot.responseQuality);
      const preciseDefensePowerFloor = aiShot.shotType === 'drive'
        ? GAME_CONFIG.defensiveRecovery.fastPowerFloor
        : aiShot.shotType === 'clear' || aiShot.shotType === 'lift'
          ? GAME_CONFIG.defensiveRecovery.mediumPowerFloor
          : GAME_CONFIG.defensiveRecovery.slowPowerFloor;
      const aiPower = aiShot.defensivePerfect
        ? Math.max(baseAiPower, preciseDefensePowerFloor)
        : baseAiPower;
      const aiAccuracy = clamp(
        lerp(GAME_CONFIG.aiResponse.accuracyMin, GAME_CONFIG.aiResponse.accuracyMax, aiShot.responseQuality)
          - (aiWasFatigued ? GAME_CONFIG.aiFatigue.accuracyPenalty : 0),
        0.42,
        0.94
      );
      playHitSound(aiShot.defensivePerfect ? 'perfect' : aiShot.quality, cpuPowerTiming, aiPower);
      launchShot(
        'player',
        aiShot.shotType,
        aiShot.targetY,
        now,
        aiShot.quality,
        aiPower,
        aiAccuracy,
        cpuPowerTiming
      );
      effects.emit(aiShot.shotType === 'smash' ? 'smash' : 'hit', now, arena.hitX, arena.hitY, false, arena.shuttle.vx, arena.shuttle.vy);
      arena.rallyPressure = clamp(
        arena.rallyPressure * GAME_CONFIG.rallyPressure.memory
          - (arena.aiShotQuality - 0.5) * GAME_CONFIG.rallyPressure.aiResponseWeight,
        -1,
        1
      );
    };

    const getRacketMotion = (now: number): RacketMotion => {
      const samples = arenaRef.current.dragSamples;
      const latestSample = samples[samples.length - 1];
      if (!latestSample || now - latestSample.at > GAME_CONFIG.input.velocitySampleMs) {
        return { velocityX: 0, velocityY: 0, dragPower: 0 };
      }

      const sampleCutoff = now - GAME_CONFIG.input.velocitySampleMs;
      const firstSample = samples.find((sample) => sample.at >= sampleCutoff) ?? samples[0];
      const elapsedSeconds = Math.max((now - firstSample.at) / 1000, 0.008);
      let velocityX = (latestSample.courtX - firstSample.courtX) / elapsedSeconds;
      let velocityY = (latestSample.courtY - firstSample.courtY) / elapsedSeconds;
      const rawVelocity = Math.hypot(velocityX, velocityY);
      const clampedVelocity = Math.min(rawVelocity, GAME_CONFIG.input.maximumVelocity);

      if (rawVelocity > GAME_CONFIG.input.maximumVelocity) {
        const clampRatio = GAME_CONFIG.input.maximumVelocity / rawVelocity;
        velocityX *= clampRatio;
        velocityY *= clampRatio;
      }

      return {
        velocityX,
        velocityY,
        dragPower: clamp(clampedVelocity / GAME_CONFIG.input.maximumVelocity, 0, 1),
      };
    };

    const getPlayerContact = (now: number, touchSweeps: TouchSweep[]) => {
      const arena = arenaRef.current;
      const rect = canvas.getBoundingClientRect();
      const width = Math.max(1, rect.width);
      const height = Math.max(1, rect.height);
      const portrait = GAME_CONFIG.court.forcePortrait || height >= width;
      const courtLayout = getCourtLayout(width, height, portrait);
      const toScreen = (logicalX: number, logicalY: number) => courtToScreen(logicalX, logicalY, courtLayout, portrait);
      const radiusX = portrait ? courtLayout.width * 0.105 + 8 : 18;
      const radiusY = portrait ? 18 : courtLayout.height * 0.105 + 8;
      const flightEnd = arena.flightStartedAt + arena.flightDuration;
      const offsetAt = (at: number, courtX: number, courtY: number) => {
        const progress = clamp((at - arena.flightStartedAt) / arena.flightDuration, 0, 1);
        const shuttle = toScreen(
          lerp(arena.flightStartX, arena.landingX, progress),
          lerp(arena.flightStartY, arena.landingY, progress)
        );
        const player = toScreen(courtX, courtY);
        const arcLift = getArcLiftPixels(progress, arena.shotArcScale, courtLayout, portrait);
        return { x: (shuttle.x - player.x) / radiusX, y: (shuttle.y - arcLift - player.y) / radiusY };
      };

      for (const { from, to } of touchSweeps) {
        const start = Math.max(from.at, to.at - GAME_CONFIG.input.maximumTouchSweepMs);
        const validStart = Math.max(start, arena.flightStartedAt, arena.pauseUntil);
        const validEnd = Math.min(to.at, flightEnd - 0.001);
        if (validStart > validEnd) continue;

        // Compare both moving positions over the same interval, in units of the hit ellipse.
        const startFraction = to.at === start ? 0 : (validStart - start) / (to.at - start);
        const endFraction = to.at === start ? 1 : (validEnd - start) / (to.at - start);
        const a = offsetAt(validStart, lerp(from.courtX, to.courtX, startFraction), lerp(from.courtY, to.courtY, startFraction));
        const b = offsetAt(validEnd, lerp(from.courtX, to.courtX, endFraction), lerp(from.courtY, to.courtY, endFraction));
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const lengthSquared = dx * dx + dy * dy;
        const fraction = lengthSquared > 0 ? clamp(-(a.x * dx + a.y * dy) / lengthSquared, 0, 1) : 0;
        const distance = Math.hypot(a.x + fraction * dx, a.y + fraction * dy);
        const at = lerp(validStart, validEnd, fraction);
        if (distance <= 1) return { at, quality: 1 - distance };
      }

      if (now >= flightEnd) return null;
      const offset = offsetAt(now, arena.playerX, arena.playerY);
      const distance = Math.hypot(offset.x, offset.y);
      return distance <= 1 ? { at: now, quality: 1 - distance } : null;
    };

    const sampleClassicTrail = (arena: ArenaState, sliding = false) => {
      if (trailStyleRef.current !== 'classic') return;
      const speedIntensity = clamp((1450 - arena.flightDuration) / 880, 0, 1);
      const qualityBonus = arena.lastShotQuality === 'perfect' ? 5 : arena.lastShotQuality === 'bad' ? -3 : 0;
      const limit = sliding ? 9 : Math.max(4, Math.round(7 + speedIntensity * 10 + qualityBonus));
      arena.classicTrail.push({ x: arena.shuttle.x, y: arena.shuttle.y });
      if (arena.classicTrail.length > limit) arena.classicTrail.shift();
    };

    const update = (now: number, delta: number) => {
      const touchSweeps = touchSweepsRef.current;
      if (touchSweeps.length > 0) touchSweepsRef.current = [];
      if (phaseRef.current !== 'playing') return;
      const arena = arenaRef.current;
      const seconds = Math.min(delta, 34) / 1000;

      const cpuTargetX = arena.receiver === 'cpu' ? arena.landingX : 0.84;
      const cpuTargetY = arena.receiver === 'cpu'
        ? clamp(arena.landingY + Math.sin(now / 340) * 0.018, 0.12, 0.88)
        : 0.5;
      const aiMoveSpeed = arena.aiConsecutiveAttacks >= GAME_CONFIG.aiFatigue.consecutiveAttackLimit
        ? GAME_CONFIG.aiMoveSpeed * GAME_CONFIG.aiFatigue.moveSpeedScale
        : GAME_CONFIG.aiMoveSpeed;
      const cpuStep = (arena.cpuWillMiss ? 0.2 : aiMoveSpeed) * seconds;
      arena.cpuX += clamp(cpuTargetX - arena.cpuX, -cpuStep, cpuStep);
      arena.cpuX = clamp(arena.cpuX, 0.57, 0.94);
      arena.cpuY += clamp(cpuTargetY - arena.cpuY, -cpuStep, cpuStep);
      arena.cpuY = clamp(arena.cpuY, 0.14, 0.86);

      if (now < arena.pauseUntil) return;

      if (arena.landingSlideWinner !== null) {
        const landingSlideDuration = arena.shotType === 'smash' || arena.shotType === 'net-kill'
          ? GAME_CONFIG.landingSlide.smashDuration
          : GAME_CONFIG.landingSlide.duration;
        const slideProgress = clamp(
          (now - arena.landingSlideStartedAt) / landingSlideDuration,
          0,
          1
        );
        const easedProgress = 1 - Math.pow(1 - slideProgress, 3);
        arena.shuttle.x = arena.landingSlideStartX
          + (arena.landingSlideEndX - arena.landingSlideStartX) * easedProgress;
        arena.shuttle.y = arena.landingSlideStartY
          + (arena.landingSlideEndY - arena.landingSlideStartY) * easedProgress;
        sampleClassicTrail(arena, true);

        if (slideProgress >= 1) {
          const winner = arena.landingSlideWinner;
          arena.landingSlideWinner = null;
          awardPoint(winner, now);
        }
        return;
      }

      const shuttle = arena.shuttle;
      const flightProgress = clamp((now - arena.flightStartedAt) / arena.flightDuration, 0, 1);
      shuttle.x = arena.flightStartX + (arena.landingX - arena.flightStartX) * flightProgress;
      shuttle.y = arena.flightStartY + (arena.landingY - arena.flightStartY) * flightProgress;

      const cpuDistance = Math.hypot(arena.cpuX - arena.landingX, arena.cpuY - arena.landingY);
      const cpuDistanceToShuttle = Math.hypot(arena.cpuX - shuttle.x, arena.cpuY - shuttle.y);
      const timingWindows = getTimingWindows(arena.incomingShotQuality);
      const timeUntilLanding = arena.flightStartedAt + arena.flightDuration - now;
      const landingIsOut = isLandingOutOfBounds(arena.landingX, arena.landingY);

      if (arena.receiver === 'player' && arena.canBeHit && flightProgress < 1) {
        const remainingSeconds = Math.max(timeUntilLanding, 0) / 1000;
        const predictedLandingX = clamp(shuttle.x + shuttle.vx * remainingSeconds, 0, 1);
        const predictedLandingY = clamp(shuttle.y + shuttle.vy * remainingSeconds, -0.06, 1.06);
        const landingCircleBlend = 1 - Math.exp(-GAME_CONFIG.landingIndicator.lerpSpeed * seconds);

        arena.predictedLandingX = predictedLandingX;
        arena.predictedLandingY = predictedLandingY;
        arena.landingCircleX += (predictedLandingX - arena.landingCircleX) * landingCircleBlend;
        arena.landingCircleY += (predictedLandingY - arena.landingCircleY) * landingCircleBlend;
      }

      const playerContact = arena.receiver === 'player' && arena.canBeHit && !arena.playerHitThisFlight
        ? getPlayerContact(now, touchSweeps)
        : null;

      if (flightProgress >= 1 && !playerContact) {
        arena.canBeHit = false;
        if (landingIsOut) {
          beginLandingSlide(arena.receiver === 'cpu' ? 'cpu' : 'player', now);
          return;
        }
        if (arena.receiver === 'player') {
          beginLandingSlide('cpu', now);
          return;
        }
      }

      if (playerContact) {
        if (playerContact.at !== now) {
          const contactProgress = (playerContact.at - arena.flightStartedAt) / arena.flightDuration;
          shuttle.x = lerp(arena.flightStartX, arena.landingX, contactProgress);
          shuttle.y = lerp(arena.flightStartY, arena.landingY, contactProgress);
        }
        arena.canBeHit = false;
        arena.playerHitThisFlight = true;
        const motion = getRacketMotion(Math.max(now, playerContact.at));
        const hitResult = evaluatePlayerHit(playerContact.at, motion, playerContact.quality);
        const playerShot = choosePlayerShot(hitResult);
        arena.hitAt = now;
        arena.hitX = arena.shuttle.x;
        arena.hitY = arena.shuttle.y;
        arena.lastHitPerfect = hitResult.timingQuality === 'perfect';
        arena.lastHitDefensivePerfect = hitResult.defensivePerfect;
        const isPlayerSmash = playerShot.shotType === 'smash';
        const playerPowerTiming = hitResult.powerTiming;
        arena.lastPlayerTimingQuality = hitResult.timingQuality;
        arena.lastPlayerHitZone = getCourtZone(arena.shuttle.x, 'player');
        arena.lastPlayerDefensivePerfect = hitResult.defensivePerfect;
        arena.lastPlayerWasPowerAttack = playerPowerTiming;
        arena.lastHitSmash = playerPowerTiming;
        const defensiveSpeedBand = getSwingSpeedBand(hitResult.swingPower);
        const defensivePowerFloor = defensiveSpeedBand === 'fast'
          ? GAME_CONFIG.defensiveRecovery.fastPowerFloor
          : defensiveSpeedBand === 'medium'
            ? GAME_CONFIG.defensiveRecovery.mediumPowerFloor
            : GAME_CONFIG.defensiveRecovery.slowPowerFloor;
        const playerShotPower = playerPowerTiming
          ? GAME_CONFIG.powerTimingPower[defensiveSpeedBand]
          : isPlayerSmash
            ? 0.86
          : hitResult.defensivePerfect
            ? Math.max(hitResult.effectivePower, defensivePowerFloor)
            : hitResult.effectivePower;
        const playerExecutionQuality = hitResult.defensivePerfect ? 'perfect' : hitResult.timingQuality;
        arena.shakeStrength = playerPowerTiming
          ? 5
          : hitResult.defensivePerfect
            ? 2.2
            : 0.5 + playerShotPower * 2.4 + (hitResult.timingQuality === 'perfect' ? 1.2 : 0);
        arena.shakeUntil = now + (playerPowerTiming ? 140 : hitResult.defensivePerfect ? 110 : hitResult.timingQuality === 'perfect' ? 105 : 65);
        playHitSound(playerExecutionQuality, playerPowerTiming, playerShotPower);
        launchShot(
          'cpu',
          playerShot.shotType,
          playerShot.targetY,
          now,
          playerExecutionQuality,
          playerShotPower,
          hitResult.accuracy,
          playerPowerTiming
        );
        effects.emit(isPlayerSmash ? 'smash' : 'hit', now, arena.hitX, arena.hitY, true, arena.shuttle.vx, arena.shuttle.vy);
        const playerPressureSignal = (arena.playerShotQuality - 0.5) * GAME_CONFIG.rallyPressure.playerQualityWeight
          + (hitResult.timingQuality === 'perfect' ? GAME_CONFIG.rallyPressure.greenBonus : 0)
          + (hitResult.defensivePerfect ? GAME_CONFIG.rallyPressure.defensivePerfectBonus : 0)
          + (playerPowerTiming ? GAME_CONFIG.rallyPressure.powerAttackBonus : 0)
          - (hitResult.timingQuality === 'bad' ? GAME_CONFIG.rallyPressure.badTimingPenalty : 0);
        arena.rallyPressure = clamp(
          arena.rallyPressure * GAME_CONFIG.rallyPressure.memory + playerPressureSignal,
          -1,
          1
        );
        return;
      }

      if (
        arena.receiver === 'cpu'
        && !arena.cpuWillMiss
        && arena.aiHadSetupTime
        && flightProgress >= GAME_CONFIG.aiContact.interceptProgress
        && flightProgress < 1
        && cpuDistanceToShuttle <= GAME_CONFIG.catchRadius
      ) {
        executeAiHit(now, flightProgress);
        return;
      }

      if (arena.receiver === 'cpu' && timeUntilLanding <= timingWindows.normal && timeUntilLanding >= 0 && cpuDistance <= GAME_CONFIG.catchRadius) {
        arena.receiverReady = true;
      }

      sampleClassicTrail(arena);
      if (arena.receiver === 'player') {
        return;
      }

      if (flightProgress < 1) return;

      const receiverReachedLanding = !arena.cpuWillMiss && (arena.receiverReady || cpuDistance <= GAME_CONFIG.catchRadius);
      if (!receiverReachedLanding) {
        beginLandingSlide('player', now);
        return;
      }

      executeAiHit(now, 1);
    };

    const drawRacket = (
      ctx: CanvasRenderingContext2D,
      x: number,
      y: number,
      crossSize: number,
      frameColor: string,
      handleColor: string,
      fillColor: string,
      glowColor: string,
      isPlayer: boolean,
      portrait: boolean,
      quality: EffectQuality,
    ) => {
      ctx.save();
      ctx.translate(x, y);
      ctx.shadowColor = glowColor;
      ctx.shadowBlur = quality === 'low' ? 0 : quality === 'medium' ? 5 : isPlayer ? 14 : 9;
      ctx.fillStyle = fillColor;
      ctx.beginPath();
      ctx.ellipse(0, 0, portrait ? crossSize * 0.105 : 10, portrait ? 10 : crossSize * 0.105, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = frameColor;
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.ellipse(0, 0, portrait ? crossSize * 0.105 : 10, portrait ? 10 : crossSize * 0.105, 0, 0, Math.PI * 2);
      ctx.stroke();
      ctx.shadowBlur = 0;
      ctx.lineWidth = 1;
      ctx.globalAlpha = 0.55;
      for (let line = -2; line <= 2; line += 1) {
        ctx.beginPath();
        if (portrait) {
          ctx.moveTo(line * crossSize * 0.032, -8);
          ctx.lineTo(line * crossSize * 0.032, 8);
        } else {
          ctx.moveTo(-8, line * crossSize * 0.032);
          ctx.lineTo(8, line * crossSize * 0.032);
        }
        ctx.stroke();
      }
      ctx.beginPath();
      if (portrait) {
        ctx.moveTo(-crossSize * 0.09, -4);
        ctx.lineTo(crossSize * 0.09, -4);
        ctx.moveTo(-crossSize * 0.09, 4);
        ctx.lineTo(crossSize * 0.09, 4);
      } else {
        ctx.moveTo(-4, -crossSize * 0.09);
        ctx.lineTo(-4, crossSize * 0.09);
        ctx.moveTo(4, -crossSize * 0.09);
        ctx.lineTo(4, crossSize * 0.09);
      }
      ctx.stroke();
      ctx.globalAlpha = 1;
      ctx.strokeStyle = handleColor;
      ctx.lineWidth = 5;
      ctx.lineCap = 'round';
      ctx.beginPath();
      if (portrait) {
        ctx.moveTo(0, isPlayer ? 9 : -9);
        ctx.lineTo(0, isPlayer ? 28 : -28);
      } else {
        ctx.moveTo(isPlayer ? -9 : 9, 0);
        ctx.lineTo(isPlayer ? -28 : 28, 0);
      }
      ctx.stroke();
      ctx.restore();
    };

    const drawShuttle = (
      ctx: CanvasRenderingContext2D, x: number, y: number, angle: number,
      now: number, quality: EffectQuality, smash: number,
    ) => {
      const style = shuttleStyleRef.current;
      const visual = SHUTTLE_VISUALS[style];
      const pulse = (Math.sin(now / 130) + 1) / 2;
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(angle);
      if (visual.effectLevel > 0) drawShuttleAccent(ctx, style, now, quality, smash);
      ctx.shadowColor = visual.glow;
      ctx.shadowBlur = quality === 'low' ? 0 : (6 + visual.effectLevel * 3 + pulse * 3) * (quality === 'medium' ? 0.7 : 1);
      ctx.fillStyle = visual.feather;
      if (visual.featherGradient) {
        const gradient = ctx.createLinearGradient(0, -8, 0, 8);
        visual.featherGradient.forEach((color, index, colors) => gradient.addColorStop(index / (colors.length - 1), color));
        ctx.fillStyle = gradient;
      }
      ctx.beginPath();
      ctx.moveTo(-18, -8);
      ctx.quadraticCurveTo(-22, 0, -18, 8);
      ctx.lineTo(-5, 3.5);
      ctx.lineTo(-5, -3.5);
      ctx.closePath();
      ctx.fill();
      ctx.shadowBlur = 0;
      if (style === 'rainbow' || style === 'neon') {
        const colors = style === 'rainbow'
          ? ['#fb7185', '#fb923c', '#fde047', '#4ade80', '#38bdf8', '#c084fc']
          : ['#a855f7', '#22d3ee'];
        ctx.save();
        ctx.clip();
        ctx.rotate(Math.sin(now / 210) * 0.12);
        const band = 16 / colors.length;
        for (let i = 0; i < colors.length; i += 1) {
          ctx.fillStyle = colors[(i + Math.floor(now / (style === 'neon' ? 170 : 260))) % colors.length];
          ctx.fillRect(-23, -8 + i * band, 19, band + 0.4);
        }
        ctx.restore();
      }
      ctx.strokeStyle = visual.stroke;
      ctx.lineWidth = 1.3;
      ctx.beginPath();
      ctx.moveTo(-18, -7);
      ctx.lineTo(-5, 0);
      ctx.lineTo(-18, 7);
      ctx.moveTo(-15, 0);
      ctx.lineTo(-5, 0);
      ctx.stroke();
      ctx.fillStyle = visual.band;
      ctx.fillRect(-6, -4, 5, 8);
      ctx.fillStyle = visual.cork;
      ctx.beginPath();
      ctx.arc(4, 0, 6, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = visual.stroke;
      ctx.lineWidth = 1.5;
      ctx.stroke();

      if (visual.core) {
        ctx.fillStyle = visual.core;
        ctx.beginPath();
        ctx.arc(4, 0, 2.15 + pulse * 0.9 + smash * 0.6, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    };

    const draw = (now: number, effectNow = now) => {
      const rect = canvas.getBoundingClientRect();
      const width = Math.max(1, rect.width);
      const height = Math.max(1, rect.height);
      const quality = EFFECT_QUALITY;
      const pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
      const nextWidth = Math.round(width * pixelRatio);
      const nextHeight = Math.round(height * pixelRatio);
      if (canvas.width !== nextWidth || canvas.height !== nextHeight) {
        canvas.width = nextWidth;
        canvas.height = nextHeight;
        flightHistory.reset();
      }
      context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
      context.clearRect(0, 0, width, height);
      const activeArena = arenaRef.current;
      if (now < activeArena.shakeUntil) {
        const remainingShake = (activeArena.shakeUntil - now) / Math.max(1, activeArena.shakeUntil - activeArena.hitAt);
        const strength = activeArena.shakeStrength * clamp(remainingShake, 0, 1);
        context.translate((Math.random() - 0.5) * strength, (Math.random() - 0.5) * strength);
      }

      const portrait = GAME_CONFIG.court.forcePortrait || height >= width;
      const courtLayout = getCourtLayout(width, height, portrait);
      const toScreen = (logicalX: number, logicalY: number) => courtToScreen(logicalX, logicalY, courtLayout, portrait);

      const courtVisual = COURT_VISUALS[courtStyleRef.current];
      context.fillStyle = courtVisual.surround;
      context.fillRect(0, 0, width, height);
      const background = context.createLinearGradient(
        courtLayout.left,
        courtLayout.top,
        courtLayout.left + courtLayout.width,
        courtLayout.top + courtLayout.height
      );
      background.addColorStop(0, courtVisual.colors[0]);
      background.addColorStop(0.55, courtVisual.colors[1]);
      background.addColorStop(1, courtVisual.colors[2]);
      context.save();
      context.shadowColor = 'rgba(0,0,0,0.32)';
      context.shadowBlur = 22;
      context.fillStyle = background;
      context.fillRect(courtLayout.left, courtLayout.top, courtLayout.width, courtLayout.height);
      context.restore();

      drawCourtDecoration(context, courtStyleRef.current, courtLayout, now, quality);
      effects.drawCourt(context, {
        x: courtLayout.left, y: courtLayout.top, width: courtLayout.width, height: courtLayout.height,
      }, courtStyleRef.current, now, quality);
      context.strokeStyle = courtVisual.line;
      context.lineWidth = 2;
      context.strokeRect(courtLayout.left, courtLayout.top, courtLayout.width, courtLayout.height);
      const drawCourtLine = (startX: number, startY: number, endX: number, endY: number) => {
        const start = toScreen(startX, startY);
        const end = toScreen(endX, endY);
        context.beginPath();
        context.moveTo(start.x, start.y);
        context.lineTo(end.x, end.y);
        context.stroke();
      };
      drawCourtLine(0.25, 0, 0.25, 1);
      drawCourtLine(0.75, 0, 0.75, 1);
      drawCourtLine(0.08, 0, 0.08, 1);
      drawCourtLine(0.92, 0, 0.92, 1);
      drawCourtLine(0, 0.5, 0.25, 0.5);
      drawCourtLine(0.75, 0.5, 1, 0.5);

      context.strokeStyle = courtVisual.net;
      context.lineWidth = 5;
      drawCourtLine(0.5, 0, 0.5, 1);
      context.strokeStyle = 'rgba(255,255,255,0.3)';
      context.lineWidth = 1;
      const netPosition = toScreen(0.5, 0.5);
      if (portrait) {
        for (let x = courtLayout.left + 4; x < courtLayout.left + courtLayout.width - 3; x += 12) {
          context.beginPath();
          context.moveTo(x, netPosition.y - 6);
          context.lineTo(x, netPosition.y + 6);
          context.stroke();
        }
      } else {
        for (let y = courtLayout.top + 4; y < courtLayout.top + courtLayout.height - 3; y += 12) {
          context.beginPath();
          context.moveTo(netPosition.x - 6, y);
          context.lineTo(netPosition.x + 6, y);
          context.stroke();
        }
      }

      const arena = activeArena;
      const shuttlePosition = toScreen(arena.shuttle.x, arena.shuttle.y);
      const flightProgress = clamp((now - arena.flightStartedAt) / arena.flightDuration, 0, 1);
      const arcLift = getArcLiftPixels(flightProgress, arena.shotArcScale, courtLayout, portrait);
      const shuttleHead = { x: shuttlePosition.x, y: shuttlePosition.y - arcLift };
      const smashEffect = arena.shotType === 'smash' && arena.hitAt > 0
        ? 1 - clamp((now - arena.hitAt) / 330, 0, 1)
        : 0;
      const trailStyle = trailStyleRef.current;
      if (trailStyle !== 'classic' && phaseRef.current === 'playing' && now >= arena.flightStartedAt) {
        const slideAt = arena.landingSlideStartedAt;
        const slideDuration = arena.shotType === 'smash' || arena.shotType === 'net-kill'
          ? GAME_CONFIG.landingSlide.smashDuration
          : GAME_CONFIG.landingSlide.duration;
        const fade = slideAt > 0 ? 1 - clamp((now - slideAt) / slideDuration, 0, 1) : 1;
        const speed = Math.hypot(arena.shuttle.vx, arena.shuttle.vy) * fade * fade;
        flightHistory.record(arena.flightStartedAt, now, shuttleHead.x, shuttleHead.y, toScreen(arena.flightStartX, arena.flightStartY));
        if (fade > 0) {
          const points = flightHistory.sample(now, getFlightTrailWindow(trailStyle, speed, smashEffect), shuttleHead);
          const crowded = courtStyleRef.current !== 'classic' && shuttleStyleRef.current !== 'classic' && racketStyleRef.current !== 'classic';
          drawFlightTrail(context, trailStyle, points, now, fade * (crowded ? 0.78 : 1), quality, speed, smashEffect, arena.flightStartedAt);
        }
      } else {
        flightHistory.reset();
      }
      const sustainedAiPressure = clamp(-arena.rallyPressure, 0, 1);
      const incomingPressure = arena.receiver === 'player' && arena.canBeHit
        ? clamp(
          clamp((arena.incomingShotQuality - 0.52) / 0.48, 0, 1) * 0.78
            + sustainedAiPressure * 0.32,
          0,
          1
        )
        : 0;
      if (incomingPressure > 0) {
        context.save();
        context.strokeStyle = `rgba(251,113,133,${0.08 + incomingPressure * 0.2})`;
        context.lineWidth = 2 + incomingPressure * 3;
        context.strokeRect(4, 4, width - 8, height - 8);
        context.restore();
      }
      const shotSpeedIntensity = clamp((1450 - arena.flightDuration) / 880, 0, 1);
      const timingWindows = getTimingWindows(arena.incomingShotQuality);
      const powerTimingWindow = getPowerTimingWindow(arena.incomingShotQuality, matchDifficultyRef.current);
      const predictedOptimalHitTime = getPredictedOptimalHitTime(arena);
      const timingError = Math.abs(predictedOptimalHitTime - now);
      const baseTimingQuality: Exclude<HitQuality, 'none'> = timingError <= timingWindows.perfect
        ? 'perfect'
        : timingError <= timingWindows.normal ? 'normal' : 'bad';
      const defensivePerfectWindow = getDefensivePerfectWindow(arena.incomingShotQuality);
      const isDefensivePerfectMoment = isPreciseDefenseIncomingShot(arena)
        && timingError <= defensivePerfectWindow;
      const isPowerTimingMoment = !isPreciseDefenseIncomingShot(arena)
        && arena.rallyStrokeCount > 0
        && timingError <= powerTimingWindow;
      const classicEmphasis = baseTimingQuality === 'perfect' || isDefensivePerfectMoment;
      const emphasizeTiming = classicEmphasis || (trailStyle !== 'classic' && isPowerTimingMoment);
      const isPlayerIncomingFlight = arena.receiver === 'player'
        && arena.canBeHit
        && flightProgress < 1;

      const drawLandingIndicator = () => {
        if (phaseRef.current !== 'playing' || !isPlayerIncomingFlight) return;
        const landingCirclePosition = toScreen(arena.landingCircleX, arena.landingCircleY);
        const timingDistance = clamp(timingError / timingWindows.bad, 0, 1);
        const perfectPulse = emphasizeTiming
          ? (Math.sin(now / 42) + 1) * 2.2
          : 0;
        const indicatorScale = clamp(Math.min(courtLayout.width, courtLayout.height) / 320, 0.72, 1.15);
        const landingRadius = (
          GAME_CONFIG.landingIndicator.minimumRadius
            + timingDistance
            * (GAME_CONFIG.landingIndicator.maximumRadius - GAME_CONFIG.landingIndicator.minimumRadius)
            + perfectPulse
        ) * indicatorScale;
        const state = isDefensivePerfectMoment ? 'defense'
          : isPowerTimingMoment ? 'attack'
          : baseTimingQuality === 'bad' ? 'outside' : baseTimingQuality;
        drawTrailTimingTarget(context, trailStyle, {
          center: landingCirclePosition,
          radiusX: landingRadius * 1.15,
          radiusY: landingRadius * 0.72,
          focus: 1 - timingDistance,
          state,
          classicEmphasis,
          now: effectNow,
          quality,
        });
      };

      if (trailStyle === 'classic') drawLandingIndicator();

      const playerPosition = toScreen(arena.playerX, arena.playerY);
      const cpuPosition = toScreen(arena.cpuX, arena.cpuY);
      const racketStyle = racketStyleRef.current;
      const playerRacketVisual = RACKET_VISUALS[racketStyle];
      const racketRadiusX = portrait ? courtLayout.width * 0.105 : 10;
      const racketRadiusY = portrait ? 10 : courtLayout.height * 0.105;
      if (racketStyle === 'classic') {
        // The classic racket leaves a short trace of its actual positions.
        for (const sample of arena.dragSamples) {
          const age = now - sample.at;
          if (age < 0 || age > 120) continue;
          const point = toScreen(sample.courtX, sample.courtY);
          context.strokeStyle = `rgba(186,230,253,${(1 - age / 120) * 0.28})`;
          context.lineWidth = 2;
          context.beginPath();
          context.ellipse(point.x, point.y, racketRadiusX, racketRadiusY, 0, 0, Math.PI * 2);
          context.stroke();
        }
      } else if (phaseRef.current === 'playing') {
        const { velocityX, velocityY } = getRacketMotion(now);
        drawRacketMotion(context, racketStyle, playerPosition,
          portrait ? velocityY * courtLayout.width : velocityX * courtLayout.width,
          portrait ? -velocityX * courtLayout.height : velocityY * courtLayout.height,
          now, quality);
      }
      drawRacket(
        context,
        playerPosition.x,
        playerPosition.y,
        portrait ? courtLayout.width : courtLayout.height,
        playerRacketVisual.frame,
        playerRacketVisual.handle,
        playerRacketVisual.fill,
        playerRacketVisual.glow,
        true,
        portrait,
        quality,
      );
      if (racketStyle !== 'classic') {
        context.save();
        context.translate(playerPosition.x, playerPosition.y);
        context.shadowColor = playerRacketVisual.glow;
        context.shadowBlur = 4;
        drawRacketAccent(context, racketStyle, racketRadiusX, racketRadiusY, now, quality);
        context.restore();
      }
      drawRacket(
        context,
        cpuPosition.x,
        cpuPosition.y,
        portrait ? courtLayout.width : courtLayout.height,
        '#fda4af',
        '#be123c',
        'rgba(253,164,175,0.08)',
        'rgba(253,164,175,0.45)',
        false,
        portrait,
        quality,
      );

      const trailRgb = arena.shotWasPowerTiming
        ? '251,113,133'
        : arena.lastHitDefensivePerfect ? '125,211,252'
         : arena.lastHitPerfect && arena.receiver === 'cpu' ? '110,231,183'
         : arena.lastShotQuality === 'perfect' ? '74,222,128'
         : arena.lastShotQuality === 'normal' ? '253,224,71' : '251,146,60';
      if (trailStyle === 'classic') {
        const qualityScale = arena.lastShotQuality === 'perfect' ? 1.25 : arena.lastShotQuality === 'bad' ? 0.62 : 1;
        arena.classicTrail.forEach((point, index, points) => {
          const position = toScreen(point.x, point.y);
          const alpha = ((index + 1) / points.length) * (0.13 + shotSpeedIntensity * 0.3) * qualityScale;
          context.fillStyle = `rgba(${trailRgb},${alpha})`;
          context.beginPath();
          context.arc(position.x, position.y, (1.5 + index * (0.18 + shotSpeedIntensity * 0.16)) * qualityScale, 0, Math.PI * 2);
          context.fill();
        });
      }
      context.save();
      context.fillStyle = `rgba(15,23,42,${0.16 + flightProgress * 0.1})`;
      context.beginPath();
      context.ellipse(shuttlePosition.x, shuttlePosition.y + 5, 10 - arcLift * 0.12, 4, 0, 0, Math.PI * 2);
      context.fill();
      context.restore();
      const angleSampleOffset = 0.008;
      const angleStartProgress = Math.max(0, flightProgress - angleSampleOffset);
      const angleEndProgress = Math.min(1, flightProgress + angleSampleOffset);
      const angleStartPosition = toScreen(
        arena.flightStartX + (arena.landingX - arena.flightStartX) * angleStartProgress,
        arena.flightStartY + (arena.landingY - arena.flightStartY) * angleStartProgress
      );
      const angleEndPosition = toScreen(
        arena.flightStartX + (arena.landingX - arena.flightStartX) * angleEndProgress,
        arena.flightStartY + (arena.landingY - arena.flightStartY) * angleEndProgress
      );
      const angleStartLift = getArcLiftPixels(angleStartProgress, arena.shotArcScale, courtLayout, portrait);
      const angleEndLift = getArcLiftPixels(angleEndProgress, arena.shotArcScale, courtLayout, portrait);
      const flightAngleX = angleEndPosition.x - angleStartPosition.x;
      const flightAngleY = (angleEndPosition.y - angleEndLift) - (angleStartPosition.y - angleStartLift);
      const slideAngleX = portrait
        ? arena.shuttle.vy * courtLayout.width
        : arena.shuttle.vx * courtLayout.width;
      const slideAngleY = portrait
        ? -arena.shuttle.vx * courtLayout.height
        : arena.shuttle.vy * courtLayout.height;
      const shuttleAngle = arena.landingSlideStartedAt > 0
        ? Math.atan2(slideAngleY, slideAngleX)
        : Math.atan2(flightAngleY, flightAngleX);
      if (shotSpeedIntensity > 0.58) {
        const glowRadius = 15 + Math.sin(now / (70 - shotSpeedIntensity * 24)) * 3 + shotSpeedIntensity * 8;
        const glow = context.createRadialGradient(
          shuttlePosition.x,
          shuttlePosition.y - arcLift,
          2,
          shuttlePosition.x,
          shuttlePosition.y - arcLift,
          glowRadius
        );
        glow.addColorStop(0, `rgba(${trailRgb},0.36)`);
        glow.addColorStop(1, `rgba(${trailRgb},0)`);
        context.fillStyle = glow;
        context.beginPath();
        context.arc(shuttlePosition.x, shuttlePosition.y - arcLift, glowRadius, 0, Math.PI * 2);
        context.fill();
      }
      drawShuttle(context, shuttleHead.x, shuttleHead.y, shuttleAngle, now, quality, smashEffect);
      const hitAge = now - arena.hitAt;
      const hitEffectDuration = arena.lastHitPerfect || arena.lastHitDefensivePerfect || arena.lastHitSmash ? 560 : 260;
      if (arena.hitAt > 0 && hitAge >= 0 && hitAge < hitEffectDuration) {
        const progress = hitAge / hitEffectDuration;
        const hitPosition = toScreen(arena.hitX, arena.hitY);
        const hitEffectRgb = arena.lastHitSmash
          ? '251,113,133'
          : arena.lastHitDefensivePerfect
            ? '125,211,252'
          : arena.lastShotQuality === 'perfect'
            ? '74,222,128'
            : arena.lastShotQuality === 'normal' ? '253,224,71' : '251,146,60';
        context.strokeStyle = `rgba(${hitEffectRgb},${1 - progress})`;
        context.lineWidth = arena.lastHitPerfect || arena.lastHitDefensivePerfect || arena.lastHitSmash ? 5 : 3;
        context.beginPath();
        context.arc(hitPosition.x, hitPosition.y, 10 + progress * (arena.lastHitPerfect || arena.lastHitDefensivePerfect || arena.lastHitSmash ? 52 : 30), 0, Math.PI * 2);
        context.stroke();
      }

      effects.drawObjects(context, {
        racket: racketStyleRef.current, shuttle: shuttleStyleRef.current,
        court: courtStyleRef.current, trail: trailStyleRef.current,
      }, toScreen, now, quality);

      if (trailStyle !== 'classic') drawLandingIndicator();
      context.font = '700 12px system-ui, sans-serif';
      if (portrait) {
        context.textAlign = 'left';
        context.fillStyle = 'rgba(255,228,230,0.9)';
        context.fillText('電腦', courtLayout.left + 8, courtLayout.top + 18);
        context.fillStyle = 'rgba(224,242,254,0.9)';
        context.fillText('你', courtLayout.left + 8, courtLayout.top + courtLayout.height - 10);
      } else {
        context.textAlign = 'left';
        context.fillStyle = 'rgba(224,242,254,0.9)';
        context.fillText('你', courtLayout.left + 8, courtLayout.top + 18);
        context.textAlign = 'right';
        context.fillStyle = 'rgba(255,228,230,0.9)';
        context.fillText('電腦', courtLayout.left + courtLayout.width - 8, courtLayout.top + 18);
      }
    };

    const demoMotion: DragSample[] = [
      { at: 0, courtX: 0.2, courtY: 0.5 },
      { at: 0, courtX: 0.2, courtY: 0.5 },
    ];

    const resetTryoutStage = (trial: TryoutState, stageNumber: number) => {
      trial.stageNumber = stageNumber;
      trial.playedEvent = false;
      effects.reset();
      flightHistory.reset();
      arenaRef.current.classicTrail.length = 0;
      arenaRef.current.hitAt = 0;
      setPlayerScore(0);
      setCpuScore(0);
    };

    const playTimingTryoutFrame = (now: number, trial: TryoutState) => {
      const arena = arenaRef.current;
      const cycleDuration = 1880;
      const cycle = Math.floor(Math.max(0, now - trial.startedAt) / cycleDuration);
      const start = trial.startedAt + cycle * cycleDuration;
      if (trial.stageNumber !== cycle) resetTryoutStage(trial, cycle);

      arena.flightStartedAt = start + 110;
      arena.flightDuration = 1050;
      arena.flightStartX = 0.84;
      arena.flightStartY = 0.32;
      arena.landingX = 0.33;
      arena.landingY = 0.62;
      arena.landingCircleX = arena.landingX;
      arena.landingCircleY = arena.landingY;
      arena.landingSlideStartedAt = 0;
      arena.receiver = 'player';
      arena.incomingShotQuality = 0.5;
      arena.shotWasPowerTiming = cycle % 3 === 2;
      arena.rallyStrokeCount = cycle % 3 === 0 ? 0 : 2;
      arena.shotType = arena.shotWasPowerTiming ? 'smash' : 'drive';
      arena.shotArcScale = 0.64;
      arena.waitingForServe = false;
      arena.shakeUntil = 0;
      arena.rallyPressure = 0;
      arena.dragSamples = [];
      arena.playerX = 0.16;
      arena.playerY = 0.36;
      arena.cpuX = 0.87;
      arena.cpuY = 0.32;

      // Hold the timing window briefly in the demo so its colors can be compared.
      const optimal = getPredictedOptimalHitTime(arena);
      const playhead = Math.min(now, optimal) + Math.max(0, now - optimal - 500);
      const progress = clamp((playhead - arena.flightStartedAt) / arena.flightDuration, 0, 1);
      arena.canBeHit = playhead >= arena.flightStartedAt && progress < 1;
      arena.shuttle.x = lerp(arena.flightStartX, arena.landingX, progress);
      arena.shuttle.y = lerp(arena.flightStartY, arena.landingY, progress);
      arena.shuttle.vx = progress < 1 ? (arena.landingX - arena.flightStartX) / 1.05 : 0;
      arena.shuttle.vy = progress < 1 ? (arena.landingY - arena.flightStartY) / 1.05 : 0;
      if (arena.canBeHit && playhead !== optimal) sampleClassicTrail(arena);
      return playhead;
    };

    const playTryoutFrame = (now: number, trial: TryoutState, mode: Exclude<TrialMode, 'free' | 'timing'>) => {
      const arena = arenaRef.current;
      const elapsed = Math.max(0, now - trial.startedAt);
      const stageNumber = Math.floor(elapsed / TRIAL_STAGE_LENGTH);
      const stageStart = trial.startedAt + stageNumber * TRIAL_STAGE_LENGTH;
      const age = elapsed % TRIAL_STAGE_LENGTH;
      const stage = mode === 'auto' ? AUTO_TRIAL_STAGES[stageNumber % (trial.hasVictory ? 5 : 4)] : mode;
      if (stageNumber !== trial.stageNumber) {
        resetTryoutStage(trial, stageNumber);
        setTrialStage(stage);
      }

      // Each stage runs on the normal court with a repeatable flight for comparison.
      const launchAge = stage === 'score' ? 90 : stage === 'move' ? 130 : TRIAL_EVENT_AT;
      const duration = stage === 'smash' ? 395 : stage === 'score' ? TRIAL_EVENT_AT - launchAge : 780;
      const progress = stage === 'win' ? 0 : clamp((age - launchAge) / duration, 0, 1);
      arena.shakeUntil = 0;
      arena.lastShotQuality = stage === 'smash' ? 'perfect' : 'normal';
      arena.lastHitPerfect = stage === 'smash';
      arena.lastHitDefensivePerfect = false;
      arena.lastHitSmash = stage === 'smash';
      arena.shotWasPowerTiming = stage === 'smash';
      arena.shotType = stage === 'smash' ? 'smash' : 'drive';
      arena.shotArcScale = stage === 'smash' ? 0.24 : 0.64;
      arena.rallyPressure = 0;
      arena.flightStartX = 0.23;
      arena.flightStartY = 0.32;
      arena.landingX = 0.82;
      arena.landingY = 0.67;
      arena.flightStartedAt = age >= launchAge && stage !== 'win' ? stageStart + launchAge : Infinity;
      arena.flightDuration = duration;
      arena.shuttle.x = lerp(arena.flightStartX, arena.landingX, progress);
      arena.shuttle.y = lerp(arena.flightStartY, arena.landingY, progress);
      arena.shuttle.vx = progress < 1 ? (arena.landingX - arena.flightStartX) / (duration / 1000) : 0;
      arena.shuttle.vy = progress < 1 ? (arena.landingY - arena.flightStartY) / (duration / 1000) : 0;
      arena.landingSlideStartedAt = progress === 1 ? arena.flightStartedAt + duration : 0;
      if (progress > 0 && progress < 1) sampleClassicTrail(arena);
      arena.canBeHit = false;
      arena.waitingForServe = false;
      arena.receiver = 'cpu';
      arena.cpuX = 0.86;
      arena.cpuY = 0.67;

      const racketX = (t: number) => stage === 'move' ? 0.21 + Math.sin(t / 210) * 0.055 : 0.23;
      const racketY = (t: number) => stage === 'move'
        ? 0.48 + Math.sin(t / 225 - 0.5) * 0.25
        : lerp(0.52, 0.32, t / TRIAL_EVENT_AT);
      arena.playerX = racketX(age);
      arena.playerY = racketY(age);
      demoMotion[0].at = now - 24;
      demoMotion[0].courtX = racketX(age - 24);
      demoMotion[0].courtY = racketY(age - 24);
      demoMotion[1].at = now;
      demoMotion[1].courtX = arena.playerX;
      demoMotion[1].courtY = arena.playerY;
      arena.dragSamples = demoMotion;

      if (!trial.playedEvent && stage !== 'move' && age >= TRIAL_EVENT_AT) {
        trial.playedEvent = true;
        const eventAt = stageStart + TRIAL_EVENT_AT;
        const score = stage === 'score' || stage === 'win';
        const x = score ? arena.landingX : arena.flightStartX;
        const y = score ? arena.landingY : arena.flightStartY;
        effects.emit(stage, eventAt, x, y, true, arena.shuttle.vx, arena.shuttle.vy);
        if (score) {
          setPlayerScore(stage === 'win' ? 3 : 1);
        } else {
          arena.hitAt = eventAt;
          arena.hitX = x;
          arena.hitY = y;
        }
      }
    };

    const loop = (now: number) => {
      if (phaseRef.current !== 'ready') {
        const arena = arenaRef.current;
        const delta = arena.lastTime ? now - arena.lastTime : 16.67;
        arena.lastTime = now;
        const trial = trialRef.current;
        if (trial?.mode === 'timing') {
          draw(playTimingTryoutFrame(now, trial), now);
        } else {
          if (trial && trial.mode !== 'free') playTryoutFrame(now, trial, trial.mode);
          else update(now, delta);
          draw(now);
        }
      }
      frameRef.current = window.requestAnimationFrame(loop);
    };

    frameRef.current = window.requestAnimationFrame(loop);
    return () => {
      window.cancelAnimationFrame(frameRef.current);
      if (audioContextRef.current) {
        void audioContextRef.current.close();
        audioContextRef.current = null;
      }
    };
  }, []);

  const movePlayerToPointer = (event: React.PointerEvent<HTMLCanvasElement>) => {
    if (phaseRef.current !== 'playing') return;
    if (trialRef.current && trialRef.current.mode !== 'free') return;
    const touch = event.pointerType === 'touch' ? activeTouchRef.current : null;
    if (event.pointerType === 'touch' && touch?.pointerId !== event.pointerId) return;

    const rect = event.currentTarget.getBoundingClientRect();
    const portrait = GAME_CONFIG.court.forcePortrait || rect.height >= rect.width;
    const layout = getCourtLayout(rect.width, rect.height, portrait);
    const nativeEvent = event.nativeEvent;
    const coalesced = touch ? nativeEvent.getCoalescedEvents?.() : undefined;
    const points = coalesced?.length ? coalesced : [nativeEvent];
    const now = performance.now();
    const arena = arenaRef.current;

    for (const point of points) {
      const pointerX = (point.clientX - rect.left - layout.left) / layout.width;
      const pointerY = (point.clientY - rect.top - layout.top) / layout.height;
      const at = touch && point.timeStamp > 0 && point.timeStamp <= now
        ? Math.max(point.timeStamp, touch.sample?.at ?? 0)
        : now;
      const sample = {
        at,
        courtX: clamp(portrait ? 1 - pointerY : pointerX, 0.055, GAME_CONFIG.playerCourtLimit),
        courtY: clamp(portrait ? pointerX : pointerY, 0.08, 0.92),
      };
      if (touch) {
        if (touch.sample) touchSweepsRef.current.push({ from: touch.sample, to: sample });
        touch.sample = sample;
      }
      arena.playerX = sample.courtX;
      arena.playerY = sample.courtY;
      arena.dragSamples.push(sample);
    }
    const oldestSampleAt = now - GAME_CONFIG.input.velocitySampleMs * 1.6;
    arena.dragSamples = arena.dragSamples.filter((sample) => sample.at >= oldestSampleAt);
  };

  const handleCourtPointerDown = (event: React.PointerEvent<HTMLCanvasElement>) => {
    if (phaseRef.current !== 'playing') return;
    if (trialRef.current && trialRef.current.mode !== 'free') return;
    const arena = arenaRef.current;
    const isTouch = event.pointerType === 'touch';
    if (isTouch) {
      if (activeTouchRef.current) return;
      activeTouchRef.current = { pointerId: event.pointerId, sample: null };
      event.currentTarget.setPointerCapture(event.pointerId);
      arena.dragSamples = [];
    }

    if (arena.waitingForServe) {
      const now = performance.now();
      arena.waitingForServe = false;
      arena.flightStartedAt = now;
      arena.pauseUntil = now;
      arena.canBeHit = arena.receiver === 'player';
      arena.dragSamples = [];
      setWaitingForServe(false);
      if (!isTouch) return;
    }

    movePlayerToPointer(event);
  };

  const endCourtTouch = (event: React.PointerEvent<HTMLCanvasElement>) => {
    if (activeTouchRef.current?.pointerId !== event.pointerId) return;
    if (event.type === 'pointerup') movePlayerToPointer(event);
    activeTouchRef.current = null;
  };

  return (
    <div className="fixed inset-0 z-[90] bg-slate-950" role="dialog" aria-modal="true" aria-label="羽球電腦對戰">
      <div className="shuttle-game-modal relative h-full w-full overflow-hidden bg-slate-950 text-white">
        <div className={`flex h-full flex-col ${phase === 'ready' ? 'invisible' : ''}`}>
          {trialItem && (
            <GameCosmeticTryout item={trialItem} mode={trialMode} stage={trialStage}
              onMode={mode => startTryout(trialItem, mode)} onBack={leaveTryout} />
          )}
          <div className="shrink-0 grid grid-cols-3 items-center border-b border-white/10 bg-slate-950 px-4 py-2">
            <div className="flex items-center gap-2 text-sky-300">
              <span className="text-xs font-black">你</span>
              <span className="text-2xl font-black tabular-nums text-white">{playerScore}</span>
            </div>
            <div className="text-center text-[10px] font-bold tracking-wider text-slate-400">
              {trialItem ? '試用・不計戰績' : `${difficultyLabel}・先到 3 分`}
            </div>
            <div className="flex items-center justify-end gap-2 text-rose-300">
              <span className="text-2xl font-black tabular-nums text-white">{cpuScore}</span>
              <span className="text-xs font-black">電腦</span>
            </div>
          </div>

          <div className="relative min-h-0 flex-1 overflow-hidden">
            <canvas
              ref={canvasRef}
              onPointerDown={handleCourtPointerDown}
              onPointerMove={movePlayerToPointer}
              onPointerUp={endCourtTouch}
              onPointerCancel={endCourtTouch}
              onLostPointerCapture={endCourtTouch}
              className="h-full w-full touch-none cursor-crosshair"
              aria-label="羽球對戰球場；滑鼠游標或手指位置就是球拍，讓球拍直接碰到羽球完成擊球"
            />

            {!trialItem && (
              <div className="absolute right-3 top-3 z-20">
                <button type="button" onClick={onClose} className="rounded-md bg-slate-950/55 p-2 text-slate-300 transition-colors hover:bg-slate-950/80 hover:text-white" aria-label="關閉遊戲">
                  <X className="h-4 w-4" />
                </button>
              </div>
            )}

            {phase === 'playing' && waitingForServe && (
              <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center">
                <div className="text-sm font-black tracking-wide text-white drop-shadow-[0_2px_5px_rgba(0,0,0,0.8)]">點一下場地發球</div>
              </div>
            )}

            {phase === 'finished' && (
              <div className={`absolute inset-0 z-20 flex items-center justify-center p-5 ${winner === 'player' && (equippedCourtStyle === 'space' || equippedRacketStyle === 'galaxy') ? 'bg-slate-950/35' : 'bg-slate-950/65 backdrop-blur-[2px]'}`}>
                <div className="flex w-full max-w-xs flex-col items-center text-center">
                  <Trophy className={`h-8 w-8 ${winner === 'player' ? 'text-amber-300' : 'text-slate-400'}`} />
                  <h2 className="mt-3 text-3xl font-black">{trialItem ? '試玩結束' : winner === 'player' ? '你贏了！' : '電腦獲勝'}</h2>
                  <p className="mt-2 text-sm text-slate-300">
                    {difficultyLabel}模式・最終比分 <span className="ml-1 font-black tabular-nums text-white">{playerScore}：{cpuScore}</span>
                  </p>
                  {!trialItem && winner === 'player' && !resultSaveError && (
                    <p className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-amber-300/15 px-3 py-1.5 text-sm font-bold text-amber-200">
                      <Coins aria-hidden="true" className="h-4 w-4" />
                      勝場獎勵 +{WIN_REWARD_COINS[matchDifficultyRef.current]} 枚金幣
                    </p>
                  )}
                  {resultSaveError && <p role="alert" className="mt-3 text-xs text-rose-300">{resultSaveError}</p>}
                  <div className="mt-6 flex w-full max-w-xs gap-2">
                    <button type="button" onClick={trialItem ? leaveTryout : onClose} className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl border border-white/15 bg-slate-950/55 px-5 py-3.5 text-sm font-black text-white transition-colors hover:bg-white/10 active:scale-95">
                      <X className="h-4 w-4" />
                      <span>{trialItem ? '回商店' : '退出遊戲'}</span>
                    </button>
                    <button type="button" onClick={startGame} className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl bg-emerald-400 px-5 py-3.5 text-sm font-black text-slate-950 transition-colors hover:bg-emerald-300 active:scale-95">
                      <RotateCcw className="h-4 w-4" />
                      <span>再戰一場</span>
                    </button>
                  </div>
                  {!trialItem && (
                    <div className="mt-2 grid w-full grid-cols-2 gap-2">
                      <button type="button" onClick={() => {
                        phaseRef.current = 'ready';
                        setPhase('ready');
                      }} className="min-h-11 rounded-xl border border-white/15 bg-slate-950/55 text-sm font-bold text-slate-300 hover:bg-white/10 hover:text-white">
                        切換難度
                      </button>
                      <button type="button" onClick={() => {
                        setIsShopOpen(true);
                        phaseRef.current = 'ready';
                        setPhase('ready');
                      }} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-white/15 bg-slate-950/55 text-sm font-bold text-white hover:bg-white/10">
                        <ShoppingBag aria-hidden="true" className="h-4 w-4 text-amber-300" />
                        換造型
                      </button>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        {phase === 'ready' && (isShopOpen ? (
          <div className="absolute inset-0 z-30">
            <GameCosmeticsShop onBack={() => setIsShopOpen(false)} onClose={onClose}
              initialCategory={shopCategory} onTry={item => startTryout(item, item.category === 'trail' ? 'timing' : 'move')} />
          </div>
        ) : (
          <div className="absolute inset-0 z-30 bg-slate-950">
            <GameIntroBackground />
            <button type="button" onClick={onClose} className="absolute right-4 top-4 z-10 grid size-11 place-items-center rounded-full bg-slate-950/75 text-slate-200 transition-colors hover:bg-slate-900 focus-visible:outline-2 focus-visible:outline-emerald-400" aria-label="關閉遊戲">
              <X className="h-5 w-5" />
            </button>
            <div className="relative h-full overflow-y-auto overscroll-contain">
              <div className="mx-auto flex min-h-full w-full max-w-5xl items-center justify-center px-4 py-[max(4.5rem,env(safe-area-inset-top),env(safe-area-inset-bottom))] sm:px-6">
                  <section className="w-full max-w-xs [text-shadow:0_1px_3px_#020617]">
                    <div className="flex items-center justify-center gap-2.5">
                      <Gamepad2 aria-hidden="true" className="h-6 w-6 text-emerald-400" />
                      <h1 className="text-2xl font-black">羽球對戰</h1>
                    </div>
                    <div className="mt-4 grid grid-cols-2 gap-2" role="group" aria-label="選擇遊戲難度">
                      {GAME_DIFFICULTIES.map(({ value, label }) => (
                        <button
                          key={value}
                          type="button"
                          aria-pressed={difficulty === value}
                          onClick={() => setDifficulty(value)}
                          className={`min-h-11 rounded-xl border px-2 text-sm font-black text-white transition-colors focus-visible:outline-2 focus-visible:outline-white ${difficulty === value
                            ? 'border-emerald-300 bg-emerald-950/50'
                            : 'border-white/35 bg-slate-950/30 hover:bg-slate-950/50'}`}
                        >
                          {label}
                        </button>
                      ))}
                    </div>

                    <div className="mt-2 grid grid-cols-[minmax(0,1fr)_auto] gap-2">
                      <button type="button" onClick={startGame} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-emerald-300/75 bg-emerald-950/55 px-3 text-sm font-black text-white transition-colors hover:bg-emerald-950/80 focus-visible:outline-2 focus-visible:outline-white active:scale-95">
                        <Zap className="h-5 w-5 fill-current text-emerald-300" />
                        <span>開始遊戲</span>
                      </button>
                      <button type="button" onClick={() => setIsShopOpen(true)} className="inline-flex min-h-11 items-center justify-center gap-1.5 rounded-xl border border-white/35 bg-slate-950/30 px-3 text-xs font-bold text-white transition-colors hover:bg-slate-950/50 focus-visible:outline-2 focus-visible:outline-white">
                        <ShoppingBag className="h-4 w-4 text-amber-300" />
                        <span>裝備商店</span>
                      </button>
                    </div>
                  </section>
              </div>
            </div>
          </div>
        ))}

      </div>
    </div>
  );
};

// Robust ASL alphabet classifier using MediaPipe hand landmarks (21 points).
// Landmarks are mirrored and rotated into a canonical pose before matching.

export interface HandLandmark { x: number; y: number; z: number }
export interface GestureResult { letter: string; confidence: number }

const W = 0;
const T_TIP = 4;
const I_MCP = 5, I_PIP = 6, I_DIP = 7, I_TIP = 8;
const M_MCP = 9, M_PIP = 10, M_DIP = 11, M_TIP = 12;
const R_MCP = 13, R_PIP = 14, R_DIP = 15, R_TIP = 16;
const P_MCP = 17, P_PIP = 18, P_DIP = 19, P_TIP = 20;

const d = (a: HandLandmark, b: HandLandmark) => Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);
const d2 = (a: HandLandmark, b: HandLandmark) => Math.hypot(a.x - b.x, a.y - b.y);
const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

// Palm width = distance from index MCP to pinky MCP — used for normalization.
const palmSize = (lm: HandLandmark[]) => d2(lm[I_MCP], lm[P_MCP]) || 0.0001;

interface FingerPose {
  straight: boolean;
  horizontal: boolean;
  downward: boolean;
  extended: boolean;
  curled: boolean;
  hooked: boolean;
  tipRise: number;
  pipAngle: number;
  dipAngle: number;
}

interface ThumbPose {
  out: boolean;
  across: boolean;
  nearIndex: boolean;
  nearMiddle: boolean;
  nearRing: boolean;
  touchingIndex: boolean;
  touchingMiddle: boolean;
}

function angleDeg(a: HandLandmark, b: HandLandmark, c: HandLandmark): number {
  const abx = a.x - b.x;
  const aby = a.y - b.y;
  const cbx = c.x - b.x;
  const cby = c.y - b.y;
  const denom = Math.hypot(abx, aby) * Math.hypot(cbx, cby) || 1;
  const cosine = clamp((abx * cbx + aby * cby) / denom, -1, 1);
  return Math.acos(cosine) * 180 / Math.PI;
}

function normalizeLandmarks(lm: HandLandmark[]): HandLandmark[] {
  const wrist = lm[W];
  const shouldMirror = lm[I_MCP].x > lm[P_MCP].x;
  const translated = lm.map((point) => {
    const x = point.x - wrist.x;
    const y = point.y - wrist.y;
    return {
      x: shouldMirror ? -x : x,
      y,
      z: shouldMirror ? -point.z : point.z,
    };
  });

  const scale = palmSize(translated);
  const palmAxis = translated[M_MCP];
  const angle = Math.atan2(palmAxis.y, palmAxis.x);
  const rotateBy = -Math.PI / 2 - angle;
  const cos = Math.cos(rotateBy);
  const sin = Math.sin(rotateBy);

  return translated.map((point) => ({
    x: (point.x * cos - point.y * sin) / scale,
    y: (point.x * sin + point.y * cos) / scale,
    z: point.z / scale,
  }));
}

function fingerPose(lm: HandLandmark[], mcp: number, pip: number, dip: number, tip: number): FingerPose {
  const pipAngle = angleDeg(lm[mcp], lm[pip], lm[dip]);
  const dipAngle = angleDeg(lm[pip], lm[dip], lm[tip]);
  const tipRise = lm[mcp].y - lm[tip].y;
  const horizontal = Math.abs(lm[tip].x - lm[mcp].x) > Math.abs(lm[tip].y - lm[mcp].y) * 1.15;
  const downward = lm[tip].y > lm[pip].y + 0.12 && lm[tip].y > lm[mcp].y - 0.02;
  const straight = pipAngle > 145 && dipAngle > 145 && d2(lm[tip], lm[mcp]) > 0.52;
  const extended = straight && (tipRise > 0.28 || horizontal) && !downward;
  const curled =
    (pipAngle < 135 || dipAngle < 135 || d(lm[tip], lm[W]) < d(lm[pip], lm[W]) * 1.03) &&
    tipRise < 0.35;
  const hooked = pipAngle > 135 && dipAngle < 138 && lm[tip].y > lm[dip].y - 0.02;

  return { straight, horizontal, downward, extended, curled, hooked, tipRise, pipAngle, dipAngle };
}

function thumbPose(lm: HandLandmark[]): ThumbPose {
  const tip = lm[T_TIP];
  const nearIndex = d2(tip, lm[I_PIP]) < 0.58 || d2(tip, lm[I_MCP]) < 0.52;
  const nearMiddle = d2(tip, lm[M_PIP]) < 0.62 || d2(tip, lm[M_MCP]) < 0.58;
  const nearRing = d2(tip, lm[R_PIP]) < 0.68 || d2(tip, lm[R_MCP]) < 0.62;
  const touchingIndex = d2(tip, lm[I_TIP]) < 0.32;
  const touchingMiddle = d2(tip, lm[M_TIP]) < 0.38 || d2(tip, lm[M_PIP]) < 0.42;
  const out = tip.x < lm[I_MCP].x - 0.12 || (d2(tip, lm[I_MCP]) > 0.9 && tip.x < lm[M_MCP].x - 0.08);
  const across = !out && tip.x > lm[I_MCP].x - 0.18 && tip.x < lm[P_MCP].x + 0.12 && tip.y > lm[I_MCP].y - 0.35;

  return { out, across, nearIndex, nearMiddle, nearRing, touchingIndex, touchingMiddle };
}

export function classifyGesture(lm: HandLandmark[]): GestureResult {
  if (!lm || lm.length < 21) return { letter: "?", confidence: 0 };
  if (palmSize(lm) < 0.01) return { letter: "?", confidence: 0 };

  const n = normalizeLandmarks(lm);
  const index = fingerPose(n, I_MCP, I_PIP, I_DIP, I_TIP);
  const middle = fingerPose(n, M_MCP, M_PIP, M_DIP, M_TIP);
  const ring = fingerPose(n, R_MCP, R_PIP, R_DIP, R_TIP);
  const pinky = fingerPose(n, P_MCP, P_PIP, P_DIP, P_TIP);
  const thumb = thumbPose(n);

  const extendedCount = [index, middle, ring, pinky].filter((finger) => finger.extended).length;
  const curledCount = [index, middle, ring, pinky].filter((finger) => finger.curled).length;
  const fistLike = curledCount >= 3 || (extendedCount === 0 && curledCount >= 2);

  const onlyIndex = index.extended && middle.curled && ring.curled && pinky.curled;
  const onlyPinky = pinky.extended && index.curled && middle.curled && ring.curled;
  const pairUp = index.extended && middle.extended && ring.curled && pinky.curled;
  const pairSide = index.straight && middle.straight && index.horizontal && middle.horizontal && ring.curled && pinky.curled;
  const pairDown = index.straight && middle.straight && index.downward && middle.downward && ring.curled && pinky.curled;
  const indexSide = index.straight && index.horizontal && middle.curled && ring.curled && pinky.curled;
  const indexDown = index.straight && index.downward && middle.curled && ring.curled && pinky.curled;
  const pairGap = Math.abs(n[I_TIP].x - n[M_TIP].x);
  const crossedPair = pairUp && pairGap < 0.12 && Math.abs(n[I_TIP].y - n[M_TIP].y) < 0.18;
  const closePair = pairUp && pairGap < 0.2;
  const spreadPair = pairUp && pairGap > 0.28;
  const fourVertical =
    [index, middle, ring, pinky].every((finger) => finger.extended && !finger.horizontal) &&
    Math.abs(n[I_TIP].x - n[M_TIP].x) < 0.3 &&
    Math.abs(n[M_TIP].x - n[R_TIP].x) < 0.3 &&
    Math.abs(n[R_TIP].x - n[P_TIP].x) < 0.34;
  const thumbSupportPair = thumb.out && (thumb.nearIndex || thumb.touchingMiddle || thumb.nearMiddle);
  const thumbBetweenFoldedPair = !thumb.out && thumb.nearIndex && thumb.nearMiddle && !thumb.nearRing;
  const tipsNearThumb =
    d2(n[I_TIP], n[T_TIP]) < 0.68 &&
    d2(n[M_TIP], n[T_TIP]) < 0.72 &&
    d2(n[R_TIP], n[T_TIP]) < 0.8;
  const tipsOverThumb = [I_TIP, M_TIP, R_TIP, P_TIP].filter((tip) => n[tip].y > n[T_TIP].y - 0.04).length;
  const thumbIndexGap = d2(n[T_TIP], n[I_TIP]);
  const partiallyCurved =
    [index, middle, ring, pinky].filter((finger) => !finger.extended && !finger.curled).length >= 2;

  if (thumb.out && pinky.extended && index.curled && middle.curled && ring.curled) {
    return { letter: "Y", confidence: 0.95 };
  }

  if (onlyPinky && !thumb.out) {
    return { letter: "I", confidence: 0.92 };
  }

  if (onlyIndex && thumb.out) {
    return { letter: "L", confidence: 0.92 };
  }

  if (thumb.touchingIndex && middle.extended && ring.extended && pinky.extended) {
    return { letter: "F", confidence: 0.94 };
  }

  if (thumb.touchingIndex && !middle.extended && !ring.extended && !pinky.extended) {
    return { letter: "O", confidence: 0.9 };
  }

  if (
    partiallyCurved &&
    !thumb.touchingIndex &&
    thumbIndexGap > 0.55 &&
    thumbIndexGap < 1.35 &&
    extendedCount <= 1 &&
    !fistLike
  ) {
    return { letter: "C", confidence: 0.82 };
  }

  if (index.extended && middle.extended && ring.extended && pinky.curled) {
    return { letter: "W", confidence: 0.9 };
  }

  if (pairUp && thumbSupportPair) {
    return { letter: "K", confidence: 0.9 };
  }

  if (pairDown && thumbSupportPair) {
    return { letter: "P", confidence: 0.88 };
  }

  if (crossedPair && !thumb.out) {
    return { letter: "R", confidence: 0.88 };
  }

  if (spreadPair && !thumb.out) {
    return { letter: "V", confidence: 0.9 };
  }

  if (closePair && !thumb.out) {
    return { letter: "U", confidence: 0.88 };
  }

  if (fourVertical) {
    return { letter: "B", confidence: thumb.across ? 0.93 : 0.88 };
  }

  if (onlyIndex && (thumb.touchingMiddle || thumb.nearMiddle || thumb.across)) {
    return { letter: "D", confidence: 0.88 };
  }

  if (indexSide && thumb.out) {
    return { letter: "G", confidence: 0.86 };
  }

  if (indexDown && thumb.out) {
    return { letter: "Q", confidence: 0.82 };
  }

  if (pairSide) {
    return { letter: "H", confidence: 0.86 };
  }

  if (index.hooked && middle.curled && ring.curled && pinky.curled) {
    return { letter: "X", confidence: 0.86 };
  }

  if (fistLike) {
    if (thumbBetweenFoldedPair) {
      return { letter: "T", confidence: 0.84 };
    }

    if (tipsOverThumb >= 3 && thumb.nearRing) {
      return { letter: "M", confidence: 0.82 };
    }

    if (tipsOverThumb >= 3 && thumb.nearMiddle) {
      return { letter: "N", confidence: 0.8 };
    }

    if (thumb.across && tipsNearThumb) {
      return { letter: "E", confidence: 0.8 };
    }

    if (thumb.out) {
      return { letter: "A", confidence: 0.86 };
    }

    if (thumb.across || thumb.nearIndex || thumb.nearMiddle) {
      return { letter: "S", confidence: 0.84 };
    }

    return { letter: "S", confidence: 0.78 };
  }

  return { letter: "?", confidence: 0.28 };
}

// ============ Dynamic gestures: J and Z ============
export interface TrajectoryPoint { x: number; y: number; t: number }

export class DynamicGestureTracker {
  private trajectory: TrajectoryPoint[] = [];
  private readonly maxPoints = 40;
  private readonly timeWindow = 1800;

  addPoint(x: number, y: number): void {
    const now = Date.now();
    this.trajectory.push({ x, y, t: now });
    this.trajectory = this.trajectory.filter((p) => now - p.t < this.timeWindow);
    if (this.trajectory.length > this.maxPoints) {
      this.trajectory = this.trajectory.slice(-this.maxPoints);
    }
  }

  // J: pinky traces a hook (down then curve to one side)
  detectJ(): boolean {
    if (this.trajectory.length < 8) return false;
    const pts = this.trajectory;
    const first = pts[0];
    const last = pts[pts.length - 1];
    const movedDown = last.y - first.y > 0.04;
    const lateralShift = Math.abs(last.x - first.x) > 0.03;
    // total path length significantly larger than straight-line dist (curve)
    let pathLen = 0;
    for (let i = 1; i < pts.length; i++) pathLen += Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y);
    const straight = Math.hypot(last.x - first.x, last.y - first.y);
    const curved = pathLen > Math.max(straight * 1.2, 0.08);
    return movedDown && lateralShift && curved;
  }

  // Z: index finger draws a Z — right, diagonal down-left, then right again
  detectZ(): boolean {
    if (this.trajectory.length < 9) return false;
    const pts = this.trajectory;
    const t = Math.floor(pts.length / 3);
    const s1 = { dx: pts[t].x - pts[0].x, dy: pts[t].y - pts[0].y };
    const s2 = { dx: pts[t * 2].x - pts[t].x, dy: pts[t * 2].y - pts[t].y };
    const s3 = { dx: pts[pts.length - 1].x - pts[t * 2].x, dy: pts[pts.length - 1].y - pts[t * 2].y };
    const firstDir = Math.sign(s1.dx);
    const secondDir = Math.sign(s2.dx);
    const thirdDir = Math.sign(s3.dx);
    return (
      Math.abs(s1.dx) > 0.025 &&
      Math.abs(s2.dx) > 0.02 &&
      Math.abs(s3.dx) > 0.025 &&
      s2.dy > 0.02 &&
      firstDir !== 0 &&
      secondDir === -firstDir &&
      thirdDir === firstDir
    );
  }

  clear(): void { this.trajectory = []; }
}

// ============ Smoothing buffer ============
export class GestureBuffer {
  private buf: Array<{ letter: string; weight: number }> = [];
  constructor(private size = 6) {}

  add(letter: string, confidence = 1): string {
    const weight = letter === "?" ? 0.35 : Math.max(0.45, confidence);
    this.buf.push({ letter, weight });
    if (this.buf.length > this.size) this.buf.shift();
    const freq: Record<string, number> = {};
    let totalWeight = 0;
    for (const entry of this.buf) {
      freq[entry.letter] = (freq[entry.letter] || 0) + entry.weight;
      if (entry.letter !== "?") totalWeight += entry.weight;
    }
    let best = "?", bestWeight = 0;
    for (const [k, v] of Object.entries(freq)) {
      if (k !== "?" && v > bestWeight) { best = k; bestWeight = v; }
    }
    return bestWeight >= Math.max(1.1, totalWeight * 0.42) ? best : "?";
  }

  clear() { this.buf = []; }
}

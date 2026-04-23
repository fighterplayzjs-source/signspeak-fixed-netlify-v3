// Robust ASL alphabet classifier using MediaPipe hand landmarks (21 points).
// Right-hand assumed (mirrored on screen). Coordinates: x, y in [0,1]; y grows downward.

export interface HandLandmark { x: number; y: number; z: number }
export interface GestureResult { letter: string; confidence: number }

const W = 0;
const T_CMC = 1, T_MCP = 2, T_IP = 3, T_TIP = 4;
const I_MCP = 5, I_PIP = 6, I_DIP = 7, I_TIP = 8;
const M_MCP = 9, M_PIP = 10, M_DIP = 11, M_TIP = 12;
const R_MCP = 13, R_PIP = 14, R_DIP = 15, R_TIP = 16;
const P_MCP = 17, P_PIP = 18, P_DIP = 19, P_TIP = 20;

const d = (a: HandLandmark, b: HandLandmark) => Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);
const d2 = (a: HandLandmark, b: HandLandmark) => Math.hypot(a.x - b.x, a.y - b.y);

// Palm width = distance from index MCP to pinky MCP — used for normalization.
const palmSize = (lm: HandLandmark[]) => d2(lm[I_MCP], lm[P_MCP]) || 0.0001;

// A finger is "extended" if the tip is significantly farther from MCP than PIP is.
// Using y-axis works best because ASL is shown with hand upright.
function fingerExtended(lm: HandLandmark[], tip: number, pip: number, mcp: number): boolean {
  // tip is above (smaller y) pip and pip above mcp by reasonable margin
  const tipAbovePip = lm[tip].y < lm[pip].y - 0.015;
  const pipAboveMcp = lm[pip].y < lm[mcp].y;
  // Distance check (3D) as a fallback for sideways hand
  const distRatio = d(lm[tip], lm[W]) / d(lm[pip], lm[W]);
  return (tipAbovePip && pipAboveMcp) || distRatio > 1.25;
}

function fingerCurled(lm: HandLandmark[], tip: number, pip: number, mcp: number): boolean {
  // tip is below or near pip in y, AND closer to wrist than pip
  return lm[tip].y > lm[pip].y - 0.01 && d(lm[tip], lm[W]) < d(lm[pip], lm[W]) * 1.05;
}

// Thumb fully extended outward (away from palm). Detect by checking thumb tip
// is far from the palm (index MCP).
function thumbExtended(lm: HandLandmark[]): boolean {
  const palm = palmSize(lm);
  return d2(lm[T_TIP], lm[I_MCP]) > palm * 0.8;
}

// Thumb tucked/across: tip is close to or past index MCP toward middle MCP
function thumbTuckedAcross(lm: HandLandmark[]): boolean {
  const palm = palmSize(lm);
  return d2(lm[T_TIP], lm[M_MCP]) < palm * 0.6;
}

function touching(lm: HandLandmark[], a: number, b: number, factor = 0.4): boolean {
  return d2(lm[a], lm[b]) < palmSize(lm) * factor;
}

export function classifyGesture(lm: HandLandmark[]): GestureResult {
  if (!lm || lm.length < 21) return { letter: "?", confidence: 0 };
  const palm = palmSize(lm);
  if (palm < 0.01) return { letter: "?", confidence: 0 };

  const iUp = fingerExtended(lm, I_TIP, I_PIP, I_MCP);
  const mUp = fingerExtended(lm, M_TIP, M_PIP, M_MCP);
  const rUp = fingerExtended(lm, R_TIP, R_PIP, R_MCP);
  const pUp = fingerExtended(lm, P_TIP, P_PIP, P_MCP);

  const iCurl = fingerCurled(lm, I_TIP, I_PIP, I_MCP);
  const mCurl = fingerCurled(lm, M_TIP, M_PIP, M_MCP);
  const rCurl = fingerCurled(lm, R_TIP, R_PIP, R_MCP);
  const pCurl = fingerCurled(lm, P_TIP, P_PIP, P_MCP);

  const tOut = thumbExtended(lm);
  const tAcross = thumbTuckedAcross(lm);

  const fistLike = iCurl && mCurl && rCurl && pCurl;
  const allUp = iUp && mUp && rUp && pUp;
  const onlyIndex = iUp && !mUp && !rUp && !pUp;
  const onlyPinky = pUp && !iUp && !mUp && !rUp;

  // Distance index<->middle tips, normalized
  const imGap = d2(lm[I_TIP], lm[M_TIP]) / palm;

  // ===== Y =====  thumb + pinky out, others curled
  if (tOut && pUp && iCurl && mCurl && rCurl) {
    return { letter: "Y", confidence: 0.95 };
  }

  // ===== I =====  pinky only
  if (onlyPinky && !tOut) {
    return { letter: "I", confidence: 0.92 };
  }

  // ===== L =====  index up + thumb out perpendicular
  if (onlyIndex && tOut) {
    return { letter: "L", confidence: 0.92 };
  }

  // ===== F =====  thumb-index pinch, middle/ring/pinky extended
  if (touching(lm, T_TIP, I_TIP, 0.35) && mUp && rUp && pUp) {
    return { letter: "F", confidence: 0.92 };
  }

  // ===== W =====  index, middle, ring up; pinky down
  if (iUp && mUp && rUp && !pUp) {
    return { letter: "W", confidence: 0.9 };
  }

  // ===== V =====  index + middle up, spread; ring/pinky down
  if (iUp && mUp && !rUp && !pUp && imGap > 0.45) {
    return { letter: "V", confidence: 0.9 };
  }

  // ===== U =====  index + middle up, close together; ring/pinky down; thumb tucked
  if (iUp && mUp && !rUp && !pUp && imGap <= 0.45 && !tOut) {
    return { letter: "U", confidence: 0.88 };
  }

  // ===== R =====  index + middle up and crossed (very tight, x close)
  if (iUp && mUp && !rUp && !pUp && imGap < 0.25) {
    const crossed = Math.abs(lm[I_TIP].x - lm[M_TIP].x) < 0.02;
    if (crossed) return { letter: "R", confidence: 0.85 };
  }

  // ===== K =====  index + middle up (V shape) with thumb extended between them
  if (iUp && mUp && !rUp && !pUp && tOut) {
    return { letter: "K", confidence: 0.88 };
  }

  // ===== B =====  all four fingers up, thumb tucked across palm
  if (allUp && !tOut) {
    return { letter: "B", confidence: 0.92 };
  }

  // ===== D =====  index up, others curled, thumb meets middle finger
  if (onlyIndex && !tOut) {
    return { letter: "D", confidence: 0.88 };
  }

  // ===== G =====  index pointing sideways, thumb out parallel
  // index extended but pointing horizontally (tip x far from MCP, y close)
  {
    const indexHoriz =
      Math.abs(lm[I_TIP].x - lm[I_MCP].x) > Math.abs(lm[I_TIP].y - lm[I_MCP].y) * 1.2 &&
      d2(lm[I_TIP], lm[I_MCP]) > palm * 0.5;
    if (indexHoriz && mCurl && rCurl && pCurl && tOut) {
      return { letter: "G", confidence: 0.82 };
    }
    if (indexHoriz && mCurl && rCurl && pCurl && !tOut) {
      return { letter: "Q", confidence: 0.78 };
    }
  }

  // ===== H =====  index + middle pointing sideways together
  {
    const sideways =
      Math.abs(lm[I_TIP].x - lm[I_MCP].x) > Math.abs(lm[I_TIP].y - lm[I_MCP].y) &&
      Math.abs(lm[M_TIP].x - lm[M_MCP].x) > Math.abs(lm[M_TIP].y - lm[M_MCP].y);
    if (iUp && mUp && !rUp && !pUp && sideways) {
      return { letter: "H", confidence: 0.85 };
    }
  }

  // ===== O =====  thumb tip touches index tip forming ring; other fingers also curved
  if (touching(lm, T_TIP, I_TIP, 0.35) && !mUp && !rUp && !pUp) {
    // distinguish from F (where m,r,p are up). Here all fingers are curved together.
    const middleCurved = d2(lm[M_TIP], lm[T_TIP]) < palm * 0.7;
    if (middleCurved) return { letter: "O", confidence: 0.88 };
  }

  // ===== C =====  curved hand (semi-circle). Fingers neither fully extended nor full fist.
  // Thumb tip and index tip are far apart (open) but fingers curved.
  {
    const fingersCurved =
      lm[I_TIP].y < lm[I_MCP].y && lm[I_TIP].y > lm[I_PIP].y - 0.08 && // partially curled
      lm[M_TIP].y > lm[M_PIP].y - 0.05 &&
      !iUp && !mUp;
    const thumbIndexGap = d2(lm[T_TIP], lm[I_TIP]) / palm;
    if (fingersCurved && thumbIndexGap > 0.6 && thumbIndexGap < 1.6 && !fistLike) {
      return { letter: "C", confidence: 0.78 };
    }
  }

  // ===== X =====  index hooked (PIP up but tip curled back down), others curled
  {
    const indexHooked =
      lm[I_PIP].y < lm[I_MCP].y - 0.02 && // pip above mcp
      lm[I_TIP].y > lm[I_PIP].y + 0.005 && // tip below pip (curled)
      mCurl && rCurl && pCurl;
    if (indexHooked) return { letter: "X", confidence: 0.85 };
  }

  // ===== P =====  K-shape pointing downward (middle finger points down)
  {
    const middleDown = lm[M_TIP].y > lm[M_MCP].y + 0.05;
    const indexDown = lm[I_TIP].y > lm[I_MCP].y + 0.02;
    if (tOut && middleDown && indexDown && rCurl && pCurl) {
      return { letter: "P", confidence: 0.82 };
    }
  }

  // ===== Fist-based: A, E, M, N, S, T =====
  if (fistLike) {
    // T: thumb tucked between index and middle (thumb tip near index PIP, slightly above index MCP)
    const thumbBetweenIM =
      d2(lm[T_TIP], lm[I_PIP]) < palm * 0.5 &&
      lm[T_TIP].x > Math.min(lm[I_MCP].x, lm[M_MCP].x) - 0.01 &&
      lm[T_TIP].x < Math.max(lm[I_MCP].x, lm[M_MCP].x) + 0.01;
    if (thumbBetweenIM && !tOut) {
      return { letter: "T", confidence: 0.82 };
    }

    // M: thumb tucked under three fingers (index, middle, ring tips below thumb tip)
    const thumbY = lm[T_TIP].y;
    const fingersBelowThumb = [I_TIP, M_TIP, R_TIP, P_TIP].filter((tip) => lm[tip].y > thumbY - 0.02).length;
    const thumbDeep = lm[T_TIP].y > lm[I_MCP].y - 0.01; // thumb tip below knuckles
    if (thumbDeep && fingersBelowThumb >= 3) {
      // M = thumb under three fingers; N = thumb under two fingers
      // Distinguish by where thumb tip is relative to ring MCP
      if (d2(lm[T_TIP], lm[R_MCP]) < palm * 0.45) {
        return { letter: "M", confidence: 0.78 };
      }
      return { letter: "N", confidence: 0.75 };
    }

    // E: all fingertips curled down to touch/near the thumb (thumb across, fingertips meet thumb)
    const tipsNearThumb =
      d2(lm[I_TIP], lm[T_TIP]) < palm * 0.5 &&
      d2(lm[M_TIP], lm[T_TIP]) < palm * 0.6;
    if (tAcross && tipsNearThumb) {
      return { letter: "E", confidence: 0.78 };
    }

    // A: thumb out beside the fist (thumb extended along the side, not across)
    if (tOut) {
      return { letter: "A", confidence: 0.85 };
    }

    // S: closed fist with thumb wrapped across knuckles (default fist)
    return { letter: "S", confidence: 0.82 };
  }

  return { letter: "?", confidence: 0.3 };
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
    if (this.trajectory.length < 10) return false;
    const pts = this.trajectory;
    const first = pts[0];
    const last = pts[pts.length - 1];
    const movedDown = last.y - first.y > 0.06;
    const lateralShift = Math.abs(last.x - first.x) > 0.05;
    // total path length significantly larger than straight-line dist (curve)
    let pathLen = 0;
    for (let i = 1; i < pts.length; i++) pathLen += Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y);
    const straight = Math.hypot(last.x - first.x, last.y - first.y);
    const curved = pathLen > straight * 1.3;
    return movedDown && lateralShift && curved;
  }

  // Z: index finger draws a Z — right, diagonal down-left, then right again
  detectZ(): boolean {
    if (this.trajectory.length < 12) return false;
    const pts = this.trajectory;
    const t = Math.floor(pts.length / 3);
    const s1 = { dx: pts[t].x - pts[0].x, dy: pts[t].y - pts[0].y };
    const s2 = { dx: pts[t * 2].x - pts[t].x, dy: pts[t * 2].y - pts[t].y };
    const s3 = { dx: pts[pts.length - 1].x - pts[t * 2].x, dy: pts[pts.length - 1].y - pts[t * 2].y };
    return s1.dx > 0.04 && s2.dx < -0.03 && s2.dy > 0.03 && s3.dx > 0.04;
  }

  clear(): void { this.trajectory = []; }
}

// ============ Smoothing buffer ============
export class GestureBuffer {
  private buf: string[] = [];
  constructor(private size = 8) {}

  add(letter: string): string {
    this.buf.push(letter);
    if (this.buf.length > this.size) this.buf.shift();
    const freq: Record<string, number> = {};
    for (const l of this.buf) freq[l] = (freq[l] || 0) + 1;
    let best = "?", bestCount = 0;
    for (const [k, v] of Object.entries(freq)) {
      if (k !== "?" && v > bestCount) { best = k; bestCount = v; }
    }
    return bestCount >= Math.ceil(this.size * 0.5) ? best : "?";
  }

  clear() { this.buf = []; }
}

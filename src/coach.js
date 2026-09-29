export class CoachEngine {
  constructor(onCue) {
    this.onCue = onCue;
    this.cooldowns = new Map();
    this.lastCue = null;
    this.ladders = {
      premature_detail: ["一回全体。", "細部より、全体の大きさと傾き。", "今の局所を止めて、外形と大きな軸を見直して。"],
      repeated_region: ["そこ、何を直したい？", "消す前に原因を一つ決めて。", "同じ場所を繰り返している。輪郭ではなく上流の位置関係を確認。"],
      searching_line: ["線より位置を先に。", "一本で描く必要はない。まず始点・終点・最大カーブを決めて。", "手の問題か迷いの問題か切り分けよう。位置を決めてから一度だけ引いて。"],
      global_check: ["全体。", "一度Referenceと全体比率・傾きを比較。", "細部を隠したつもりで、外形・主要軸・negative spaceだけ確認。"],
      pause_check: ["何が違う？", "直す前に、一番大きい違いを一つ言葉にして。", "ReferenceとDrawingを交互に短く見て、最大のズレを一つだけ選んで。"]
    };
  }

  analyze(strokes, options = {}) {
    const pen = strokes.filter(s => s.tool !== "eraser" && s.points && s.points.length > 1);
    if (pen.length < 5) return null;

    const now = Date.now();
    const candidates = [];
    const global = boundsForStrokes(pen);
    const recent8 = pen.slice(-8);
    const recent6 = pen.slice(-6);

    if (pen.length >= 14 && recent8.length >= 6) {
      const local = boundsForStrokes(recent8);
      const globalArea = area(global);
      const localArea = area(local);
      if (globalArea > 0.035 && localArea / globalArea < 0.18) {
        candidates.push({ code: "premature_detail", score: 0.72, risk: "low" });
      }
    }

    if (recent6.length >= 5) {
      const centers = recent6.map(strokeCenter);
      const spread = centerSpread(centers);
      const shortRatio = recent6.filter(s => strokeLength(s) < 0.07).length / recent6.length;
      if (spread < 0.09 && shortRatio > 0.65) {
        candidates.push({ code: "searching_line", score: 0.68, risk: "low" });
      }

      const overlap = meanPairOverlap(recent6);
      if (overlap > 0.34) {
        candidates.push({ code: "repeated_region", score: 0.74, risk: "low" });
      }
    }

    if (options.manual) candidates.push({ code: "global_check", score: 1, risk: "low" });

    candidates.sort((a, b) => b.score - a.score);
    const chosen = candidates.find(c => this.isAvailable(c.code, now, options.manual));
    if (!chosen) return null;

    const cue = this.makeCue(chosen.code, 0, chosen);
    this.mark(chosen.code, now);
    this.lastCue = cue;
    if (typeof this.onCue === "function") this.onCue(cue);
    return cue;
  }

  escalate() {
    if (!this.lastCue) return null;
    const nextLevel = Math.min(2, this.lastCue.level + 1);
    const cue = this.makeCue(this.lastCue.code, nextLevel, this.lastCue);
    this.lastCue = cue;
    if (typeof this.onCue === "function") this.onCue(cue);
    return cue;
  }

  makeCue(code, level, base = {}) {
    const ladder = this.ladders[code] || ["一回全体。"];
    return {
      id: crypto.randomUUID(),
      code,
      level,
      risk: base.risk || "low",
      score: base.score || null,
      text: ladder[Math.min(level, ladder.length - 1)],
      at: Date.now()
    };
  }

  isAvailable(code, now, manual) {
    if (manual) return true;
    const last = this.cooldowns.get(code) || 0;
    return now - last > 18000;
  }

  mark(code, now) {
    this.cooldowns.set(code, now);
  }
}

function boundsForStrokes(strokes) {
  let minX = 1, minY = 1, maxX = 0, maxY = 0, seen = false;
  for (const s of strokes) {
    for (const p of s.points || []) {
      seen = true;
      minX = Math.min(minX, p.x); minY = Math.min(minY, p.y);
      maxX = Math.max(maxX, p.x); maxY = Math.max(maxY, p.y);
    }
  }
  return seen ? { minX, minY, maxX, maxY } : { minX:0, minY:0, maxX:0, maxY:0 };
}
function area(b) { return Math.max(0, b.maxX-b.minX) * Math.max(0, b.maxY-b.minY); }
function strokeBounds(s) { return boundsForStrokes([s]); }
function strokeCenter(s) {
  const b = strokeBounds(s);
  return { x:(b.minX+b.maxX)/2, y:(b.minY+b.maxY)/2 };
}
function centerSpread(points) {
  if (!points.length) return 0;
  const cx = points.reduce((a,p)=>a+p.x,0)/points.length;
  const cy = points.reduce((a,p)=>a+p.y,0)/points.length;
  return Math.sqrt(points.reduce((a,p)=>a+(p.x-cx)**2+(p.y-cy)**2,0)/points.length);
}
function strokeLength(s) {
  let d = 0;
  for (let i=1;i<s.points.length;i++) {
    const a=s.points[i-1], b=s.points[i];
    d += Math.hypot(b.x-a.x,b.y-a.y);
  }
  return d;
}
function iou(a,b) {
  const ix=Math.max(0,Math.min(a.maxX,b.maxX)-Math.max(a.minX,b.minX));
  const iy=Math.max(0,Math.min(a.maxY,b.maxY)-Math.max(a.minY,b.minY));
  const inter=ix*iy;
  const union=area(a)+area(b)-inter;
  return union>0?inter/union:0;
}
function meanPairOverlap(strokes) {
  let sum=0,n=0;
  for(let i=1;i<strokes.length;i++){sum+=iou(strokeBounds(strokes[i-1]),strokeBounds(strokes[i]));n++;}
  return n?sum/n:0;
}

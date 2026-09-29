export function createDrawingSurface(canvas, onChange) {
  const ctx = canvas.getContext("2d", { alpha: true, desynchronized: true });
  const state = {
    strokes: [],
    current: null,
    tool: "pen",
    brushSize: 3,
    pointerId: null
  };

  function resize() {
    const rect = canvas.getBoundingClientRect();
    const dpr = Math.max(1, Math.min(3, window.devicePixelRatio || 1));
    const w = Math.max(1, Math.round(rect.width * dpr));
    const h = Math.max(1, Math.round(rect.height * dpr));
    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w;
      canvas.height = h;
      render();
    }
  }

  const observer = new ResizeObserver(resize);
  observer.observe(canvas);

  function pointFromEvent(e) {
    const rect = canvas.getBoundingClientRect();
    return {
      x: clamp((e.clientX - rect.left) / Math.max(1, rect.width), 0, 1),
      y: clamp((e.clientY - rect.top) / Math.max(1, rect.height), 0, 1),
      t: performance.now(),
      pressure: typeof e.pressure === "number" ? e.pressure : 0.5,
      tiltX: typeof e.tiltX === "number" ? e.tiltX : 0,
      tiltY: typeof e.tiltY === "number" ? e.tiltY : 0,
      twist: typeof e.twist === "number" ? e.twist : 0,
      pointerType: e.pointerType || "unknown"
    };
  }

  function begin(e) {
    if (state.pointerId !== null) return;
    state.pointerId = e.pointerId;
    canvas.setPointerCapture(e.pointerId);
    state.current = {
      id: crypto.randomUUID(),
      tool: state.tool,
      size: state.brushSize,
      startedAt: Date.now(),
      endedAt: null,
      points: [pointFromEvent(e)]
    };
    drawSegment(state.current, 0);
    e.preventDefault();
  }

  function move(e) {
    if (!state.current || e.pointerId !== state.pointerId) return;
    const events = typeof e.getCoalescedEvents === "function" ? e.getCoalescedEvents() : [e];
    for (const item of events) {
      const p = pointFromEvent(item);
      const prev = state.current.points[state.current.points.length - 1];
      if (!prev || distance(prev, p) > 0.0002) {
        state.current.points.push(p);
        drawSegment(state.current, state.current.points.length - 2);
      }
    }
    e.preventDefault();
  }

  function end(e) {
    if (!state.current || e.pointerId !== state.pointerId) return;
    state.current.endedAt = Date.now();
    if (state.current.points.length === 1) {
      const p = state.current.points[0];
      state.current.points.push({ ...p, x: Math.min(1, p.x + 0.0005), t: performance.now() });
    }
    state.strokes.push(state.current);
    state.current = null;
    state.pointerId = null;
    try { canvas.releasePointerCapture(e.pointerId); } catch (_) {}
    notify();
    e.preventDefault();
  }

  function cancel(e) {
    if (state.current && e.pointerId === state.pointerId) {
      state.current = null;
      state.pointerId = null;
      render();
    }
  }

  function drawSegment(stroke, index) {
    const pts = stroke.points;
    if (!pts.length) return;
    const rect = canvas.getBoundingClientRect();
    const sx = canvas.width / Math.max(1, rect.width);
    const sy = canvas.height / Math.max(1, rect.height);
    const a = pts[Math.max(0, index)];
    const b = pts[Math.min(pts.length - 1, index + 1)];
    ctx.save();
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.globalCompositeOperation = stroke.tool === "eraser" ? "destination-out" : "source-over";
    ctx.strokeStyle = "#161816";
    const pressure = stroke.tool === "eraser" ? 1 : Math.max(0.35, ((a.pressure || 0.5) + (b.pressure || 0.5)) / 2);
    ctx.lineWidth = Math.max(1, stroke.size * ((sx + sy) / 2) * pressure);
    ctx.beginPath();
    ctx.moveTo(a.x * canvas.width, a.y * canvas.height);
    ctx.lineTo(b.x * canvas.width, b.y * canvas.height);
    ctx.stroke();
    ctx.restore();
  }

  function render() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    for (const stroke of state.strokes) {
      for (let i = 0; i < Math.max(1, stroke.points.length - 1); i++) drawSegment(stroke, i);
    }
  }

  function notify() {
    if (typeof onChange === "function") onChange(getSnapshotState());
  }

  function setTool(tool) {
    state.tool = tool === "eraser" ? "eraser" : "pen";
  }

  function setBrushSize(size) {
    state.brushSize = clamp(Number(size) || 3, 1, 36);
  }

  function undo() {
    if (!state.strokes.length) return;
    state.strokes.pop();
    render();
    notify();
  }

  function clear() {
    state.strokes = [];
    render();
    notify();
  }

  function replaceStrokes(strokes) {
    state.strokes = Array.isArray(strokes) ? structuredClone(strokes) : [];
    render();
    notify();
  }

  function getSnapshotState() {
    return {
      strokes: structuredClone(state.strokes),
      strokeCount: state.strokes.length,
      width: canvas.width,
      height: canvas.height
    };
  }

  function imageDataUrl() {
    return canvas.toDataURL("image/png");
  }

  canvas.addEventListener("pointerdown", begin);
  canvas.addEventListener("pointermove", move);
  canvas.addEventListener("pointerup", end);
  canvas.addEventListener("pointercancel", cancel);
  canvas.addEventListener("contextmenu", e => e.preventDefault());
  resize();

  return { setTool, setBrushSize, undo, clear, render, replaceStrokes, getSnapshotState, imageDataUrl };
}

function clamp(v, a, b) { return Math.min(b, Math.max(a, v)); }
function distance(a, b) {
  const dx = a.x - b.x, dy = a.y - b.y;
  return Math.sqrt(dx * dx + dy * dy);
}

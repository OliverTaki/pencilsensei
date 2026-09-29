import { createDrawingSurface } from "./drawing.js";
import { CoachEngine } from "./coach.js";
import { saveSession, listSessions } from "./db.js";
import { buildLearningPacket, downloadPacket } from "./packet.js";

const $ = id => document.getElementById(id);
const canvas = $("drawingCanvas");
const strokeCount = $("strokeCount");
const cueBubble = $("cueBubble");
const cueText = $("cueText");
const statusText = $("statusText");
const referenceImage = $("referenceImage");
const referenceEmpty = $("referenceEmpty");
const referenceTitle = $("referenceTitle");

let currentCue = null;
let saveTimer = null;
let referenceObjectUrl = null;

const session = {
  id: crypto.randomUUID(),
  startedAt: Date.now(),
  updatedAt: Date.now(),
  finishedAt: null,
  referenceName: null,
  referenceDataUrl: null,
  strokes: [],
  cueEvents: [],
  finalDrawingDataUrl: null
};

const coach = new CoachEngine(showCue);
const drawing = createDrawingSurface(canvas, snapshot => {
  session.strokes = snapshot.strokes;
  session.updatedAt = Date.now();
  strokeCount.textContent = String(snapshot.strokeCount);
  scheduleSave();
  if (snapshot.strokeCount && snapshot.strokeCount % 3 === 0) {
    coach.analyze(snapshot.strokes);
  }
});

function setTool(tool) {
  drawing.setTool(tool);
  const isPen = tool === "pen";
  $("penButton").classList.toggle("active", isPen);
  $("eraserButton").classList.toggle("active", !isPen);
  $("penButton").setAttribute("aria-pressed", String(isPen));
  $("eraserButton").setAttribute("aria-pressed", String(!isPen));
}

function showCue(cue) {
  currentCue = cue;
  cueText.textContent = cue.text;
  cueBubble.hidden = false;
  session.cueEvents.push({ type: "shown", ...cue });
  statusText.textContent = "最小cueだけ出しています。";
  scheduleSave();
}

function closeCue(outcome) {
  if (!currentCue) return;
  session.cueEvents.push({
    type: outcome,
    code: currentCue.code,
    level: currentCue.level,
    cueId: currentCue.id,
    at: Date.now()
  });
  currentCue = null;
  cueBubble.hidden = true;
  statusText.textContent = outcome === "fixed" ? "修正を記録。次はもっと少ないcueを目指します。" : "記録しました。";
  scheduleSave();
}

function scheduleSave() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(async () => {
    try {
      session.updatedAt = Date.now();
      await saveSession(structuredClone(session));
    } catch (err) {
      console.warn("autosave failed", err);
    }
  }, 700);
}

async function useReferenceFile(file) {
  if (!file || !file.type.startsWith("image/")) return;
  if (referenceObjectUrl) URL.revokeObjectURL(referenceObjectUrl);
  referenceObjectUrl = URL.createObjectURL(file);
  referenceImage.src = referenceObjectUrl;
  referenceImage.hidden = false;
  referenceEmpty.hidden = true;
  referenceTitle.textContent = file.name;
  session.referenceName = file.name;
  session.referenceDataUrl = await fileToResizedDataUrl(file, 1280);
  session.updatedAt = Date.now();
  scheduleSave();
}

function fileToResizedDataUrl(file, maxSide) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      const scale = Math.min(1, maxSide / Math.max(img.naturalWidth, img.naturalHeight));
      const c = document.createElement("canvas");
      c.width = Math.max(1, Math.round(img.naturalWidth * scale));
      c.height = Math.max(1, Math.round(img.naturalHeight * scale));
      c.getContext("2d").drawImage(img, 0, 0, c.width, c.height);
      URL.revokeObjectURL(url);
      resolve(c.toDataURL("image/jpeg", 0.88));
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error("画像を読めませんでした")); };
    img.src = url;
  });
}

async function finishSession() {
  session.finishedAt = Date.now();
  session.updatedAt = Date.now();
  session.finalDrawingDataUrl = drawing.imageDataUrl();
  await saveSession(structuredClone(session));
  downloadPacket(buildLearningPacket(session));
  statusText.textContent = "保存しました。Learning Packetを出力しました。";
}

async function refreshHistory() {
  const list = await listSessions(30);
  const root = $("historyList");
  root.innerHTML = "";
  if (!list.length) {
    root.textContent = "まだセッションがありません。";
    return;
  }
  for (const s of list) {
    const card = document.createElement("div");
    card.className = "history-card";
    const title = document.createElement("strong");
    title.textContent = s.referenceName || "Free draw";
    const meta = document.createElement("div");
    meta.className = "meta";
    meta.textContent = new Date(s.startedAt).toLocaleString() + " · " + ((s.strokes || []).length) + " strokes";
    const skills = document.createElement("div");
    skills.className = "skills";
    const counts = {};
    for (const e of s.cueEvents || []) if (e.type === "shown") counts[e.code] = (counts[e.code] || 0) + 1;
    Object.entries(counts).slice(0, 5).forEach(([k, n]) => {
      const chip = document.createElement("span");
      chip.className = "chip";
      chip.textContent = k.replaceAll("_", " ") + " ×" + n;
      skills.appendChild(chip);
    });
    card.append(title, meta, skills);
    root.appendChild(card);
  }
}

$("penButton").addEventListener("click", () => setTool("pen"));
$("eraserButton").addEventListener("click", () => setTool("eraser"));
$("undoButton").addEventListener("click", () => drawing.undo());
$("clearButton").addEventListener("click", () => {
  if (session.strokes.length && !confirm("このセッションの線を消しますか？")) return;
  drawing.clear();
  cueBubble.hidden = true;
  currentCue = null;
});
$("brushSize").addEventListener("input", e => drawing.setBrushSize(e.target.value));
$("checkButton").addEventListener("click", () => {
  const snapshot = drawing.getSnapshotState();
  const cue = coach.analyze(snapshot.strokes, { manual: true });
  if (!cue) showCue(coach.makeCue("pause_check", 0, { risk: "low", score: 1 }));
});
$("cueFixed").addEventListener("click", () => closeCue("fixed"));
$("cueWrong").addEventListener("click", () => closeCue("wrong"));
$("cueHint").addEventListener("click", () => {
  if (!currentCue) return;
  session.cueEvents.push({ type: "escalated", code: currentCue.code, level: currentCue.level, cueId: currentCue.id, at: Date.now() });
  coach.escalate();
});
$("referenceInput").addEventListener("change", e => useReferenceFile(e.target.files && e.target.files[0]));
$("finishButton").addEventListener("click", finishSession);
$("historyButton").addEventListener("click", async () => {
  await refreshHistory();
  $("historyDrawer").hidden = false;
});
$("closeHistory").addEventListener("click", () => $("historyDrawer").hidden = true);

const stage = $("referenceStage");
for (const name of ["dragenter", "dragover"]) {
  stage.addEventListener(name, e => { e.preventDefault(); stage.classList.add("dragging"); });
}
for (const name of ["dragleave", "drop"]) {
  stage.addEventListener(name, e => { e.preventDefault(); stage.classList.remove("dragging"); });
}
stage.addEventListener("drop", e => {
  const file = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0];
  useReferenceFile(file);
});

window.addEventListener("beforeunload", () => {
  session.updatedAt = Date.now();
});

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => navigator.serviceWorker.register("./sw.js").catch(console.warn));
}

setTool("pen");
scheduleSave();

export function buildLearningPacket(session) {
  const cueStats = {};
  for (const e of session.cueEvents || []) {
    const key = e.code || "unknown";
    cueStats[key] ||= { shown: 0, fixed: 0, wrong: 0, escalated: 0 };
    if (e.type === "shown") cueStats[key].shown++;
    if (e.type === "fixed") cueStats[key].fixed++;
    if (e.type === "wrong") cueStats[key].wrong++;
    if (e.type === "escalated") cueStats[key].escalated++;
  }

  return {
    schema: "pencilsensei.learning-packet.v1",
    session: {
      id: session.id,
      startedAt: session.startedAt,
      finishedAt: session.finishedAt || Date.now(),
      referenceName: session.referenceName || null,
      strokeCount: (session.strokes || []).length
    },
    learnerEvidence: {
      cueStats,
      cueEvents: session.cueEvents || [],
      strokes: session.strokes || [],
      finalDrawingDataUrl: session.finalDrawingDataUrl || null,
      referenceDataUrl: session.referenceDataUrl || null
    },
    coachingPrompt: [
      "Review this PencilSensei learning packet as a drawing teacher.",
      "Prioritize learning, not making the current image prettier.",
      "Identify recurring skill-level problems, distinguish observation/construction/motor/error-detection where possible,",
      "and propose the smallest next drawing task or cue that would improve transfer.",
      "Do not infer certainty that the evidence does not support."
    ].join(" ")
  };
}

export function downloadPacket(packet) {
  const blob = new Blob([JSON.stringify(packet, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  a.href = url;
  a.download = "pencilsensei-" + stamp + ".json";
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

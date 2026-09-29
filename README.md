# PencilSensei

PencilSensei is a lightweight drawing-practice coach built around one principle:

> **The software should help the human learn to see and correct, not draw the answer for them.**

It is designed for short, frequent practice. The app watches the drawing process, stays quiet most of the time, gives very small cues when useful, and records whether the learner could correct the problem.

## Working app

The first working vertical slice includes:

- side-by-side reference and drawing surfaces;
- stylus/pointer capture with normalized vector points;
- pressure / tilt / twist capture when the browser exposes them;
- pen, eraser, undo, clear, brush size;
- sparse process-aware micro-cues;
- cue escalation: minimal hint first, more detail only on request;
- learner response logging ("fixed", "need more", "wrong");
- IndexedDB local session history;
- downloadable **Learning Packet** JSON for ChatGPT or another coach;
- installable/offline PWA shell;
- GitHub Pages deployment workflow.

## Run locally

Because the app uses ES modules and a service worker, serve the repository over HTTP:

```bash
python3 -m http.server 8080
```

Then open:

```text
http://localhost:8080
```

## GitHub Pages

The repository contains a Pages workflow. Enable **Settings → Pages → Source: GitHub Actions** once, then pushes to `main` deploy automatically.

## What is intentionally not here

- image generation;
- auto-beautification;
- complex brush simulation;
- layers / filters / Photoshop-style features;
- a frontier VLM call on every stroke;
- fake precision about anatomy or style.

The next major engineering step is reliable **reference structure evidence** (face/body landmarks, global proportions, major axes) so micro-cues can move from process-only diagnosis to structural comparison.

See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).

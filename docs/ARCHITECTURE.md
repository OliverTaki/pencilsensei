# PencilSensei architecture

## Product rule

PencilSensei is not an AI image generator and not a general painting application.

Its job is to make ordinary drawing practice unusually information-dense:

1. let the human draw with minimal friction;
2. capture the process, not only the final raster;
3. intervene sparsely with the smallest useful cue;
4. record whether the learner could self-correct;
5. preserve evidence so a stronger external coach can select future tasks and review progress.

## Current vertical slice

The first working slice intentionally avoids a brush engine and model-heavy vision stack.

- **Reference**: local image import, resized copy stored in the local session.
- **Drawing**: Pointer Events, normalized vector points, pressure/tilt/twist when available.
- **Process evidence**: stroke order, duration, geometry, eraser/undo history.
- **Micro-coach**: conservative heuristic detection of local overworking, premature detail, and searching strokes.
- **Learning state evidence**: every cue records its level and whether it helped.
- **Storage**: IndexedDB, local-first.
- **Learning Packet**: portable JSON containing reference, final drawing, vector strokes, cue history, and a coaching prompt.
- **PWA**: static installable web app with offline cache.

## Target architecture

The long-term system should preserve this boundary:

### Fast local layer

- pointer/stylus capture
- vector geometry
- timing and redraw statistics
- low-risk cues
- learner event log

### Specialist perception layer

Add only when it gives reliable evidence:

- face / body landmarks
- silhouette and major-axis extraction
- perspective primitives
- partial-sketch grouping

### Reasoning layer

External models such as ChatGPT should receive compact typed evidence, not be asked to measure every stroke from screenshots. They can handle:

- task selection
- longitudinal review
- ambiguity
- causal hypotheses
- pedagogical wording
- weekly / multi-session synthesis

## Intervention principle

Continuous sensing does not imply continuous criticism.

Default action is **abstain**.

When intervention is justified, use the lowest-risk cue that can plausibly cause self-correction:

0. silent
1. notice
2. orient attention
3. specify comparison
4. structural hint
5. guide

The target learning trajectory is progressively less help on the same skill.

## Why Web/PWA first

- instant access;
- desktop/tablet support;
- Pointer Events expose pen pressure and tilt where supported;
- no application distribution overhead;
- static deployment;
- easy export into external coaching systems.

A future native iPad capture client can share the same normalized stroke/session schema if PencilKit fidelity becomes necessary.

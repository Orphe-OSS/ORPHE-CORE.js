# ICC2022Sep

A pose + ORPHE CORE demo originally built for an event in September 2022. It combines MediaPipe Pose (camera-based body landmarks) with ORPHE CORE foot data, with a simple coin/effects layer driven by walking and jumping.

This was previously a hybrid Electron + Web app; the Electron entry points (main.js / preload.js / package.json) were removed in PR #35 so the directory now runs purely in the browser.

- MediaPipe Pose: <https://google.github.io/mediapipe/solutions/pose.html>
- For a smaller pure-pose example, see [`examples/POSE/`](../POSE/).

## Status

`needs-review` — see [`docs/examples-catalog.md`](../../docs/examples-catalog.md) for context. The directory ships large vendored dependencies (p5.js / control_utils_3d.js / MediaPipe assets); treat it as an exhibition-style demo rather than a beginner-friendly sample.

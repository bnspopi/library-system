# Plates from the Gallery — decision log

Append-only. One entry per consequential choice.

## 1. Source
- **Chose:** `github.com/freestylefly/awesome-gpt-image-2` at `0dc09c46c8a3`, shallow clone.
- **Found:** 600 image files, 541 catalogued in `data/cases.json` with title, category, style, scene, prompt and the author of each.
- **Cost:** free. Nothing generated, nothing uploaded.

## 2. Pipeline
- **Chose:** `cinematic`.
- **Why:** the ask was stills into motion, not a narrated explainer and not real footage. Cinematic gives held shots, a single grade, and cuts that dissolve rather than snap.
- **Rejected:** `documentary-montage` (wants real footage), `animated-explainer` (wants a script to explain something).

## 3. Assets
- **Chose:** no generation at any stage.
- **Why:** every image generator connected to this session is locked — Pika at 0 credits, Higgsfield gated behind Basic, ElevenLabs missing the image scope, Runway with 6 credits against a 4-credit floor. The gallery is the asset library, which is what the request was for.
- **Human gate:** skipped by standing instruction to proceed on reversible work; the shot list below is the artifact to argue with.

## 4. Shot selection
- **Chose:** 6 of 541, by hand, after looking at each one.
- **Why these:** the site they belong beside is near-black with one gold. Bright pastel plates (`case408`, `case242`) were rejected on tone, however good they are. The six kept are dark scenes or parchment plates.
- **Credit:** each plate names its author on screen, and the tail card repeats the repository.

## 5. Two plate styles
- **Chose:** `fill` for scenes, `plate` for posters.
- **Why:** a 2160x3840 poster cropped to 2.35:1 loses the thing it is about. `case537` cropped centre showed only smoke until `focusY` was moved to 0.80. `case415` and `case396` are encyclopedia sheets meant to be read, so they are hung whole beside their caption instead.

## 6. Renderer
- **Chose:** Remotion 4, headless_shell, then ffmpeg for the delivery encode.
- **Why:** already proven in this repo by `tools/bookfilm`, and it shares the same `theme.ts`, so the montage matches the library's grade without a second palette.
- **Format:** 1920x818 (2.35:1), 30 fps, 624 frames, 20.8 s.

## 7. Verification
- Sampled 8 frames across the film and read them.
- Built a one-frame-per-second contact strip: no black frames, no gaps.
- Fixed from that pass: the crop on plate 01, the poster overflow on plates 04 and 06, the exposed edge and unreadable caption on plate 05.

## 8. Delivery
- **Chose:** a standalone file, not wired into the tour.
- **Why:** the request was to make the images move, not to change the site. The clip is 2.35:1 and 20.8 s; the tour's clips are 2.23:1 and 8 s, so dropping it in would mean a re-cut, not a copy.

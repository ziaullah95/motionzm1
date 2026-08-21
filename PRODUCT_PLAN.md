# MotionAM Product Plan

## Direction

MotionAM should become a structured motion graphics editor, not only an AI HTML generator.

The commercial path is:

Prompt -> editable scene JSON -> frame-based canvas engine -> timeline editing -> MP4 export.

This keeps generated work editable and reduces black-screen failures from random AI code.

## What Is Built Now

- Existing HTML Code mode is still available.
- New Scene Engine mode is the default project direction.
- Scene Engine stores animations as JSON with objects and keyframes.
- The renderer supports:
  - text layers
  - shape layers
  - line layers
  - grid backgrounds
  - image placeholders
  - bar chart layers
  - opacity, position, scale, rotation, progress, and font-size keyframes
  - easing: linear, easeInCubic, easeOutCubic, easeInOutCubic, easeOutBack
- AI prompts now ask for structured scene JSON when Scene Engine mode is selected.
- Scene repair and edit prompts now preserve and update scene JSON.
- If AI is switched off, Generate creates a starter editable Scene Engine template.
- Existing preview, timeline, zoom, project save/load, and recording paths can use Scene Engine scenes.

## What Was Being Built When The Limit Was Reached

The previous work stopped while wiring the first version of the Scene Engine into the existing app.

At that moment:

- The Engine dropdown had just been added.
- The JSON schema prompt had been started.
- The canvas renderer was being inserted into `app.js`.
- Preview validation still needed to be connected to JSON scenes.
- Generate/Edit still needed finishing for Scene Engine mode.
- Browser verification had not yet been completed.

That work has now been continued and finished for the first MVP pass.

## Next Commercial Milestones

1. Layer panel
   Show every text, shape, image, chart, and line object as editable rows.

2. Property inspector
   Edit text, color, position, size, font, chart values, image source, and timing without touching JSON.

3. Timeline keyframe editor
   Add visible keyframe diamonds, drag timing, and choose easing from a menu.

4. Template library
   Build reusable templates for title intro, lower third, chart explainers, product reveals, map explainers, and comparison videos.

5. Asset replacement
   Let users replace image placeholders with uploaded images and logos.

6. Map engine
   Add offline GeoJSON maps first, then optional Google/Map tiles mode later.

7. Reliable render queue
   Move final MP4 export toward a frame-render pipeline with FFmpeg/WebCodecs.

8. Launch features
   Add accounts, saved projects, payments, export limits, brand kits, and template packs.

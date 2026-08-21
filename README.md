# MotionAM

MotionAM is a local motion graphics generator. It turns a prompt into self-contained HTML, CSS, and JavaScript, previews the animation, and records it as MP4 or WebM video.

MotionAM now has two engine modes:

- `Scene Engine`: the commercial direction. AI generates editable scene JSON, and MotionAM renders it frame-by-frame on canvas.
- `HTML Code`: the older mode. AI generates full HTML, CSS, and JavaScript directly.

Use `Scene Engine` for more reliable previews, timeline scrubbing, and future editing controls.

## Start

Use the bundled Node runtime if regular Node is not installed:

```powershell
& 'C:\Users\786\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe' .\server.mjs
```

Then open:

```text
http://127.0.0.1:4173
```

## AI Provider

MotionAM defaults to local Ollama:

```text
http://127.0.0.1:11434/api/chat
```

The detected local model is:

```text
llama3.2:3b
```

No API key is needed for Ollama. Enable AI, then generate.

### OpenRouter

OpenRouter is an OpenAI-compatible provider. Select OpenRouter API in the provider dropdown, then paste your key into the app's API key field.

```text
https://openrouter.ai/api/v1/chat/completions
```

The default model is:

```text
openrouter/auto
```

You can replace it with any OpenRouter model slug later, for example a Google, DeepSeek, Anthropic, or OpenAI model from your OpenRouter account.

### Gemini

Gemini is the recommended free online provider for MotionAM. Create a key in Google AI Studio, then select Gemini API in the provider dropdown.

```text
https://generativelanguage.googleapis.com/v1beta/openai/chat/completions
```

The default model is:

```text
gemini-3.5-flash
```

Do not paste API keys into chat. Paste the Gemini key directly into the app's API key field.

### DeepSeek

The provider form is OpenAI-compatible. It is prefilled for DeepSeek chat completions:

```text
https://api.deepseek.com/chat/completions
```

The default model is:

```text
deepseek-v4-flash
```

Switch the provider to DeepSeek, add your API key, then enable AI before generating. The browser sends provider requests through the local server at `/api/generate` so keys are not written to project files.

If the provider returns invalid code, MotionAM makes one AI repair attempt. If the repair also fails, it shows the error and restores the previous preview instead of generating a local fallback.

## Recording

Use Render to choose the working scene size, such as 16:9 1080p or 9:16 1080p. Use Record Box to choose the exported video frame; if it differs from the render size, MotionAM records a cropped canvas copy in that output ratio.

Use Format to choose MP4 for Premiere or WebM. MotionAM first asks the browser for MP4 recording support. If the browser only records WebM, the local server can convert the recording to MP4 with FFmpeg.

Generated canvas scenes record directly. If a scene uses pure DOM or CSS animation without a canvas, the app falls back to browser screen capture.

Premiere Pro usually does not import WebM. Choose `MP4 for Premiere`. If the app says FFmpeg is needed, install FFmpeg and restart MotionAM. On Windows, one simple install option is:

```powershell
winget install Gyan.FFmpeg
```

## Editing

After a scene is generated, use Edit Scene to ask the AI for changes to the current motion graphic. The edited result is preview-validated before it replaces the current scene.

In Scene Engine mode, the Code tab shows editable JSON instead of HTML. This JSON contains objects, text, shapes, chart values, images, and keyframes.

## Preview

The preview toolbar includes zoom out, fit, and zoom in controls. Zoom only changes the workspace view; Render and Record Box control the actual generation and export frame sizes.

The timeline under the toolbar can play, pause, and scrub through the preview. Newly generated scenes are instructed to support timeline scrubbing with `window.__MOTIONAM_RENDER`.

## Project Safety

Use the undo button in the top bar to restore the previous scene if a generation or edit goes wrong.

Save Project now downloads a project file and also stores the project in Recent Projects in this browser. Use the Recent Projects dropdown in the top bar to reopen recent local saves quickly.

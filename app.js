"use strict";

if (window.location.protocol === "file:") {
  window.location.replace("http://127.0.0.1:4173/");
}

const els = {
  statusText: document.querySelector("#statusText"),
  promptInput: document.querySelector("#promptInput"),
  editInput: document.querySelector("#editInput"),
  engineModeSelect: document.querySelector("#engineModeSelect"),
  durationInput: document.querySelector("#durationInput"),
  sizeSelect: document.querySelector("#sizeSelect"),
  recordSizeSelect: document.querySelector("#recordSizeSelect"),
  exportFormatSelect: document.querySelector("#exportFormatSelect"),
  styleSelect: document.querySelector("#styleSelect"),
  modelInput: document.querySelector("#modelInput"),
  providerSelect: document.querySelector("#providerSelect"),
  endpointInput: document.querySelector("#endpointInput"),
  apiKeyInput: document.querySelector("#apiKeyInput"),
  useAiToggle: document.querySelector("#useAiToggle"),
  generateButton: document.querySelector("#generateButton"),
  editButton: document.querySelector("#editButton"),
  exampleButton: document.querySelector("#exampleButton"),
  runButton: document.querySelector("#runButton"),
  zoomOutButton: document.querySelector("#zoomOutButton"),
  fitZoomButton: document.querySelector("#fitZoomButton"),
  zoomInButton: document.querySelector("#zoomInButton"),
  zoomLabel: document.querySelector("#zoomLabel"),
  timelinePlayButton: document.querySelector("#timelinePlayButton"),
  timelineSlider: document.querySelector("#timelineSlider"),
  timelineTime: document.querySelector("#timelineTime"),
  recordButton: document.querySelector("#recordButton"),
  stopButton: document.querySelector("#stopButton"),
  downloadLink: document.querySelector("#downloadLink"),
  stageArea: document.querySelector("#stageArea"),
  previewShell: document.querySelector("#previewShell"),
  previewFrame: document.querySelector("#previewFrame"),
  codeEditor: document.querySelector("#codeEditor"),
  previewTab: document.querySelector("#previewTab"),
  codeTab: document.querySelector("#codeTab"),
  undoButton: document.querySelector("#undoButton"),
  newProjectButton: document.querySelector("#newProjectButton"),
  saveProjectButton: document.querySelector("#saveProjectButton"),
  loadProjectButton: document.querySelector("#loadProjectButton"),
  recentProjectSelect: document.querySelector("#recentProjectSelect"),
  projectFileInput: document.querySelector("#projectFileInput"),
  toast: document.querySelector("#toast")
};

const examples = [
  "Create a luxury fragrance reveal with a glass bottle silhouette, liquid shimmer, serif title text, and a final packshot frame. Use black, ivory, emerald, and gold.",
  "Create a fast sports lower-third animation for a football highlights video. Include a name reveal, stat counters, motion streaks, and a punchy end frame.",
  "Create a 12 second explainer opener about AI automation. Use clean data nodes, code fragments, charts, and a clear final title: Automate The Busywork.",
  "Create a cinematic YouTube intro for a travel documentary. Use map lines, warm sunrise colors, film grain, and the title Across The Horizon."
];

const STORAGE_KEY = "motionam-project";
const SETTINGS_KEY = "motionam-settings";
const RECENT_PROJECTS_KEY = "motionam-recent-projects";
const API_KEYS_SESSION_KEY = "motionam-api-keys-session";
const PROVIDERS = {
  ollama: {
    endpoint: "http://127.0.0.1:11434/api/chat",
    model: "llama3.2:3b",
    apiKeyPlaceholder: "Not needed for Ollama"
  },
  openrouter: {
    endpoint: "https://openrouter.ai/api/v1/chat/completions",
    model: "openrouter/auto",
    apiKeyPlaceholder: "Paste OpenRouter API key for this session"
  },
  gemini: {
    endpoint: "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions",
    model: "gemini-3.5-flash",
    apiKeyPlaceholder: "Paste Gemini API key for this session"
  },
  deepseek: {
    endpoint: "https://api.deepseek.com/chat/completions",
    model: "deepseek-v4-flash",
    apiKeyPlaceholder: "Paste key for this session"
  }
};
const DEFAULT_PROVIDER = "ollama";
const LOCAL_APP_ORIGIN = "http://127.0.0.1:4173";
const EMPTY_SCENE_MARKER = "data-motionam-empty";
const MP4_MIME_TYPES = [
  "video/mp4;codecs=avc1.42E01E",
  "video/mp4;codecs=avc1.4D401E",
  "video/mp4;codecs=avc1.640028",
  "video/mp4;codecs=h264",
  "video/mp4"
];
const WEBM_MIME_TYPES = [
  "video/webm;codecs=vp9",
  "video/webm;codecs=vp8",
  "video/webm"
];

let mediaRecorder = null;
let mediaChunks = [];
let activeStream = null;
let recordTimer = null;
let lastVideoUrl = "";
let previewScale = 1;
let previewFit = true;
let recordCanvas = null;
let recordFrameId = 0;
let timelineFrameId = 0;
let timelinePlaying = false;
let timelineStartTime = 0;
let timelineCurrentMs = 0;
let undoStack = [];

function normalizeProvider(provider) {
  return PROVIDERS[provider] ? provider : DEFAULT_PROVIDER;
}

function appApiUrl(path) {
  if (window.location.protocol === "file:") {
    return `${LOCAL_APP_ORIGIN}${path}`;
  }
  return path;
}

function normalizeEndpoint(endpoint, provider = els.providerSelect?.value) {
  const providerId = normalizeProvider(provider);
  const value = String(endpoint || "").trim();
  if (
    !value ||
    value === "https://api.deepseek.com/v1/chat/completions" ||
    value === "https://generativelanguage.googleapis.com/v1beta/openai/" ||
    value === "https://openrouter.ai/api/v1/"
  ) {
    return PROVIDERS[providerId].endpoint;
  }
  if (providerId === "ollama" && /api\.deepseek\.com|generativelanguage\.googleapis\.com|openrouter\.ai/i.test(value)) {
    return PROVIDERS.ollama.endpoint;
  }
  if (providerId !== "ollama" && /127\.0\.0\.1|localhost|11434/i.test(value)) {
    return PROVIDERS[providerId].endpoint;
  }
  if (providerId === "openrouter" && /openrouter\.ai/i.test(value)) {
    return PROVIDERS.openrouter.endpoint;
  }
  if (providerId !== "openrouter" && /openrouter\.ai/i.test(value)) {
    return PROVIDERS[providerId].endpoint;
  }
  if (providerId === "gemini" && /generativelanguage\.googleapis/i.test(value)) {
    return PROVIDERS.gemini.endpoint;
  }
  if (providerId === "deepseek" && /generativelanguage\.googleapis\.com/i.test(value)) {
    return PROVIDERS.deepseek.endpoint;
  }
  if (providerId === "gemini" && /api\.deepseek\.com/i.test(value)) {
    return PROVIDERS.gemini.endpoint;
  }
  return value;
}

function normalizeModel(model, provider = els.providerSelect?.value) {
  const providerId = normalizeProvider(provider);
  const value = String(model || "").trim();
  if (
    !value ||
    value === "deepseek-v4" ||
    (providerId === "ollama" && /^(deepseek-|gemini-|openrouter\/)/i.test(value))
  ) {
    return PROVIDERS[providerId].model;
  }
  if (providerId !== "ollama" && /^llama/i.test(value)) {
    return PROVIDERS[providerId].model;
  }
  if (providerId === "deepseek" && /^gemini-/i.test(value)) {
    return PROVIDERS.deepseek.model;
  }
  if (providerId === "gemini" && /^deepseek-/i.test(value)) {
    return PROVIDERS.gemini.model;
  }
  return value;
}

function readSessionApiKeys() {
  try {
    const keys = JSON.parse(sessionStorage.getItem(API_KEYS_SESSION_KEY) || "{}");
    return keys && typeof keys === "object" ? keys : {};
  } catch {
    sessionStorage.removeItem(API_KEYS_SESSION_KEY);
    return {};
  }
}

function sessionApiKeyFor(provider) {
  return String(readSessionApiKeys()[normalizeProvider(provider)] || "");
}

function setSessionApiKey(provider, apiKey) {
  const providerId = normalizeProvider(provider);
  if (providerId === "ollama") return;
  const keys = readSessionApiKeys();
  const value = String(apiKey || "").trim();
  if (value) {
    keys[providerId] = value;
  } else {
    delete keys[providerId];
  }
  sessionStorage.setItem(API_KEYS_SESSION_KEY, JSON.stringify(keys));
}

function setStatus(message) {
  els.statusText.textContent = message;
}

function hideToast() {
  window.clearTimeout(showToast.timer);
  els.toast.classList.remove("visible", "error");
}

function showToast(message, options = {}) {
  const persistent = Boolean(options.persistent);
  const tone = options.tone || "info";
  els.toast.replaceChildren();

  const messageEl = document.createElement("div");
  messageEl.className = "toast-message";
  messageEl.textContent = message;
  els.toast.appendChild(messageEl);

  const closeButton = document.createElement("button");
  closeButton.className = "toast-close";
  closeButton.type = "button";
  closeButton.title = "Close";
  closeButton.setAttribute("aria-label", "Close message");
  closeButton.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18" /></svg>';
  closeButton.addEventListener("click", hideToast);
  els.toast.appendChild(closeButton);

  els.toast.classList.toggle("error", tone === "error");
  els.toast.classList.add("visible");
  window.clearTimeout(showToast.timer);
  if (!persistent) {
    showToast.timer = window.setTimeout(hideToast, 3200);
  }
}

function parseSize() {
  const [width, height] = els.sizeSelect.value.split("x").map(Number);
  return { width, height };
}

function sizeFromPromptHint(prompt) {
  const value = String(prompt || "").toLowerCase();
  if (/3840\s*x\s*2160/.test(value)) return "3840x2160";
  if (/2160\s*x\s*3840/.test(value)) return "2160x3840";
  if (/1920\s*x\s*1080/.test(value)) return "1920x1080";
  if (/1080\s*x\s*1920/.test(value)) return "1080x1920";
  if (/1280\s*x\s*720/.test(value)) return "1280x720";
  if (/720\s*x\s*1280/.test(value)) return "720x1280";
  if (/1080\s*x\s*1350/.test(value)) return "1080x1350";
  if (/1080\s*x\s*1080/.test(value)) return "1080x1080";
  if (/aspect\s*ratio\s*:\s*16\s*:\s*9/.test(value)) return "1920x1080";
  if (/aspect\s*ratio\s*:\s*9\s*:\s*16/.test(value)) return "1080x1920";
  if (/aspect\s*ratio\s*:\s*4\s*:\s*5/.test(value)) return "1080x1350";
  if (/aspect\s*ratio\s*:\s*1\s*:\s*1/.test(value)) return "1080x1080";
  return "";
}

function syncRenderSizeFromPrompt() {
  const hintedSize = sizeFromPromptHint(els.promptInput.value);
  if (!hintedSize || els.sizeSelect.value === hintedSize) return;
  els.sizeSelect.value = hintedSize;
  fitPreviewZoom();
  persistSettings();
}

function parseRecordSize() {
  const value = els.recordSizeSelect?.value || "render";
  if (value === "render") {
    return parseSize();
  }
  const [width, height] = value.split("x").map(Number);
  if (!width || !height) {
    return parseSize();
  }
  return { width, height };
}

function getExportFormat() {
  return els.exportFormatSelect?.value === "webm" ? "webm" : "mp4";
}

function getEngineMode() {
  return els.engineModeSelect?.value === "html" ? "html" : "scene";
}

function timelineDurationMs() {
  return Math.max(1, Number(els.durationInput.value || 10)) * 1000;
}

function clampTimelineMs(timeMs) {
  return Math.max(0, Math.min(timelineDurationMs(), Number(timeMs) || 0));
}

function formatTimelineTime(timeMs) {
  const seconds = Math.max(0, Number(timeMs) || 0) / 1000;
  const minutes = Math.floor(seconds / 60);
  const rest = Math.floor(seconds % 60);
  return `${minutes}:${String(rest).padStart(2, "0")}`;
}

function setTimelineButtonIcon() {
  if (!els.timelinePlayButton) return;
  els.timelinePlayButton.title = timelinePlaying ? "Pause timeline" : "Play timeline";
  els.timelinePlayButton.setAttribute("aria-label", timelinePlaying ? "Pause timeline" : "Play timeline");
  els.timelinePlayButton.innerHTML = timelinePlaying
    ? '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5h3v14H8zM13 5h3v14h-3z" /></svg>'
    : '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m8 5 11 7-11 7V5Z" /></svg>';
}

function updateTimelineControls(timeMs = timelineCurrentMs) {
  const duration = timelineDurationMs();
  timelineCurrentMs = clampTimelineMs(timeMs);
  if (els.timelineSlider) {
    els.timelineSlider.max = String(duration / 1000);
    els.timelineSlider.value = String(timelineCurrentMs / 1000);
  }
  if (els.timelineTime) {
    els.timelineTime.textContent = `${formatTimelineTime(timelineCurrentMs)} / ${formatTimelineTime(duration)}`;
  }
  setTimelineButtonIcon();
}

function sendTimelineTime(timeMs = timelineCurrentMs, paused = !timelinePlaying) {
  try {
    els.previewFrame.contentWindow?.postMessage({
      type: "MOTIONAM_SET_TIME",
      timeMs: clampTimelineMs(timeMs),
      paused
    }, "*");
  } catch {
    // The iframe may still be loading.
  }
}

function setTimelineTime(timeMs, options = {}) {
  const paused = "paused" in options ? Boolean(options.paused) : !timelinePlaying;
  const send = options.send !== false;
  updateTimelineControls(timeMs);
  if (send) {
    sendTimelineTime(timelineCurrentMs, paused);
  }
}

function stopTimelinePlayback(options = {}) {
  const send = options.send !== false;
  if (timelineFrameId) {
    cancelAnimationFrame(timelineFrameId);
    timelineFrameId = 0;
  }
  timelinePlaying = false;
  setTimelineButtonIcon();
  if (send) {
    sendTimelineTime(timelineCurrentMs, true);
  }
}

function timelineTick() {
  if (!timelinePlaying) return;
  const duration = timelineDurationMs();
  const nextTime = clampTimelineMs(performance.now() - timelineStartTime);
  setTimelineTime(nextTime, { paused: false });
  if (nextTime >= duration) {
    stopTimelinePlayback({ send: true });
    setStatus("Preview paused");
    return;
  }
  timelineFrameId = requestAnimationFrame(timelineTick);
}

function playTimeline() {
  if (isEmptySceneCode(els.codeEditor.value)) {
    showToast("Generate a scene before playing the timeline.", { persistent: true, tone: "error" });
    return;
  }
  showPreview();
  if (timelineCurrentMs >= timelineDurationMs() - 30) {
    setTimelineTime(0, { paused: true });
  }
  timelinePlaying = true;
  timelineStartTime = performance.now() - timelineCurrentMs;
  setTimelineButtonIcon();
  sendTimelineTime(timelineCurrentMs, false);
  timelineFrameId = requestAnimationFrame(timelineTick);
  setStatus("Preview playing");
}

function toggleTimelinePlayback() {
  if (timelinePlaying) {
    stopTimelinePlayback({ send: true });
    setStatus("Preview paused");
    return;
  }
  playTimeline();
}

function fitScaleForStage() {
  const { width, height } = parseSize();
  const rect = els.stageArea.getBoundingClientRect();
  const availableWidth = Math.max(240, rect.width - 36);
  const availableHeight = Math.max(180, rect.height - 36);
  return Math.max(0.08, Math.min(1, availableWidth / width, availableHeight / height));
}

function currentPreviewScale() {
  return previewFit ? fitScaleForStage() : previewScale;
}

function updatePreviewView() {
  const { width, height } = parseSize();
  const scale = Math.max(0.08, Math.min(2, currentPreviewScale()));
  els.previewShell.style.width = `${Math.round(width * scale)}px`;
  els.previewShell.style.height = `${Math.round(height * scale)}px`;
  els.previewShell.style.aspectRatio = `${width} / ${height}`;
  els.zoomLabel.textContent = previewFit ? `Fit ${Math.round(scale * 100)}%` : `${Math.round(scale * 100)}%`;
}

function setPreviewZoom(scale) {
  previewFit = false;
  previewScale = Math.max(0.08, Math.min(2, scale));
  updatePreviewView();
}

function fitPreviewZoom() {
  previewFit = true;
  updatePreviewView();
}

function getProjectState() {
  return {
    prompt: els.promptInput.value,
    engineMode: getEngineMode(),
    duration: Number(els.durationInput.value || 10),
    size: els.sizeSelect.value,
    recordSize: els.recordSizeSelect.value,
    exportFormat: getExportFormat(),
    style: els.styleSelect.value,
    provider: normalizeProvider(els.providerSelect.value),
    model: els.modelInput.value.trim(),
    endpoint: els.endpointInput.value.trim(),
    useAi: els.useAiToggle.checked,
    code: els.codeEditor.value
  };
}

function applyProjectState(state) {
  if (!state || typeof state !== "object") return;
  els.promptInput.value = state.prompt || els.promptInput.value;
  if (els.engineModeSelect) {
    els.engineModeSelect.value = state.engineMode === "html" ? "html" : "scene";
  }
  els.durationInput.value = state.duration || 10;
  els.sizeSelect.value = state.size || "1920x1080";
  els.recordSizeSelect.value = state.recordSize || "render";
  if (!els.recordSizeSelect.value) {
    els.recordSizeSelect.value = "render";
  }
  els.exportFormatSelect.value = state.exportFormat === "webm" ? "webm" : "mp4";
  els.styleSelect.value = state.style || "kinetic";
  els.providerSelect.value = normalizeProvider(state.provider);
  els.modelInput.value = normalizeModel(state.model, els.providerSelect.value);
  els.endpointInput.value = normalizeEndpoint(state.endpoint, els.providerSelect.value);
  applyProviderUi();
  if ("useAi" in state) {
    els.useAiToggle.checked = Boolean(state.useAi);
  }
  if (state.code) {
    els.codeEditor.value = state.code;
  }
}

function updateUndoButton() {
  if (els.undoButton) {
    els.undoButton.disabled = undoStack.length === 0;
  }
}

function pushUndoSnapshot(reason = "Scene change") {
  const state = getProjectState();
  const last = undoStack[undoStack.length - 1];
  if (last && last.code === state.code && last.prompt === state.prompt) {
    return;
  }
  undoStack.push({
    ...state,
    undoReason: reason,
    undoSavedAt: Date.now()
  });
  undoStack = undoStack.slice(-30);
  updateUndoButton();
}

async function undoLastChange() {
  const previous = undoStack.pop();
  updateUndoButton();
  if (!previous) {
    showToast("Nothing to undo.");
    return;
  }
  applyProjectState(previous);
  await runPreview({ autoplay: false });
  showPreview();
  persistSettings();
  setStatus("Undo restored");
  showToast("Previous scene restored.");
}

function readRecentProjects() {
  try {
    const projects = JSON.parse(localStorage.getItem(RECENT_PROJECTS_KEY) || "[]");
    return Array.isArray(projects) ? projects.filter((project) => project?.id && project?.state) : [];
  } catch {
    localStorage.removeItem(RECENT_PROJECTS_KEY);
    return [];
  }
}

function writeRecentProjects(projects) {
  localStorage.setItem(RECENT_PROJECTS_KEY, JSON.stringify(projects.slice(0, 12)));
  renderRecentProjects();
}

function projectTitleFromState(state) {
  const promptTitle = String(state.prompt || "").split(/[.?!\n]/)[0].trim();
  if (promptTitle) return promptTitle.slice(0, 54);
  try {
    if (state.code && isSceneJson(state.code)) {
      return String(parseSceneText(state.code).title || "MotionAM Project").slice(0, 54);
    }
  } catch {
    // Fall back to a generic title.
  }
  return "MotionAM Project";
}

function saveRecentProject(state = getProjectState()) {
  const projects = readRecentProjects();
  const now = Date.now();
  const title = projectTitleFromState(state);
  const project = {
    id: `project-${now}`,
    title,
    savedAt: now,
    state
  };
  writeRecentProjects([project, ...projects].slice(0, 12));
  return project;
}

function renderRecentProjects() {
  if (!els.recentProjectSelect) return;
  const projects = readRecentProjects();
  els.recentProjectSelect.replaceChildren();
  const placeholder = document.createElement("option");
  placeholder.value = "";
  placeholder.textContent = projects.length ? "Recent projects" : "No recent projects";
  els.recentProjectSelect.appendChild(placeholder);
  projects.forEach((project) => {
    const option = document.createElement("option");
    option.value = project.id;
    const date = new Date(project.savedAt || Date.now()).toLocaleDateString();
    option.textContent = `${project.title || "MotionAM Project"} - ${date}`;
    els.recentProjectSelect.appendChild(option);
  });
  els.recentProjectSelect.value = "";
}

async function loadRecentProject(projectId) {
  const project = readRecentProjects().find((item) => item.id === projectId);
  if (!project) return;
  pushUndoSnapshot("Load recent project");
  applyProjectState(project.state);
  await runPreview({ autoplay: false });
  showPreview();
  persistSettings();
  setStatus("Recent project loaded");
  showToast("Recent project loaded.");
  if (els.recentProjectSelect) {
    els.recentProjectSelect.value = "";
  }
}

function persistSettings() {
  const settings = getProjectState();
  delete settings.code;
  delete settings.prompt;
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
}

function loadSettings() {
  try {
    const settings = JSON.parse(localStorage.getItem(SETTINGS_KEY) || "{}");
    applyProjectState(settings);
  } catch {
    localStorage.removeItem(SETTINGS_KEY);
  }
}

function htmlFromAiText(text) {
  const raw = String(text || "").trim();
  const fenced = raw.match(/```(?:html)?\s*([\s\S]*?)```/i);
  let cleaned = (fenced ? fenced[1] : raw).trim();

  const htmlStart = cleaned.search(/<!doctype html|<html[\s>]/i);
  const htmlEnd = cleaned.toLowerCase().lastIndexOf("</html>");
  if (htmlStart >= 0) {
    cleaned = cleaned.slice(htmlStart, htmlEnd >= 0 ? htmlEnd + 7 : undefined).trim();
  }

  if (/<!doctype html/i.test(cleaned) || /<html[\s>]/i.test(cleaned)) {
    return cleaned;
  }

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>MotionAM Scene</title>
<style>
html, body { margin: 0; width: 100%; height: 100%; overflow: hidden; background: #050607; }
</style>
</head>
<body>
${cleaned}
</body>
</html>`;
}

function prepareAiHtml(code) {
  try {
    const parser = new DOMParser();
    const doc = parser.parseFromString(code, "text/html");
    const body = doc.body || doc.documentElement.appendChild(doc.createElement("body"));
    const { width, height } = parseSize();
    const scripts = Array.from(doc.querySelectorAll("script"));
    const scriptText = scripts.map((script) => script.textContent || "").join("\n");
    const expectsStageContainer =
      (/getElementById\(\s*["']stage["']\s*\)/.test(scriptText) || /querySelector\(\s*["']#stage["']\s*\)/.test(scriptText)) &&
      (/\.querySelector\(\s*["']canvas["']\s*\)/.test(scriptText) || /querySelector\(\s*["']#stage\s+canvas["']\s*\)/.test(scriptText));
    const expectsStageCanvas =
      !expectsStageContainer &&
      /\.getContext\s*\(/.test(scriptText) &&
      (/getElementById\(\s*["']stage["']\s*\)/.test(scriptText) || /querySelector\(\s*["']#stage["']\s*\)/.test(scriptText));

    let stage = doc.getElementById("stage");
    if (expectsStageContainer) {
      if (!stage || stage.tagName?.toLowerCase() === "canvas") {
        const wrapper = doc.createElement("div");
        wrapper.id = "stage";
        if (stage) {
          Array.from(stage.attributes).forEach((attribute) => {
            if (attribute.name !== "width" && attribute.name !== "height") {
              wrapper.setAttribute(attribute.name, attribute.value);
            }
          });
          wrapper.id = "stage";
          stage.replaceWith(wrapper);
        } else {
          body.prepend(wrapper);
        }
        stage = wrapper;
      }

      let childCanvas = stage.querySelector("canvas");
      if (!childCanvas) {
        childCanvas = doc.createElement("canvas");
        stage.appendChild(childCanvas);
      }
      childCanvas.setAttribute("width", String(width));
      childCanvas.setAttribute("height", String(height));
      const childStyle = childCanvas.getAttribute("style") || "";
      if (!/width\s*:/.test(childStyle) || !/height\s*:/.test(childStyle)) {
        childCanvas.setAttribute("style", `${childStyle};display:block;width:100%;height:100%;`.replace(/^;/, ""));
      }
    }

    if (expectsStageCanvas && stage?.tagName?.toLowerCase() !== "canvas") {
      const canvas = doc.createElement("canvas");
      canvas.id = "stage";
      if (stage) {
        Array.from(stage.attributes).forEach((attribute) => {
          canvas.setAttribute(attribute.name, attribute.value);
        });
        canvas.id = "stage";
        stage.replaceWith(canvas);
      } else {
        body.prepend(canvas);
      }
      stage = canvas;
    }

    const stageCanvas = doc.querySelector("canvas#stage");
    if (stageCanvas) {
      stageCanvas.setAttribute("width", String(width));
      stageCanvas.setAttribute("height", String(height));
      const currentStyle = stageCanvas.getAttribute("style") || "";
      if (!/width\s*:/.test(currentStyle) || !/height\s*:/.test(currentStyle)) {
        stageCanvas.setAttribute("style", `${currentStyle};display:block;width:100%;height:100%;`.replace(/^;/, ""));
      }
    }

    scripts.forEach((script) => {
      script.remove();
      body.appendChild(script);
    });

    return `<!doctype html>\n${doc.documentElement.outerHTML}`;
  } catch {
    return code;
  }
}

function extractJsonObjectText(text) {
  const raw = String(text || "").trim();
  const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const source = (fenced ? fenced[1] : raw).trim();
  const start = source.indexOf("{");
  const end = source.lastIndexOf("}");
  if (start < 0 || end <= start) {
    throw new Error("The AI response did not include scene JSON.");
  }
  return source.slice(start, end + 1);
}

function parseSceneText(text) {
  const data = JSON.parse(extractJsonObjectText(text));
  if (!data || typeof data !== "object" || Array.isArray(data)) {
    throw new Error("Scene JSON must be an object.");
  }
  return data;
}

function isSceneJson(code) {
  try {
    const scene = parseSceneText(code);
    return Array.isArray(scene.objects);
  } catch {
    return false;
  }
}

function normalizeScene(scene) {
  const { width, height } = parseSize();
  const duration = Math.max(1, Number(els.durationInput.value || scene.duration || 10));
  const normalized = {
    schema: "motionam-scene-v1",
    version: 1,
    title: String(scene.title || "MotionAM Scene").slice(0, 120),
    width: Number(scene.width) || width,
    height: Number(scene.height) || height,
    duration,
    fps: Number(scene.fps) || 60,
    background: scene.background || "#050607",
    objects: Array.isArray(scene.objects) ? scene.objects.slice(0, 80) : []
  };

  if (!normalized.objects.length) {
    throw new Error("Scene JSON must include at least one object.");
  }

  return normalized;
}

function serializeScene(scene) {
  return JSON.stringify(normalizeScene(scene), null, 2);
}

function sceneFromCodeEditor() {
  return normalizeScene(parseSceneText(els.codeEditor.value));
}

function createStarterScene() {
  const { width, height } = parseSize();
  const duration = Math.max(1, Number(els.durationInput.value || 10));
  const prompt = els.promptInput.value.trim();
  const title = (prompt.match(/"([^"]+)"/)?.[1] || prompt.split(/[.?!\n]/)[0] || "New Motion Scene").slice(0, 64);
  return {
    schema: "motionam-scene-v1",
    version: 1,
    title,
    width,
    height,
    duration,
    fps: 60,
    background: "#07090d",
    objects: [
      {
        id: "background-grid",
        type: "grid",
        x: 0,
        y: 0,
        w: width,
        h: height,
        spacing: Math.round(Math.min(width, height) / 14),
        stroke: "rgba(125, 211, 252, 0.14)",
        lineWidth: 1,
        opacity: 0.8
      },
      {
        id: "accent-panel",
        type: "shape",
        shape: "rect",
        x: width * 0.12,
        y: height * 0.3,
        w: width * 0.76,
        h: height * 0.36,
        radius: 20,
        fill: "rgba(10, 18, 26, 0.82)",
        stroke: "#29d3c2",
        lineWidth: 3,
        keyframes: {
          opacity: [
            { time: 0, value: 0.28 },
            { time: 0.6, value: 1 }
          ],
          scale: [
            { time: 0, value: 0.94, easing: "easeOutCubic" },
            { time: 0.7, value: 1 }
          ]
        }
      },
      {
        id: "title",
        type: "text",
        text: title,
        x: width * 0.5,
        y: height * 0.48,
        maxWidth: width * 0.68,
        fontSize: Math.round(Math.min(width, height) * 0.065),
        fontWeight: 850,
        align: "center",
        color: "#f3f5f4",
        shadowColor: "rgba(41, 211, 194, 0.34)",
        shadowBlur: 28,
        keyframes: {
          opacity: [
            { time: 0, value: 0 },
            { time: 0.45, value: 1 }
          ],
          y: [
            { time: 0, value: height * 0.53, easing: "easeOutCubic" },
            { time: 0.75, value: height * 0.48 }
          ]
        }
      },
      {
        id: "pulse-bars",
        type: "chart",
        chartType: "bar",
        x: width * 0.28,
        y: height * 0.69,
        w: width * 0.44,
        h: height * 0.12,
        values: [
          { label: "A", value: 62, color: "#29d3c2" },
          { label: "B", value: 88, color: "#f4b84a" },
          { label: "C", value: 74, color: "#ff6e5f" }
        ],
        keyframes: {
          progress: [
            { time: 0.2, value: 0 },
            { time: 1.4, value: 1, easing: "easeOutCubic" }
          ]
        }
      }
    ]
  };
}

function sceneEngineHtml(sceneInput) {
  const scene = normalizeScene(sceneInput);
  const sceneJson = JSON.stringify(scene).replace(/</g, "\\u003c");
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${scene.title.replace(/[<>&"]/g, "")}</title>
<style>
html, body {
  margin: 0;
  width: 100%;
  height: 100%;
  overflow: hidden;
  background: ${scene.background};
}
body {
  display: grid;
  place-items: center;
}
#stage {
  display: block;
  width: 100vw;
  height: 100vh;
  object-fit: contain;
  background: ${scene.background};
}
</style>
</head>
<body>
<canvas id="stage" width="${scene.width}" height="${scene.height}"></canvas>
<script id="motionam-scene" type="application/json">${sceneJson}</script>
<script>
(function () {
  var scene = JSON.parse(document.getElementById("motionam-scene").textContent);
  var canvas = document.getElementById("stage");
  var ctx = canvas.getContext("2d");
  var width = Number(scene.width) || canvas.width || 1920;
  var height = Number(scene.height) || canvas.height || 1080;
  var durationMs = Math.max(1, Number(scene.duration) || 10) * 1000;
  var imageCache = {};

  canvas.width = width;
  canvas.height = height;
  window.__MOTIONAM_DURATION = durationMs / 1000;

  function clamp(value, min, max) {
    value = Number(value);
    if (!Number.isFinite(value)) return min;
    return Math.max(min, Math.min(max, value));
  }

  function ease(name, t) {
    t = clamp(t, 0, 1);
    if (name === "easeInCubic") return t * t * t;
    if (name === "easeOutCubic") return 1 - Math.pow(1 - t, 3);
    if (name === "easeInOutCubic") return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
    if (name === "easeOutBack") {
      var c1 = 1.70158;
      var c3 = c1 + 1;
      return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
    }
    return t;
  }

  function lerp(a, b, t) {
    return a + (b - a) * t;
  }

  function valueAt(obj, prop, timeSeconds, fallback) {
    var list = obj.keyframes && obj.keyframes[prop];
    if (Array.isArray(list) && list.length) {
      var frames = list
        .filter(function (frame) { return typeof frame === "object"; })
        .map(function (frame) {
          return {
            time: Number(frame.time) || 0,
            value: frame.value,
            easing: frame.easing || "linear"
          };
        })
        .sort(function (a, b) { return a.time - b.time; });
      if (!frames.length) return fallback;
      if (timeSeconds <= frames[0].time) return frames[0].value;
      for (var index = 1; index < frames.length; index += 1) {
        var prev = frames[index - 1];
        var next = frames[index];
        if (timeSeconds <= next.time) {
          var span = Math.max(0.001, next.time - prev.time);
          var t = ease(next.easing || prev.easing, (timeSeconds - prev.time) / span);
          if (typeof prev.value === "number" && typeof next.value === "number") {
            return lerp(prev.value, next.value, t);
          }
          return t < 1 ? prev.value : next.value;
        }
      }
      return frames[frames.length - 1].value;
    }
    return obj[prop] !== undefined ? obj[prop] : fallback;
  }

  function setLineStyle(obj, timeSeconds) {
    ctx.lineWidth = Number(valueAt(obj, "lineWidth", timeSeconds, obj.lineWidth || 1));
    ctx.strokeStyle = valueAt(obj, "stroke", timeSeconds, obj.stroke || "rgba(255,255,255,0.4)");
    ctx.fillStyle = valueAt(obj, "fill", timeSeconds, obj.fill || obj.color || "#ffffff");
  }

  function withLayer(obj, timeSeconds, draw) {
    var x = Number(valueAt(obj, "x", timeSeconds, obj.x || 0));
    var y = Number(valueAt(obj, "y", timeSeconds, obj.y || 0));
    var w = Number(valueAt(obj, "w", timeSeconds, obj.w || obj.width || 0));
    var h = Number(valueAt(obj, "h", timeSeconds, obj.h || obj.height || 0));
    var opacity = Number(valueAt(obj, "opacity", timeSeconds, obj.opacity === undefined ? 1 : obj.opacity));
    var scale = Number(valueAt(obj, "scale", timeSeconds, obj.scale === undefined ? 1 : obj.scale));
    var rotation = Number(valueAt(obj, "rotation", timeSeconds, obj.rotation || 0)) * Math.PI / 180;
    var anchorX = Number(obj.anchorX === undefined ? w / 2 : obj.anchorX);
    var anchorY = Number(obj.anchorY === undefined ? h / 2 : obj.anchorY);
    if (opacity <= 0 || scale === 0) return;
    ctx.save();
    ctx.globalAlpha *= clamp(opacity, 0, 1);
    ctx.translate(x + anchorX, y + anchorY);
    ctx.rotate(rotation);
    ctx.scale(scale, scale);
    draw(-anchorX, -anchorY, w, h);
    ctx.restore();
  }

  function roundRect(x, y, w, h, radius) {
    radius = Math.min(Number(radius) || 0, Math.abs(w) / 2, Math.abs(h) / 2);
    ctx.beginPath();
    ctx.moveTo(x + radius, y);
    ctx.lineTo(x + w - radius, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + radius);
    ctx.lineTo(x + w, y + h - radius);
    ctx.quadraticCurveTo(x + w, y + h, x + w - radius, y + h);
    ctx.lineTo(x + radius, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - radius);
    ctx.lineTo(x, y + radius);
    ctx.quadraticCurveTo(x, y, x + radius, y);
    ctx.closePath();
  }

  function drawShape(obj, timeSeconds) {
    withLayer(obj, timeSeconds, function (x, y, w, h) {
      setLineStyle(obj, timeSeconds);
      if (obj.shadowColor) {
        ctx.shadowColor = obj.shadowColor;
        ctx.shadowBlur = Number(obj.shadowBlur) || 0;
      }
      if (obj.shape === "circle") {
        ctx.beginPath();
        ctx.arc(x + w / 2, y + h / 2, Math.max(1, Math.min(Math.abs(w), Math.abs(h)) / 2), 0, Math.PI * 2);
      } else {
        roundRect(x, y, w, h, obj.radius || 0);
      }
      if (obj.fill !== "none") ctx.fill();
      if (obj.stroke) ctx.stroke();
    });
  }

  function drawLine(obj, timeSeconds) {
    var points = Array.isArray(obj.points) ? obj.points : [[obj.x1 || 0, obj.y1 || 0], [obj.x2 || width, obj.y2 || height]];
    var progress = clamp(valueAt(obj, "progress", timeSeconds, obj.progress === undefined ? 1 : obj.progress), 0, 1);
    if (points.length < 2 || progress <= 0) return;
    ctx.save();
    ctx.globalAlpha *= clamp(valueAt(obj, "opacity", timeSeconds, obj.opacity === undefined ? 1 : obj.opacity), 0, 1);
    setLineStyle(obj, timeSeconds);
    ctx.lineCap = obj.lineCap || "round";
    ctx.lineJoin = "round";
    ctx.beginPath();
    var maxIndex = Math.max(1, Math.ceil((points.length - 1) * progress));
    ctx.moveTo(Number(points[0][0]), Number(points[0][1]));
    for (var index = 1; index <= maxIndex && index < points.length; index += 1) {
      ctx.lineTo(Number(points[index][0]), Number(points[index][1]));
    }
    ctx.stroke();
    ctx.restore();
  }

  function drawGrid(obj, timeSeconds) {
    ctx.save();
    ctx.globalAlpha *= clamp(valueAt(obj, "opacity", timeSeconds, obj.opacity === undefined ? 1 : obj.opacity), 0, 1);
    ctx.strokeStyle = obj.stroke || "rgba(255,255,255,0.12)";
    ctx.lineWidth = Number(obj.lineWidth) || 1;
    var spacing = Math.max(12, Number(obj.spacing) || 80);
    var offset = (timeSeconds * 18) % spacing;
    ctx.beginPath();
    for (var x = -spacing + offset; x < width + spacing; x += spacing) {
      ctx.moveTo(x, 0);
      ctx.lineTo(x - height * 0.16, height);
    }
    for (var y = -spacing + offset; y < height + spacing; y += spacing) {
      ctx.moveTo(0, y);
      ctx.lineTo(width, y - width * 0.16);
    }
    ctx.stroke();
    ctx.restore();
  }

  function wrapText(text, maxWidth) {
    var words = String(text || "").split(/\\s+/);
    var lines = [];
    var line = "";
    words.forEach(function (word) {
      var test = line ? line + " " + word : word;
      if (ctx.measureText(test).width > maxWidth && line) {
        lines.push(line);
        line = word;
      } else {
        line = test;
      }
    });
    if (line) lines.push(line);
    return lines.length ? lines : [""];
  }

  function drawText(obj, timeSeconds) {
    var fontSize = Number(valueAt(obj, "fontSize", timeSeconds, obj.fontSize || 72));
    var weight = obj.fontWeight || 800;
    var family = obj.fontFamily || "Inter, Arial, Helvetica, sans-serif";
    var maxWidth = Number(obj.maxWidth || obj.w || width * 0.8);
    var lineHeight = Number(obj.lineHeight || fontSize * 1.12);
    var text = valueAt(obj, "text", timeSeconds, obj.text || "");
    obj.w = maxWidth;
    obj.h = lineHeight;
    withLayer(obj, timeSeconds, function (x, y) {
      ctx.font = weight + " " + fontSize + "px " + family;
      ctx.textAlign = obj.align || obj.textAlign || "left";
      ctx.textBaseline = "middle";
      ctx.fillStyle = valueAt(obj, "color", timeSeconds, obj.color || obj.fill || "#ffffff");
      if (obj.shadowColor) {
        ctx.shadowColor = obj.shadowColor;
        ctx.shadowBlur = Number(obj.shadowBlur) || 0;
      }
      var lines = wrapText(text, maxWidth);
      var total = (lines.length - 1) * lineHeight;
      lines.forEach(function (line, index) {
        ctx.fillText(line, x, y - total / 2 + index * lineHeight);
      });
    });
  }

  function drawImage(obj, timeSeconds) {
    withLayer(obj, timeSeconds, function (x, y, w, h) {
      var src = obj.src || "";
      var img = null;
      if (src) {
        if (!imageCache[src]) {
          imageCache[src] = new Image();
          imageCache[src].crossOrigin = "anonymous";
          imageCache[src].src = src;
        }
        img = imageCache[src];
      }
      if (img && img.complete && img.naturalWidth) {
        ctx.drawImage(img, x, y, w, h);
        return;
      }
      ctx.fillStyle = obj.fill || "rgba(255,255,255,0.08)";
      ctx.strokeStyle = obj.stroke || "rgba(255,255,255,0.32)";
      ctx.lineWidth = 2;
      roundRect(x, y, w, h, obj.radius || 16);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = obj.color || "rgba(255,255,255,0.72)";
      ctx.font = "700 " + Math.max(18, Math.min(w, h) * 0.16) + "px Arial, sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(obj.placeholder || "Replace Image", x + w / 2, y + h / 2);
    });
  }

  function drawChart(obj, timeSeconds) {
    var values = Array.isArray(obj.values) ? obj.values : [];
    if (!values.length) return;
    var progress = clamp(valueAt(obj, "progress", timeSeconds, obj.progress === undefined ? 1 : obj.progress), 0, 1);
    withLayer(obj, timeSeconds, function (x, y, w, h) {
      var max = Math.max.apply(null, values.map(function (item) { return Number(item.value) || 0; })) || 1;
      var gap = Number(obj.gap) || Math.max(8, w * 0.025);
      var vertical = obj.orientation !== "horizontal";
      ctx.font = "700 " + (obj.labelSize || 22) + "px Arial, sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "top";
      values.forEach(function (item, index) {
        var value = Number(item.value) || 0;
        var color = item.color || obj.color || "#29d3c2";
        ctx.fillStyle = color;
        if (vertical) {
          var barW = (w - gap * (values.length - 1)) / values.length;
          var barH = h * (value / max) * progress;
          var bx = x + index * (barW + gap);
          var by = y + h - barH;
          roundRect(bx, by, barW, barH, obj.radius || 10);
          ctx.fill();
          ctx.fillStyle = obj.textColor || "#e5e7eb";
          ctx.fillText(String(item.label || ""), bx + barW / 2, y + h + 10);
        } else {
          var rowH = (h - gap * (values.length - 1)) / values.length;
          var barWidth = w * (value / max) * progress;
          var rowY = y + index * (rowH + gap);
          roundRect(x, rowY, barWidth, rowH, obj.radius || 10);
          ctx.fill();
          ctx.fillStyle = obj.textColor || "#e5e7eb";
          ctx.textAlign = "left";
          ctx.textBaseline = "middle";
          ctx.fillText(String(item.label || ""), x + 12, rowY + rowH / 2);
          ctx.textAlign = "center";
          ctx.textBaseline = "top";
        }
      });
    });
  }

  function drawObject(obj, timeSeconds) {
    if (!obj || obj.hidden) return;
    if (obj.type === "text") drawText(obj, timeSeconds);
    else if (obj.type === "shape") drawShape(obj, timeSeconds);
    else if (obj.type === "line") drawLine(obj, timeSeconds);
    else if (obj.type === "grid") drawGrid(obj, timeSeconds);
    else if (obj.type === "image") drawImage(obj, timeSeconds);
    else if (obj.type === "chart") drawChart(obj, timeSeconds);
  }

  function renderFrame(timeMs) {
    var safeTime = clamp(timeMs, 0, durationMs);
    var timeSeconds = safeTime / 1000;
    ctx.clearRect(0, 0, width, height);
    ctx.fillStyle = scene.background || "#050607";
    ctx.fillRect(0, 0, width, height);
    (scene.objects || []).forEach(function (obj) {
      drawObject(obj, timeSeconds);
    });
  }

  window.__MOTIONAM_RENDER = function (timeMs) {
    renderFrame(timeMs || 0);
  };

  function loop(timeMs) {
    renderFrame(timeMs % durationMs);
    requestAnimationFrame(loop);
  }

  renderFrame(0);
  requestAnimationFrame(loop);
})();
</script>
</body>
</html>`;
}

function previewSourceFromCode(code) {
  if (isSceneJson(code)) {
    return sceneEngineHtml(parseSceneText(code));
  }
  return code;
}

function emptyScene() {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>MotionAM Preview</title>
<style>
html, body {
  margin: 0;
  width: 100%;
  height: 100%;
  overflow: hidden;
  background: #050607;
}
body {
  display: grid;
  place-items: center;
  color: rgba(243,245,244,0.55);
  font: 700 28px Arial, Helvetica, sans-serif;
}
</style>
</head>
<body ${EMPTY_SCENE_MARKER}="true">No scene yet</body>
</html>`;
}

function isEmptySceneCode(code) {
  const value = String(code || "").trim();
  return !value || value.includes(EMPTY_SCENE_MARKER);
}

function instrumentPreviewHtml(code) {
  const durationMs = Math.max(1, Number(els.durationInput.value || 10)) * 1000;
  const guard = `<script>
(function () {
  var durationMs = ${durationMs};
  var nativePerfNow = performance.now.bind(performance);
  var nativeRequestAnimationFrame = window.requestAnimationFrame.bind(window);
  var nativeCancelAnimationFrame = window.cancelAnimationFrame.bind(window);
  var paused = false;
  var manualTime = 0;
  var baseTime = 0;
  var baseNativeTime = nativePerfNow();
  var rafCallbacks = {};
  var nextRafId = 1;

  window.__MOTIONAM_ERRORS = [];

  function pushError(message) {
    window.__MOTIONAM_ERRORS.push((message || "Script error").slice(0, 240));
  }

  window.addEventListener("error", function (event) {
    pushError(event.message || "Script error");
  });

  window.addEventListener("unhandledrejection", function (event) {
    var reason = event.reason && (event.reason.message || String(event.reason));
    pushError(reason || "Unhandled rejection");
  });

  function clampTime(timeMs) {
    timeMs = Number(timeMs) || 0;
    return Math.max(0, Math.min(durationMs, timeMs));
  }

  function currentTime() {
    if (paused) {
      return manualTime;
    }
    return clampTime(baseTime + nativePerfNow() - baseNativeTime);
  }

  function updateGlobals(timeMs) {
    var safeTime = clampTime(timeMs);
    window.__MOTIONAM_TIME = safeTime;
    window.__MOTIONAM_PROGRESS = durationMs ? safeTime / durationMs : 0;
    window.__MOTIONAM_DURATION = durationMs / 1000;
    window.__MOTIONAM_IS_SCRUBBING = paused;
  }

  function syncCssAnimations(timeMs, shouldPause) {
    try {
      document.documentElement.style.setProperty("--motionam-time", String(timeMs));
      document.documentElement.style.setProperty("--motionam-progress", String(durationMs ? timeMs / durationMs : 0));
      var animations = document.getAnimations ? document.getAnimations() : [];
      animations.forEach(function (animation) {
        animation.currentTime = timeMs;
        if (shouldPause) {
          animation.pause();
        } else {
          animation.play();
        }
      });
    } catch (error) {
      // Some browser-created animations do not allow manual control.
    }
  }

  function callRender(timeMs) {
    if (typeof window.__MOTIONAM_RENDER !== "function") {
      return;
    }
    try {
      window.__MOTIONAM_RENDER(timeMs, durationMs ? timeMs / durationMs : 0);
    } catch (error) {
      pushError(error && (error.message || String(error)));
    }
  }

  function fireRaf(id, timeMs) {
    var callback = rafCallbacks[id];
    if (!callback) {
      return;
    }
    delete rafCallbacks[id];
    try {
      callback(timeMs);
    } catch (error) {
      pushError(error && (error.message || String(error)));
    }
  }

  try {
    Object.defineProperty(performance, "now", {
      configurable: true,
      value: currentTime
    });
  } catch (error) {
    // If performance.now cannot be overridden, RAF timestamps still use the timeline.
  }

  window.requestAnimationFrame = function (callback) {
    var id = nextRafId++;
    rafCallbacks[id] = callback;
    if (!paused) {
      nativeRequestAnimationFrame(function () {
        fireRaf(id, currentTime());
      });
    }
    return id;
  };

  window.cancelAnimationFrame = function (id) {
    delete rafCallbacks[id];
    nativeCancelAnimationFrame(id);
  };

  function flushRaf(timeMs) {
    Object.keys(rafCallbacks).slice(0, 60).forEach(function (id) {
      fireRaf(id, timeMs);
    });
  }

  window.__MOTIONAM_SET_TIME = function (timeMs, shouldPause) {
    manualTime = clampTime(timeMs);
    paused = Boolean(shouldPause);
    if (!paused) {
      baseTime = manualTime;
      baseNativeTime = nativePerfNow();
    }
    updateGlobals(manualTime);
    syncCssAnimations(manualTime, paused);
    callRender(manualTime);
    flushRaf(manualTime);
  };

  window.__MOTIONAM_GET_TIME = function () {
    return currentTime();
  };

  window.addEventListener("message", function (event) {
    var data = event.data || {};
    if (data.type === "MOTIONAM_SET_TIME") {
      window.__MOTIONAM_SET_TIME(data.timeMs, data.paused !== false);
    }
  });

  updateGlobals(0);
})();
</script>`;

  if (/<head[\s>]/i.test(code)) {
    return code.replace(/<head([^>]*)>/i, `<head$1>${guard}`);
  }
  return `${guard}${code}`;
}

function buildSceneSystemPrompt() {
  const { width, height } = parseSize();
  const duration = Number(els.durationInput.value || 10);
  return [
    "You are the scene designer inside MotionAM's commercial scene engine.",
    "Return exactly one valid JSON object. Do not use markdown fences. Do not return HTML, CSS, or JavaScript.",
    "The JSON must follow this schema:",
    "{",
    '  "schema": "motionam-scene-v1",',
    '  "version": 1,',
    '  "title": "Short scene title",',
    `  "width": ${width},`,
    `  "height": ${height},`,
    `  "duration": ${duration},`,
    '  "fps": 60,',
    '  "background": "#050607",',
    '  "objects": []',
    "}",
    "Allowed object types: text, shape, line, grid, image, chart.",
    "All objects need an id, type, x, y, and visible styling. Use w and h for rectangular objects.",
    "For text: text, fontSize, fontWeight, color, align, maxWidth.",
    "For shape: shape rect or circle, fill, stroke, lineWidth, radius.",
    "For line: points as [[x,y],[x,y]], stroke, lineWidth, progress keyframes.",
    "For image: use placeholder text unless the user gives an image URL. Set w and h.",
    "For chart: chartType bar, values [{label,value,color}], x, y, w, h, progress keyframes.",
    "Use keyframes as an object where each property has an array of {time, value, easing}. Times are seconds.",
    "Supported easing names: linear, easeInCubic, easeOutCubic, easeInOutCubic, easeOutBack.",
    "Animate numeric properties such as x, y, w, h, opacity, scale, rotation, progress, and fontSize.",
    "Create a finished motion graphic with 6 to 24 objects, visible on frame 0, polished composition, safe margins, and a readable end frame.",
    "For long briefs, compress the story into 3 to 4 visual beats using titles, numbers, bars, arrows, and labels.",
    "Avoid tiny text, long paragraphs, live fetches, external scripts, and unsupported object types.",
    "Use valid CSS color strings only."
  ].join("\n");
}

function buildSystemPrompt() {
  const { width, height } = parseSize();
  const duration = Number(els.durationInput.value || 10);
  return [
    "You are the motion graphics code generator inside MotionAM.",
    "Return exactly one complete HTML document. Do not use markdown fences.",
    "Use only inline HTML, CSS, and JavaScript. Avoid external assets and external scripts.",
    `The stage must be ${width} by ${height} logical pixels and responsive to the iframe.`,
    `The animation duration is ${duration} seconds. Set window.__MOTIONAM_DURATION to that number.`,
    `Prefer one canvas: <canvas id="stage" width="${width}" height="${height}"></canvas>. Canvas output is the safest recording target.`,
    "Use separate names for the canvas element and context, such as canvasEl and ctx.",
    "Never call DOM methods such as appendChild on a canvas context. Draw canvas text with ctx.fillText.",
    "Set canvas CSS to fill the viewport while preserving the requested aspect ratio.",
    "If DOM or CSS animation is better, include all referenced elements in the body before scripts run.",
    "Timeline slider compatibility is required: put all drawing/state updates in a renderFrame(timeMs, progress) function, assign it to window.__MOTIONAM_RENDER, and drive playback with requestAnimationFrame using the timestamp passed to renderFrame.",
    "When window.__MOTIONAM_IS_SCRUBBING is true, render the frame for window.__MOTIONAM_TIME without advancing internal state.",
    "Never reference an element without checking it exists. Do not call .style on null.",
    "For charts or graphs, iterate directly over data arrays. Do not use Array.find with mixed string and number years.",
    "Use bounded loops over scene objects or data points. Do not loop over every pixel of a 1920px canvas.",
    "For long multi-section briefs, create a concise storyboard with at most 3 to 4 timed scenes. Do not try to render every sentence.",
    "Use short on-screen labels and numeric highlights instead of long paragraphs. Keep voiceover context out of the canvas unless it is a title or label.",
    "Hardcode small representative datasets for charts. Avoid live data, fetch, dates parsing, and complex dependencies.",
    "Use valid CSS color values only. For example, ivory is #fffff0, not #ivory.",
    "Use requestAnimationFrame with performance.now(), polished easing, layered motion, and a final end frame.",
    "Make text large enough for video use and keep all important visuals inside safe margins.",
    "The preview must show visible foreground graphics within the first second.",
    "The code must run without syntax errors or runtime errors in a browser iframe."
  ].join("\n");
}

function buildAiPayload(model) {
  const prompt = els.promptInput.value.trim();
  if (getEngineMode() === "scene") {
    return {
      model,
      temperature: prompt.length > 2400 ? 0.28 : 0.38,
      stream: false,
      messages: [
        { role: "system", content: buildSceneSystemPrompt() },
        {
          role: "user",
          content: [
            `Style preset: ${els.styleSelect.value}`,
            `Duration: ${els.durationInput.value} seconds`,
            "Build an editable MotionAM scene JSON from this brief.",
            `Prompt: ${prompt}`
          ].join("\n")
        }
      ]
    };
  }

  return {
    model,
    temperature: prompt.length > 2400 ? 0.32 : 0.45,
    stream: false,
    messages: [
      { role: "system", content: buildSystemPrompt() },
      {
        role: "user",
        content: [
          `Style preset: ${els.styleSelect.value}`,
          `Duration: ${els.durationInput.value} seconds`,
          "Build a finished motion graphic from this brief. If it is long, prioritize section headings, numbers, colors, chart types, and transitions.",
          `Prompt: ${prompt}`
        ].join("\n")
      }
    ]
  };
}

function buildRepairPayload(model, brokenCode, reason) {
  const clippedCode = String(brokenCode || "").slice(0, 28000);
  const visibilityFailure = /blank|flat|no visible/i.test(String(reason || ""));
  if (getEngineMode() === "scene") {
    return {
      model,
      temperature: 0.16,
      stream: false,
      messages: [
        {
          role: "system",
          content: [
            buildSceneSystemPrompt(),
            "You are repairing failed MotionAM scene JSON.",
            "Return only a complete valid scene JSON object using the same schema.",
            visibilityFailure
              ? "The preview looked blank. Ensure there is a visible background, readable text, clear foreground shapes/charts, and visible objects on frame 0."
              : "Preserve the user's requested design while fixing invalid or unsupported scene data."
          ].join("\n")
        },
        {
          role: "user",
          content: [
            `Original prompt: ${els.promptInput.value}`,
            `Preview/runtime failure: ${reason || "Unknown preview failure"}`,
            "Broken scene JSON:",
            clippedCode
          ].join("\n\n")
        }
      ]
    };
  }

  return {
    model,
    temperature: 0.18,
    stream: false,
    messages: [
      {
        role: "system",
        content: [
          buildSystemPrompt(),
          "You are repairing a failed MotionAM HTML document.",
          "Keep the user's requested scene, but fix all JavaScript, canvas, CSS, and timing bugs.",
          visibilityFailure
            ? "The preview looked blank. Rewrite the scene from scratch if needed. Draw visible foreground graphics on frame 0: a dark background, large readable title, animated grid/particles/shapes, and clear motion. Do not use a long blank intro delay."
            : "Preserve the existing design where possible.",
          "Return only the repaired complete HTML document. Do not explain the changes."
        ].join("\n")
      },
      {
        role: "user",
        content: [
          `Original prompt: ${els.promptInput.value}`,
          `Preview/runtime failure: ${reason || "Unknown preview failure"}`,
          "Broken HTML:",
          clippedCode
        ].join("\n\n")
      }
    ]
  };
}

function buildEditPayload(model, currentCode, editInstruction) {
  const clippedCode = String(currentCode || "").slice(0, 60000);
  if (getEngineMode() === "scene") {
    return {
      model,
      temperature: 0.24,
      stream: false,
      messages: [
        {
          role: "system",
          content: [
            buildSceneSystemPrompt(),
            "You are editing an existing MotionAM scene JSON.",
            "Apply the user's requested change by editing object properties, text, colors, values, positions, keyframes, or timing.",
            "Preserve as much of the current scene as possible. Return only the full updated valid JSON object."
          ].join("\n")
        },
        {
          role: "user",
          content: [
            `Edit request: ${editInstruction}`,
            "Current scene JSON:",
            clippedCode
          ].join("\n\n")
        }
      ]
    };
  }

  return {
    model,
    temperature: 0.32,
    stream: false,
    messages: [
      {
        role: "system",
        content: [
          buildSystemPrompt(),
          "You are editing an existing MotionAM motion graphics HTML document.",
          "Keep the current scene structure where possible, but apply the requested creative or timing changes.",
          "Preserve recording compatibility: prefer canvas output and keep all code self-contained.",
          "Return only one complete repaired-and-edited HTML document. Do not explain the changes."
        ].join("\n")
      },
      {
        role: "user",
        content: [
          `Original prompt: ${els.promptInput.value}`,
          `Edit request: ${editInstruction}`,
          "Current HTML:",
          clippedCode
        ].join("\n\n")
      }
    ]
  };
}

async function aiErrorFromResponse(response) {
  const body = await response.json().catch(() => null);
  if (typeof body?.error === "string") {
    return body.error;
  }
  if (body?.error?.message) {
    return `AI request failed (${response.status}). ${body.error.message}`;
  }
  return `AI request failed (${response.status}).`;
}

async function codeFromAiResponse(response) {
  if (!response.ok) {
    throw new Error(await aiErrorFromResponse(response));
  }

  const data = await response.json();
  const content = data?.choices?.[0]?.message?.content || data?.choices?.[0]?.text || data?.message?.content || data?.response || "";
  if (!content.trim()) {
    throw new Error(getEngineMode() === "scene" ? "The AI response did not include scene JSON." : "The AI response did not include code.");
  }
  if (getEngineMode() === "scene") {
    return serializeScene(parseSceneText(content));
  }
  return prepareAiHtml(htmlFromAiText(content));
}

function directProviderPayload(provider, payload) {
  if (provider === "ollama") {
    return {
      model: payload.model,
      messages: payload.messages,
      stream: false,
      options: { temperature: payload.temperature }
    };
  }
  return payload;
}

async function generateWithDirectProvider(provider, endpoint, apiKey, payload) {
  const headers = { "Content-Type": "application/json" };
  if (provider !== "ollama") {
    headers.Authorization = `Bearer ${apiKey}`;
  }
  const response = await fetch(endpoint, {
    method: "POST",
    headers,
    body: JSON.stringify(directProviderPayload(provider, payload))
  });
  return codeFromAiResponse(response);
}

async function generateWithAi(customPayload = null) {
  const provider = normalizeProvider(els.providerSelect.value);
  const apiKey = els.apiKeyInput.value.trim();
  const endpoint = normalizeEndpoint(els.endpointInput.value, provider);
  const model = normalizeModel(els.modelInput.value, provider);

  if (!endpoint) {
    throw new Error("Add an AI endpoint.");
  }

  if (provider !== "ollama" && !apiKey) {
    throw new Error("Add an API key.");
  }

  els.providerSelect.value = provider;
  els.endpointInput.value = endpoint;
  els.modelInput.value = model;
  setSessionApiKey(provider, apiKey);
  applyProviderUi();
  const payload = customPayload ? { ...customPayload, model } : buildAiPayload(model);

  let response;
  try {
    response = await fetch(appApiUrl("/api/generate"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        provider,
        endpoint,
        apiKey,
        ...payload
      })
    });
  } catch (error) {
    if (provider === "ollama") {
      return generateWithDirectProvider(provider, endpoint, apiKey, payload);
    }
    throw new Error("MotionAM helper server is not running. Open Restart MotionAM.bat, keep that window open, then refresh this page and generate again.");
  }

  if (!response.ok) {
    const message = await aiErrorFromResponse(response);
    if (provider === "ollama" && /Unable to connect|fetch failed|relay failed/i.test(message)) {
      return generateWithDirectProvider(provider, endpoint, apiKey, payload);
    }
    if (/Unable to connect|fetch failed|relay failed/i.test(message)) {
      throw new Error("MotionAM could not reach the AI service through the helper server. Check your internet connection, keep Restart MotionAM.bat open, then try again.");
    }
    throw new Error(message);
  }
  return codeFromAiResponse(response);
}

function repairWithAi(brokenCode, reason) {
  const model = normalizeModel(els.modelInput.value, els.providerSelect.value);
  return generateWithAi(buildRepairPayload(model, brokenCode, reason));
}

function applyProviderDefaults(force = false) {
  const provider = normalizeProvider(els.providerSelect.value);
  const defaults = PROVIDERS[provider];
  if (force || !els.endpointInput.value.trim()) {
    els.endpointInput.value = defaults.endpoint;
  }
  if (force || !els.modelInput.value.trim()) {
    els.modelInput.value = defaults.model;
  }
  applyProviderUi();
}

function applyProviderUi() {
  const provider = normalizeProvider(els.providerSelect.value);
  const defaults = PROVIDERS[provider];
  els.apiKeyInput.placeholder = defaults.apiKeyPlaceholder;
  els.apiKeyInput.disabled = provider === "ollama";
  if (provider === "ollama") {
    els.apiKeyInput.value = "";
    els.apiKeyInput.dataset.provider = provider;
    return;
  }
  if (els.apiKeyInput.dataset.provider !== provider) {
    els.apiKeyInput.value = sessionApiKeyFor(provider);
    els.apiKeyInput.dataset.provider = provider;
    return;
  }
  if (!els.apiKeyInput.value.trim()) {
    els.apiKeyInput.value = sessionApiKeyFor(provider);
  }
}

function setCode(code, shouldRun = true) {
  els.codeEditor.value = code;
  if (shouldRun) runPreview();
}

function canvasHasVisibleInk(canvas) {
  try {
    if (!canvas.width || !canvas.height) {
      return false;
    }

    const sample = document.createElement("canvas");
    sample.width = 72;
    sample.height = 40;
    const ctx = sample.getContext("2d", { willReadFrequently: true });
    if (!ctx) {
      return true;
    }

    ctx.drawImage(canvas, 0, 0, sample.width, sample.height);
    const pixels = ctx.getImageData(0, 0, sample.width, sample.height).data;
    const colors = new Set();
    let opaque = 0;
    let minLuma = 255;
    let maxLuma = 0;
    let minAlpha = 255;
    let maxAlpha = 0;

    for (let index = 0; index < pixels.length; index += 4) {
      const red = pixels[index];
      const green = pixels[index + 1];
      const blue = pixels[index + 2];
      const alpha = pixels[index + 3];
      minAlpha = Math.min(minAlpha, alpha);
      maxAlpha = Math.max(maxAlpha, alpha);

      if (alpha < 16) {
        continue;
      }

      opaque += 1;
      const luma = red * 0.2126 + green * 0.7152 + blue * 0.0722;
      minLuma = Math.min(minLuma, luma);
      maxLuma = Math.max(maxLuma, luma);
      colors.add(`${red >> 4},${green >> 4},${blue >> 4},${alpha >> 6}`);
    }

    const totalPixels = sample.width * sample.height;
    if (opaque < totalPixels * 0.02) {
      return false;
    }

    return colors.size >= 2 || maxLuma - minLuma > 10 || maxAlpha - minAlpha > 80;
  } catch {
    return true;
  }
}

function getValidationFrame() {
  let frame = document.querySelector("#validationFrame");
  if (frame) {
    return frame;
  }

  frame = document.createElement("iframe");
  frame.id = "validationFrame";
  frame.title = "Validation preview";
  frame.setAttribute("sandbox", "allow-scripts allow-same-origin");
  frame.setAttribute("aria-hidden", "true");
  frame.style.cssText = [
    "position:fixed",
    "left:-10000px",
    "top:0",
    "width:360px",
    "height:202px",
    "border:0",
    "opacity:0",
    "pointer-events:none"
  ].join(";");
  document.body.appendChild(frame);
  return frame;
}

function renderCodeInFrame(frame, code) {
  let settled = false;
  const ready = new Promise((resolve) => {
    const done = () => {
      if (settled) return;
      settled = true;
      resolve();
    };
    frame.addEventListener("load", done, { once: true });
    window.setTimeout(done, 700);
  });
  frame.srcdoc = instrumentPreviewHtml(previewSourceFromCode(code));
  return ready;
}

function previewHealth(frame = els.previewFrame) {
  try {
    const frameWindow = frame.contentWindow;
    const frameDocument = frame.contentDocument;
    const body = frameDocument?.body;
    if (!frameDocument || !body) {
      return { ok: false, reason: "preview document did not load" };
    }

    const errors = Array.from(frameWindow?.__MOTIONAM_ERRORS || []);
    if (errors.length) {
      return { ok: false, reason: errors[0] };
    }

    const text = (body.innerText || "").trim();
    const canvases = Array.from(body.querySelectorAll("canvas"));
    const canvasCount = canvases.length;
    const canvasHasInk = canvases.some(canvasHasVisibleInk);
    const svgCount = body.querySelectorAll("svg").length;
    const mediaCount = body.querySelectorAll("img,video").length;
    const visibleElement = Array.from(body.querySelectorAll("body *:not(canvas):not(script):not(style)")).some((element) => {
      const style = frameWindow.getComputedStyle(element);
      const rect = element.getBoundingClientRect();
      return (
        rect.width > 8 &&
        rect.height > 8 &&
        style.display !== "none" &&
        style.visibility !== "hidden" &&
        Number(style.opacity || 1) > 0
      );
    });

    if (!body.children.length) {
      return { ok: false, reason: "AI returned an empty body" };
    }

    if (canvasCount && !canvasHasInk && !text && !svgCount && !mediaCount && !visibleElement) {
      return { ok: false, reason: "AI canvas is blank or flat" };
    }

    if (!text && !canvasHasInk && !svgCount && !mediaCount && !visibleElement) {
      return { ok: false, reason: "AI scene has no visible graphics" };
    }

    return { ok: true, reason: "" };
  } catch (error) {
    return { ok: false, reason: error.message || "preview could not be inspected" };
  }
}

function isVisibilityFailure(reason) {
  return /blank|flat|no visible graphics/i.test(String(reason || ""));
}

function setValidationFrameTime(frame, timeMs) {
  try {
    const frameWindow = frame.contentWindow;
    if (typeof frameWindow?.__MOTIONAM_SET_TIME === "function") {
      frameWindow.__MOTIONAM_SET_TIME(timeMs, true);
      return;
    }
    frameWindow?.postMessage({ type: "MOTIONAM_SET_TIME", timeMs, paused: true }, "*");
  } catch {
    // The frame may not be ready for timeline control yet.
  }
}

async function previewAndValidateCode(code) {
  const validationFrame = getValidationFrame();
  await renderCodeInFrame(validationFrame, code);
  await new Promise((resolve) => window.setTimeout(resolve, 450));

  let health = previewHealth(validationFrame);
  if (health.ok || !isVisibilityFailure(health.reason)) {
    return health;
  }

  const duration = timelineDurationMs();
  const sampleTimes = [
    150,
    Math.min(duration - 50, duration * 0.16),
    Math.min(duration - 50, duration * 0.35),
    Math.min(duration - 50, duration * 0.62),
    Math.min(duration - 50, duration * 0.86)
  ].filter((timeMs) => timeMs >= 0);

  let lastReason = health.reason;
  for (const timeMs of sampleTimes) {
    setValidationFrameTime(validationFrame, timeMs);
    await new Promise((resolve) => window.setTimeout(resolve, 220));
    health = previewHealth(validationFrame);
    if (health.ok) {
      return health;
    }
    if (!isVisibilityFailure(health.reason)) {
      return health;
    }
    lastReason = health.reason || lastReason;
  }

  return {
    ok: false,
    reason: `${lastReason}. Tested several timeline points and the preview still looked blank.`
  };
}

function runPreview(options = {}) {
  const autoplay = options.autoplay !== false;
  const code = els.codeEditor.value.trim() || emptyScene();
  stopTimelinePlayback({ send: false });
  setTimelineTime(0, { paused: !autoplay, send: false });
  const ready = renderCodeInFrame(els.previewFrame, code);
  ready.then(() => {
    if (isEmptySceneCode(code)) {
      sendTimelineTime(0, true);
      return;
    }
    if (autoplay) {
      playTimeline();
    } else {
      sendTimelineTime(0, true);
    }
  });
  setStatus(isEmptySceneCode(code) ? "Ready to generate" : "Preview running");
  return ready;
}

function showPreview() {
  els.previewTab.classList.add("active");
  els.codeTab.classList.remove("active");
  els.previewShell.hidden = false;
  els.codeEditor.hidden = true;
  updatePreviewView();
}

function showCode() {
  stopTimelinePlayback({ send: true });
  els.codeTab.classList.add("active");
  els.previewTab.classList.remove("active");
  els.previewShell.hidden = true;
  els.codeEditor.hidden = false;
}

async function acceptAiCode(code, messages) {
  let finalCode = code;
  let health = await previewAndValidateCode(finalCode);
  if (!health.ok) {
    setStatus("Repairing AI code");
    const repairedCode = await repairWithAi(finalCode, health.reason);
    const repairedHealth = await previewAndValidateCode(repairedCode);
    if (!repairedHealth.ok) {
      throw new Error(`AI preview failed after repair: ${repairedHealth.reason}`);
    }
    finalCode = repairedCode;
    showToast(messages.repaired);
  } else {
    showToast(messages.success);
  }

  pushUndoSnapshot("AI scene update");
  els.codeEditor.value = finalCode;
  await runPreview();
  showPreview();
  persistSettings();
  setStatus("Ready to record");
}

async function withAiBusy(status, task) {
  setStatus(status);
  els.generateButton.disabled = true;
  els.editButton.disabled = true;
  const previousCode = els.codeEditor.value;
  try {
    if (!els.useAiToggle.checked) {
      throw new Error("Enable AI before generating.");
    }
    await task();
  } catch (error) {
    if (els.codeEditor.value !== previousCode) {
      els.codeEditor.value = previousCode || emptyScene();
      await runPreview();
    }
    showToast(error.message, { persistent: true, tone: "error" });
    setStatus(status === "Editing scene" ? "Edit failed" : "Generation failed");
  } finally {
    els.generateButton.disabled = false;
    els.editButton.disabled = false;
  }
}

async function generateMotion() {
  if (!els.useAiToggle.checked && getEngineMode() === "scene") {
    syncRenderSizeFromPrompt();
    els.generateButton.disabled = true;
    els.editButton.disabled = true;
    try {
      setStatus("Building scene");
      pushUndoSnapshot("Local scene template");
      setCode(serializeScene(createStarterScene()), false);
      await runPreview();
      showPreview();
      persistSettings();
      setStatus("Scene engine ready");
      showToast("Editable scene engine template generated.");
    } catch (error) {
      showToast(error.message, { persistent: true, tone: "error" });
      setStatus("Generation failed");
    } finally {
      els.generateButton.disabled = false;
      els.editButton.disabled = false;
    }
    return;
  }

  await withAiBusy("Generating", async () => {
    syncRenderSizeFromPrompt();
    const code = await generateWithAi();
    await acceptAiCode(code, {
      success: getEngineMode() === "scene" ? "Editable scene generated." : "AI code generated.",
      repaired: getEngineMode() === "scene" ? "Scene repaired and generated." : "AI code repaired and generated."
    });
  });
}

async function editCurrentMotion() {
  await withAiBusy("Editing scene", async () => {
    const instruction = els.editInput.value.trim();
    if (!instruction) {
      throw new Error("Add an edit request first.");
    }
    if (isEmptySceneCode(els.codeEditor.value)) {
      throw new Error("Generate a scene before editing.");
    }

    const model = normalizeModel(els.modelInput.value, els.providerSelect.value);
    const code = await generateWithAi(buildEditPayload(model, els.codeEditor.value, instruction));
    await acceptAiCode(code, {
      success: "Scene edit applied.",
      repaired: getEngineMode() === "scene" ? "Scene data repaired and applied." : "Scene edit repaired and applied."
    });
    els.editInput.value = "";
  });
}

function stopRecordCanvasPump() {
  if (recordFrameId) {
    cancelAnimationFrame(recordFrameId);
    recordFrameId = 0;
  }
  recordCanvas = null;
}

function drawCoverFrame(ctx, source, width, height) {
  const sourceWidth = source.width || source.clientWidth;
  const sourceHeight = source.height || source.clientHeight;
  if (!sourceWidth || !sourceHeight) {
    return;
  }

  const scale = Math.max(width / sourceWidth, height / sourceHeight);
  const cropWidth = width / scale;
  const cropHeight = height / scale;
  const cropX = (sourceWidth - cropWidth) / 2;
  const cropY = (sourceHeight - cropHeight) / 2;
  ctx.fillStyle = "#050607";
  ctx.fillRect(0, 0, width, height);
  ctx.drawImage(source, cropX, cropY, cropWidth, cropHeight, 0, 0, width, height);
}

function getCanvasStream() {
  try {
    const frameDocument = els.previewFrame.contentDocument;
    const sourceCanvas = frameDocument?.querySelector("canvas");
    if (!sourceCanvas || typeof sourceCanvas.captureStream !== "function") {
      return null;
    }

    stopRecordCanvasPump();
    const { width, height } = parseRecordSize();
    recordCanvas = document.createElement("canvas");
    recordCanvas.width = width;
    recordCanvas.height = height;
    const ctx = recordCanvas.getContext("2d", { alpha: false });
    if (!ctx || typeof recordCanvas.captureStream !== "function") {
      return sourceCanvas.captureStream(60);
    }

    const draw = () => {
      drawCoverFrame(ctx, sourceCanvas, width, height);
      recordFrameId = requestAnimationFrame(draw);
    };
    draw();
    return recordCanvas.captureStream(60);
  } catch {
    return null;
  }
}

function isSupportedMimeType(type) {
  try {
    return MediaRecorder.isTypeSupported(type);
  } catch {
    return false;
  }
}

function pickMimeType(format) {
  const preferred = format === "mp4" ? MP4_MIME_TYPES : WEBM_MIME_TYPES;
  const fallback = format === "mp4" ? WEBM_MIME_TYPES : [];
  const nativeType = preferred.find(isSupportedMimeType);
  if (nativeType) {
    return {
      mimeType: nativeType,
      extension: format,
      needsConversion: false
    };
  }
  const fallbackType = fallback.find(isSupportedMimeType);
  return {
    mimeType: fallbackType || "",
    extension: "webm",
    needsConversion: format === "mp4"
  };
}

function extensionForMimeType(mimeType) {
  return /video\/mp4/i.test(mimeType || "") ? "mp4" : "webm";
}

async function convertWebmToMp4(blob) {
  const response = await fetch(appApiUrl("/api/convert-mp4"), {
    method: "POST",
    headers: {
      "Content-Type": blob.type || "video/webm"
    },
    body: blob
  });
  if (!response.ok) {
    let message = "";
    try {
      const data = await response.json();
      message = data.error || "";
    } catch {
      message = await response.text();
    }
    if (response.status === 404) {
      message = "Restart MotionAM to enable MP4 conversion.";
    }
    throw new Error(message || "MP4 conversion failed.");
  }
  return response.blob();
}

function publishVideoDownload(blob, extension) {
  if (lastVideoUrl) URL.revokeObjectURL(lastVideoUrl);
  lastVideoUrl = URL.createObjectURL(blob);
  els.downloadLink.href = lastVideoUrl;
  els.downloadLink.download = `motionam-${Date.now()}.${extension}`;
  els.downloadLink.title = `Download ${extension.toUpperCase()} video`;
  els.downloadLink.setAttribute("aria-label", `Download ${extension.toUpperCase()} video`);
  els.downloadLink.classList.remove("disabled");
}

async function finishRecording(recorder, pickedFormat, requestedFormat) {
  const recorderMimeType = recorder?.mimeType || pickedFormat.mimeType || "video/webm";
  const rawBlob = new Blob(mediaChunks, { type: recorderMimeType });
  const rawExtension = extensionForMimeType(recorderMimeType);

  if (requestedFormat === "mp4" && rawExtension !== "mp4") {
    setStatus("Preparing MP4");
    try {
      const mp4Blob = await convertWebmToMp4(rawBlob);
      publishVideoDownload(mp4Blob, "mp4");
      setStatus("MP4 ready");
      showToast("MP4 ready for Premiere.");
      return;
    } catch (error) {
      publishVideoDownload(rawBlob, "webm");
      setStatus("WebM ready");
      showToast(`${error.message} WebM download is ready.`, { persistent: true, tone: "error" });
      return;
    }
  }

  publishVideoDownload(rawBlob, rawExtension);
  setStatus(rawExtension === "mp4" ? "MP4 ready" : "WebM ready");
  showToast(rawExtension === "mp4" ? "MP4 ready for Premiere." : "WebM video ready.");
}

async function startRecording() {
  if (mediaRecorder && mediaRecorder.state !== "inactive") return;
  if (!window.MediaRecorder) {
    showToast("Recording is not supported in this browser.", { persistent: true, tone: "error" });
    return;
  }

  await runPreview();
  await new Promise((resolve) => requestAnimationFrame(() => resolve()));

  let stream = getCanvasStream();
  let mode = "canvas";
  if (!stream) {
    mode = "screen";
    if (!navigator.mediaDevices?.getDisplayMedia) {
      showToast("Use a browser with tab recording support.", { persistent: true, tone: "error" });
      return;
    }
    const { width, height } = parseRecordSize();
    stream = await navigator.mediaDevices.getDisplayMedia({
      video: {
        frameRate: 60,
        width: { ideal: width },
        height: { ideal: height }
      },
      audio: false
    });
  }

  mediaChunks = [];
  activeStream = stream;
  const requestedFormat = getExportFormat();
  const pickedFormat = pickMimeType(requestedFormat);
  mediaRecorder = new MediaRecorder(stream, pickedFormat.mimeType ? { mimeType: pickedFormat.mimeType } : undefined);

  mediaRecorder.addEventListener("dataavailable", (event) => {
    if (event.data && event.data.size > 0) {
      mediaChunks.push(event.data);
    }
  });

  mediaRecorder.addEventListener("stop", () => {
    const recorder = mediaRecorder;
    finishRecording(recorder, pickedFormat, requestedFormat)
      .catch((error) => {
        setStatus("Recording failed");
        showToast(error.message || "Recording failed.", { persistent: true, tone: "error" });
      })
      .finally(() => {
        stopRecordCanvasPump();
        activeStream?.getTracks().forEach((track) => track.stop());
        activeStream = null;
        mediaRecorder = null;
        window.clearTimeout(recordTimer);
        els.recordButton.classList.remove("recording");
        els.stopButton.disabled = true;
        els.recordButton.disabled = false;
      });
  });

  mediaRecorder.start(250);
  els.recordButton.classList.add("recording");
  els.recordButton.disabled = true;
  els.stopButton.disabled = false;
  els.downloadLink.classList.add("disabled");
  const formatLabel = requestedFormat === "mp4" && pickedFormat.needsConversion ? "MP4 after conversion" : requestedFormat.toUpperCase();
  setStatus(`${mode === "canvas" ? "Recording canvas" : "Recording screen"} (${formatLabel})`);

  const durationMs = Math.max(1, Number(els.durationInput.value || 10)) * 1000;
  recordTimer = window.setTimeout(stopRecording, durationMs + 350);
}

function stopRecording() {
  if (mediaRecorder && mediaRecorder.state !== "inactive") {
    mediaRecorder.stop();
  }
}

function saveProject() {
  const state = getProjectState();
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  const recent = saveRecentProject(state);
  const blob = new Blob([JSON.stringify(state, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "motionam-project.json";
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
  showToast(`Project saved: ${recent.title}`);
}

async function loadLocalProject() {
  try {
    const state = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
    if (state.code || state.prompt) {
      pushUndoSnapshot("Load saved project");
      applyProjectState(state);
      await runPreview({ autoplay: false });
      showPreview();
      showToast("Saved project loaded.");
      return;
    }
  } catch {
    localStorage.removeItem(STORAGE_KEY);
  }
  els.projectFileInput.click();
}

function importProject(file) {
  const reader = new FileReader();
  reader.addEventListener("load", () => {
    try {
      const state = JSON.parse(String(reader.result || "{}"));
      pushUndoSnapshot("Import project");
      applyProjectState(state);
      runPreview();
      saveRecentProject(state);
      showToast("Project imported.");
    } catch {
      showToast("That project file could not be opened.", { persistent: true, tone: "error" });
    }
  });
  reader.readAsText(file);
}

function newProject() {
  pushUndoSnapshot("New project");
  els.promptInput.value = examples[0];
  els.editInput.value = "";
  if (els.engineModeSelect) {
    els.engineModeSelect.value = "scene";
  }
  els.durationInput.value = 10;
  els.sizeSelect.value = "1920x1080";
  els.recordSizeSelect.value = "render";
  els.exportFormatSelect.value = "mp4";
  els.styleSelect.value = "kinetic";
  fitPreviewZoom();
  setCode(emptyScene());
  updateTimelineControls(0);
  setStatus("Ready to generate");
  showToast("New project ready.");
}

function cycleExample() {
  const current = examples.indexOf(els.promptInput.value);
  els.promptInput.value = examples[(current + 1) % examples.length];
}

function bindEvents() {
  els.generateButton.addEventListener("click", generateMotion);
  els.editButton.addEventListener("click", editCurrentMotion);
  els.runButton.addEventListener("click", () => {
    if (isEmptySceneCode(els.codeEditor.value)) {
      generateMotion();
      return;
    }
    runPreview();
  });
  els.zoomOutButton.addEventListener("click", () => setPreviewZoom(currentPreviewScale() / 1.2));
  els.fitZoomButton.addEventListener("click", fitPreviewZoom);
  els.zoomInButton.addEventListener("click", () => setPreviewZoom(currentPreviewScale() * 1.2));
  els.timelinePlayButton.addEventListener("click", toggleTimelinePlayback);
  els.timelineSlider.addEventListener("input", () => {
    stopTimelinePlayback({ send: false });
    setTimelineTime(Number(els.timelineSlider.value) * 1000, { paused: true, send: true });
    setStatus("Preview paused");
  });
  els.recordButton.addEventListener("click", () => startRecording().catch((error) => showToast(error.message, { persistent: true, tone: "error" })));
  els.stopButton.addEventListener("click", stopRecording);
  els.previewTab.addEventListener("click", showPreview);
  els.codeTab.addEventListener("click", showCode);
  els.exampleButton.addEventListener("click", cycleExample);
  els.undoButton?.addEventListener("click", () => {
    undoLastChange().catch((error) => showToast(error.message || "Undo failed.", { persistent: true, tone: "error" }));
  });
  els.newProjectButton.addEventListener("click", newProject);
  els.saveProjectButton.addEventListener("click", saveProject);
  els.loadProjectButton.addEventListener("click", () => {
    loadLocalProject().catch((error) => showToast(error.message || "Project could not be loaded.", { persistent: true, tone: "error" }));
  });
  els.recentProjectSelect?.addEventListener("change", () => {
    if (!els.recentProjectSelect.value) return;
    loadRecentProject(els.recentProjectSelect.value).catch((error) => showToast(error.message || "Recent project could not be loaded.", { persistent: true, tone: "error" }));
  });
  els.projectFileInput.addEventListener("change", () => {
    const [file] = els.projectFileInput.files || [];
    if (file) importProject(file);
    els.projectFileInput.value = "";
  });

  els.providerSelect.addEventListener("change", () => {
    applyProviderDefaults(true);
    persistSettings();
  });

  els.engineModeSelect?.addEventListener("change", () => {
    persistSettings();
    if (!isEmptySceneCode(els.codeEditor.value)) {
      runPreview();
    }
  });

  els.sizeSelect.addEventListener("change", () => {
    fitPreviewZoom();
    runPreview();
    persistSettings();
  });

  els.recordSizeSelect.addEventListener("change", persistSettings);
  els.exportFormatSelect.addEventListener("change", persistSettings);
  els.apiKeyInput.addEventListener("input", () => {
    setSessionApiKey(els.providerSelect.value, els.apiKeyInput.value);
  });

  els.durationInput.addEventListener("change", () => {
    updateTimelineControls(timelineCurrentMs);
    persistSettings();
  });

  [els.styleSelect, els.modelInput, els.endpointInput, els.useAiToggle].forEach((el) => {
    el.addEventListener("change", persistSettings);
  });

  window.addEventListener("resize", updatePreviewView);
}

function boot() {
  loadSettings();
  applyProviderDefaults(false);
  bindEvents();
  renderRecentProjects();
  updateUndoButton();
  setCode(els.codeEditor.value || emptyScene(), true);
  showPreview();
  updatePreviewView();
  updateTimelineControls(0);
}

boot();

import { createServer } from "node:http";
import { spawn } from "node:child_process";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { extname, join, normalize } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL(".", import.meta.url));
const port = Number(process.env.PORT || process.argv[2] || 4173);

const types = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".webm": "video/webm",
  ".mp4": "video/mp4"
};

const MAX_JSON_BYTES = 1_000_000;
const MAX_VIDEO_BYTES = 750_000_000;
const ALLOWED_DEEPSEEK_HOSTS = new Set(["api.deepseek.com"]);
const ALLOWED_GEMINI_HOSTS = new Set(["generativelanguage.googleapis.com"]);
const ALLOWED_OLLAMA_HOSTS = new Set(["127.0.0.1", "localhost", "[::1]"]);
const ALLOWED_OPENROUTER_HOSTS = new Set(["openrouter.ai"]);

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization"
};

function writeHead(response, status, headers = {}) {
  response.writeHead(status, {
    ...corsHeaders,
    ...headers
  });
}

function sendJson(response, status, body) {
  writeHead(response, status, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store"
  });
  response.end(JSON.stringify(body));
}

function readJson(request) {
  return new Promise((resolve, reject) => {
    let size = 0;
    let body = "";
    request.setEncoding("utf8");
    request.on("data", (chunk) => {
      size += chunk.length;
      if (size > MAX_JSON_BYTES) {
        reject(new Error("Request is too large."));
        request.destroy();
        return;
      }
      body += chunk;
    });
    request.on("end", () => {
      try {
        resolve(JSON.parse(body || "{}"));
      } catch {
        reject(new Error("Request body is not valid JSON."));
      }
    });
    request.on("error", reject);
  });
}

function readBinary(request) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    request.on("data", (chunk) => {
      size += chunk.length;
      if (size > MAX_VIDEO_BYTES) {
        reject(new Error("Video is too large to convert."));
        request.destroy();
        return;
      }
      chunks.push(chunk);
    });
    request.on("end", () => resolve(Buffer.concat(chunks)));
    request.on("error", reject);
  });
}

function normalizeProvider(provider) {
  if (provider === "deepseek" || provider === "gemini" || provider === "openrouter") {
    return provider;
  }
  return "ollama";
}

function normalizeEndpoint(endpoint, provider) {
  const providerId = normalizeProvider(provider);
  const fallbacks = {
    ollama: "http://127.0.0.1:11434/api/chat",
    openrouter: "https://openrouter.ai/api/v1/chat/completions",
    gemini: "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions",
    deepseek: "https://api.deepseek.com/chat/completions"
  };
  const fallback = fallbacks[providerId];
  const value = String(endpoint || "").trim() || fallback;
  const url = new URL(value);

  if (providerId === "ollama") {
    if (!ALLOWED_OLLAMA_HOSTS.has(url.hostname)) {
      throw new Error("Ollama must use a local endpoint.");
    }
    if (url.protocol !== "http:" && url.protocol !== "https:") {
      throw new Error("The Ollama endpoint must use HTTP or HTTPS.");
    }
    if (url.pathname !== "/api/chat" && url.pathname !== "/v1/chat/completions") {
      throw new Error("Use Ollama's /api/chat or /v1/chat/completions endpoint.");
    }
    return url.toString();
  }

  if (providerId === "gemini") {
    if (!ALLOWED_GEMINI_HOSTS.has(url.hostname)) {
      throw new Error("Only the official Gemini API host is allowed.");
    }
    if (url.protocol !== "https:") {
      throw new Error("The Gemini endpoint must use HTTPS.");
    }
    if (url.pathname === "/" || url.pathname === "/v1beta/openai" || url.pathname === "/v1beta/openai/") {
      url.pathname = "/v1beta/openai/chat/completions";
    }
    if (url.pathname === "/v1beta/openai/chat/completions/") {
      url.pathname = "/v1beta/openai/chat/completions";
    }
    if (url.pathname !== "/v1beta/openai/chat/completions") {
      throw new Error("Use the Gemini OpenAI-compatible chat completions endpoint.");
    }
    return url.toString();
  }

  if (providerId === "openrouter") {
    if (!ALLOWED_OPENROUTER_HOSTS.has(url.hostname)) {
      throw new Error("Only the official OpenRouter API host is allowed.");
    }
    if (url.protocol !== "https:") {
      throw new Error("The OpenRouter endpoint must use HTTPS.");
    }
    if (url.pathname === "/" || url.pathname === "/api/v1" || url.pathname === "/api/v1/") {
      url.pathname = "/api/v1/chat/completions";
    }
    if (url.pathname === "/api/v1/chat/completions/") {
      url.pathname = "/api/v1/chat/completions";
    }
    if (url.pathname !== "/api/v1/chat/completions") {
      throw new Error("Use the OpenRouter chat completions endpoint.");
    }
    return url.toString();
  }

  if (!ALLOWED_DEEPSEEK_HOSTS.has(url.hostname)) {
    throw new Error("Only the official DeepSeek API host is allowed.");
  }
  if (url.protocol !== "https:") {
    throw new Error("The DeepSeek endpoint must use HTTPS.");
  }
  if (url.pathname === "/v1/chat/completions") {
    url.pathname = "/chat/completions";
  }
  if (url.pathname !== "/chat/completions") {
    throw new Error("Use the DeepSeek chat completions endpoint.");
  }
  return url.toString();
}

function normalizeModel(model, provider) {
  const value = String(model || "").trim();
  const providerId = normalizeProvider(provider);
  if (!value || value === "deepseek-v4") {
    if (providerId === "ollama") return "llama3.2:3b";
    if (providerId === "openrouter") return "openrouter/auto";
    if (providerId === "gemini") return "gemini-3.5-flash";
    return "deepseek-v4-flash";
  }
  return value;
}

function parseProviderError(text) {
  let detail = text.slice(0, 300);
  try {
    const parsed = JSON.parse(text);
    detail = parsed?.error?.message || parsed?.message || detail;
  } catch {
    // Keep the text fallback.
  }
  return detail;
}

async function postJsonWithFetch(endpoint, apiKey, body) {
  const headers = { "Content-Type": "application/json" };
  if (apiKey) {
    headers.Authorization = `Bearer ${apiKey}`;
  }
  const upstream = await fetch(endpoint, {
    method: "POST",
    headers,
    body: JSON.stringify(body)
  });

  return {
    ok: upstream.ok,
    status: upstream.status,
    contentType: upstream.headers.get("content-type") || "application/json; charset=utf-8",
    text: await upstream.text()
  };
}

function postJsonWithPowerShell(endpoint, apiKey, body) {
  const script = `
$ErrorActionPreference = "Stop"
$inputJson = [Console]::In.ReadToEnd()
$payload = $inputJson | ConvertFrom-Json
$headers = @{}
if ($payload.apiKey) {
  $headers.Authorization = "Bearer " + $payload.apiKey
}
$requestBody = $payload.body | ConvertTo-Json -Depth 40 -Compress
try {
  $response = Invoke-WebRequest -UseBasicParsing -Uri $payload.endpoint -Method POST -Headers $headers -ContentType "application/json" -Body $requestBody -TimeoutSec 120
  [pscustomobject]@{
    ok = $true
    status = [int]$response.StatusCode
    contentType = [string]$response.Headers["Content-Type"]
    text = [string]$response.Content
  } | ConvertTo-Json -Compress -Depth 6
} catch {
  $status = 502
  $text = $_.Exception.Message
  if ($_.Exception.Response) {
    $status = [int]$_.Exception.Response.StatusCode
    $reader = New-Object System.IO.StreamReader($_.Exception.Response.GetResponseStream())
    $text = $reader.ReadToEnd()
  }
  [pscustomobject]@{
    ok = $false
    status = $status
    contentType = "application/json; charset=utf-8"
    text = [string]$text
  } | ConvertTo-Json -Compress -Depth 6
}
`;

  return new Promise((resolve, reject) => {
    const child = spawn("powershell", ["-NoProfile", "-NonInteractive", "-ExecutionPolicy", "Bypass", "-Command", script], {
      windowsHide: true
    });
    let stdout = "";
    let stderr = "";

    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stdout.on("data", (chunk) => {
      stdout += chunk;
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk;
    });
    child.on("error", reject);
    child.on("close", (code) => {
      if (code !== 0) {
        reject(new Error(stderr.trim() || "PowerShell relay failed."));
        return;
      }
      try {
        resolve(JSON.parse(stdout));
      } catch {
        reject(new Error("PowerShell relay returned an unreadable response."));
      }
    });
    child.stdin.end(JSON.stringify({ endpoint, apiKey, body }));
  });
}

async function postJson(endpoint, apiKey, body) {
  try {
    return await postJsonWithFetch(endpoint, apiKey, body);
  } catch (error) {
    if (error?.message !== "fetch failed" && error?.cause?.code !== "EACCES") {
      throw error;
    }
    return postJsonWithPowerShell(endpoint, apiKey, body);
  }
}

function buildProviderBody(provider, endpoint, model, messages, temperature) {
  if (normalizeProvider(provider) === "ollama") {
    if (new URL(endpoint).pathname === "/v1/chat/completions") {
      return {
        model,
        messages,
        temperature,
        stream: false
      };
    }
    return {
      model,
      messages,
      stream: false,
      options: { temperature }
    };
  }
  return {
    model,
    messages,
    temperature,
    stream: false
  };
}

function normalizeProviderResponse(provider, upstream) {
  if (normalizeProvider(provider) !== "ollama") {
    return upstream.text;
  }

  try {
    const data = JSON.parse(upstream.text);
    const content = data?.choices?.[0]?.message?.content || data?.message?.content || data?.response || "";
    return JSON.stringify({
      choices: [
        {
          message: {
            role: "assistant",
            content
          }
        }
      ],
      provider: "ollama"
    });
  } catch {
    return upstream.text;
  }
}

async function handleGenerate(request, response) {
  try {
    const body = await readJson(request);
    const provider = normalizeProvider(body.provider);
    const endpoint = normalizeEndpoint(body.endpoint, provider);
    const model = normalizeModel(body.model, provider);
    const apiKey = String(body.apiKey || "").trim();
    const messages = Array.isArray(body.messages) ? body.messages : [];

    if (provider !== "ollama" && !apiKey) {
      const names = { gemini: "Gemini", deepseek: "DeepSeek", openrouter: "OpenRouter" };
      const name = names[provider] || "AI";
      sendJson(response, 400, { error: `Add your ${name} API key first.` });
      return;
    }

    if (!messages.length) {
      sendJson(response, 400, { error: "Add a prompt before generating." });
      return;
    }

    const temperature = Number.isFinite(body.temperature) ? body.temperature : 0.7;
    const upstream = await postJson(endpoint, apiKey, buildProviderBody(provider, endpoint, model, messages, temperature));

    if (!upstream.ok) {
      const detail = parseProviderError(upstream.text);
      const names = { ollama: "Ollama", gemini: "Gemini", deepseek: "DeepSeek", openrouter: "OpenRouter" };
      const name = names[provider] || "AI";
      sendJson(response, upstream.status, { error: `${name} request failed (${upstream.status}). ${detail}` });
      return;
    }

    writeHead(response, 200, {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store"
    });
    response.end(normalizeProviderResponse(provider, upstream));
  } catch (error) {
    sendJson(response, 500, { error: error.message || "AI request failed." });
  }
}

function runFfmpeg(inputPath, outputPath) {
  const ffmpeg = process.env.FFMPEG_PATH || "ffmpeg";
  const args = [
    "-y",
    "-i",
    inputPath,
    "-c:v",
    "libx264",
    "-preset",
    "veryfast",
    "-crf",
    "18",
    "-pix_fmt",
    "yuv420p",
    "-movflags",
    "+faststart",
    "-an",
    outputPath
  ];

  return new Promise((resolve, reject) => {
    const child = spawn(ffmpeg, args, { windowsHide: true });
    let stderr = "";
    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
      stderr = stderr.slice(-5000);
    });
    child.on("error", (error) => {
      if (error.code === "ENOENT") {
        reject(new Error("Install FFmpeg, then restart MotionAM to create MP4 files."));
        return;
      }
      reject(error);
    });
    child.on("close", (code) => {
      if (code === 0) {
        resolve();
        return;
      }
      reject(new Error(stderr.trim() || "FFmpeg could not convert the video."));
    });
  });
}

async function handleConvertMp4(request, response) {
  let workDir = "";
  try {
    const input = await readBinary(request);
    if (!input.length) {
      sendJson(response, 400, { error: "No video was received." });
      return;
    }

    workDir = join(tmpdir(), `motionam-${randomUUID()}`);
    await mkdir(workDir, { recursive: true });
    const inputPath = join(workDir, "input.webm");
    const outputPath = join(workDir, "output.mp4");
    await writeFile(inputPath, input);
    await runFfmpeg(inputPath, outputPath);
    const output = await readFile(outputPath);

    writeHead(response, 200, {
      "Content-Type": "video/mp4",
      "Content-Disposition": `attachment; filename="motionam-${Date.now()}.mp4"`,
      "Cache-Control": "no-store"
    });
    response.end(output);
  } catch (error) {
    sendJson(response, 500, { error: error.message || "MP4 conversion failed." });
  } finally {
    if (workDir) {
      await rm(workDir, { recursive: true, force: true }).catch(() => {});
    }
  }
}

function resolvePath(url) {
  const parsed = new URL(url, `http://localhost:${port}`);
  const pathname = decodeURIComponent(parsed.pathname);
  const relative = pathname === "/" ? "index.html" : pathname.slice(1);
  const fullPath = normalize(join(root, relative));
  if (!fullPath.startsWith(root)) {
    return null;
  }
  return fullPath;
}

const server = createServer(async (request, response) => {
  if (request.method === "OPTIONS") {
    writeHead(response, 204);
    response.end();
    return;
  }

  if (request.method === "POST" && request.url === "/api/generate") {
    await handleGenerate(request, response);
    return;
  }

  if (request.method === "POST" && request.url === "/api/convert-mp4") {
    await handleConvertMp4(request, response);
    return;
  }

  const fullPath = resolvePath(request.url || "/");
  if (!fullPath) {
    writeHead(response, 403);
    response.end("Forbidden");
    return;
  }

  try {
    const data = await readFile(fullPath);
    writeHead(response, 200, {
      "Content-Type": types[extname(fullPath)] || "application/octet-stream",
      "Cache-Control": "no-store"
    });
    response.end(data);
  } catch {
    writeHead(response, 404, { "Content-Type": "text/plain; charset=utf-8" });
    response.end("Not found");
  }
});

server.listen(port, "127.0.0.1", () => {
  console.log(`MotionAM running at http://127.0.0.1:${port}`);
});

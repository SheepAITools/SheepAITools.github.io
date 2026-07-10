import assert from "node:assert/strict"
import { mkdir, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import test from "node:test"
import { build } from "esbuild"

const outdir = join(tmpdir(), "sheepai-tools-tests")
await mkdir(outdir, { recursive: true })
const outfile = join(outdir, "genericAiClient.test-bundle.mjs")

await build({
  entryPoints: ["src/lib/genericAiClient.ts"],
  outfile,
  bundle: true,
  format: "esm",
  platform: "browser",
  external: ["@/types/sheepai"],
  alias: {
    "@": join(process.cwd(), "src"),
  },
  logLevel: "silent",
})

const module = await import(`${outfile}?t=${Date.now()}`)
const {
  resolveOpenAiToolEndpoint,
  buildOpenAiToolPayload,
  resolveGeminiEndpoint,
  buildGeminiPayload,
} = module

const textTool = {
  id: "translation",
  modelFilter: "text",
  systemPrompt: "translate",
  buildUserPrompt: (inputText) => inputText,
}

const imageGenerateTool = {
  id: "image-generate",
  modelFilter: "image-gen",
  systemPrompt: "",
  buildUserPrompt: (inputText) => inputText,
  supportsImageOutput: true,
}

const imageEditTool = {
  id: "image-edit",
  modelFilter: "image-edit",
  systemPrompt: "",
  buildUserPrompt: (inputText) => `请根据以下指令编辑图片：${inputText}`,
  supportsImageInput: true,
  supportsImageOutput: true,
}

const openAiModel = {
  id: "gpt-image-1",
  baseUrl: "https://api.example.test/v1",
  requestPath: "/chat/completions",
  defaultTemperature: 0.3,
}

test("routes OpenAI-compatible text tools to chat completions", () => {
  assert.equal(
    resolveOpenAiToolEndpoint({ ...openAiModel, id: "gpt-4o-mini" }, textTool),
    "https://api.example.test/v1/chat/completions",
  )
})

test("routes OpenAI-compatible image generation tools to image generations", () => {
  assert.equal(
    resolveOpenAiToolEndpoint(openAiModel, imageGenerateTool),
    "https://api.example.test/v1/images/generations",
  )
})

test("routes OpenAI-compatible image edit tools to image edits", () => {
  assert.equal(
    resolveOpenAiToolEndpoint(openAiModel, imageEditTool),
    "https://api.example.test/v1/images/edits",
  )
})

test("builds image generation payload with prompt instead of chat messages", () => {
  assert.deepEqual(
    buildOpenAiToolPayload({
      model: openAiModel,
      tool: imageGenerateTool,
      inputText: "a cyber sheep",
    }),
    {
      model: "gpt-image-1",
      prompt: "a cyber sheep",
      size: "1024x1536",
      n: 1,
    },
  )
})

test("builds OpenAI JSON headers with accept", () => {
  assert.deepEqual(
    module.buildOpenAiJsonHeaders("sk-test"),
    {
      Accept: "application/json",
      Authorization: "Bearer sk-test",
      "Content-Type": "application/json",
    },
  )
})

test("normalizes image output without corrupting URLs", () => {
  assert.equal(
    module.normalizeToolImageOutput("https://cdn.example.test/image.png"),
    "https://cdn.example.test/image.png",
  )
  assert.equal(
    module.normalizeToolImageOutput("YmFzZTY0"),
    "data:image/png;base64,YmFzZTY0",
  )
})

test("builds image edit payload as form data", () => {
  const payload = buildOpenAiToolPayload({
    model: openAiModel,
    tool: imageEditTool,
    inputText: "remove background",
    imageBase64: "aW1hZ2U=",
    imageMimeType: "image/png",
  })

  assert.equal(payload instanceof FormData, true)
  assert.equal(payload.get("model"), "gpt-image-1")
  assert.equal(payload.get("prompt"), "请根据以下指令编辑图片：remove background")
  assert.equal(payload.get("image") instanceof Blob, true)
})

test("routes Gemini-compatible models to generateContent", () => {
  assert.equal(
    resolveGeminiEndpoint({
      id: "gemini-3-pro-image-preview",
      baseUrl: "https://generativelanguage.googleapis.com/v1beta",
      requestPath: ":generateContent",
    }),
    "https://generativelanguage.googleapis.com/v1beta/models/gemini-3-pro-image-preview:generateContent",
  )
})

test("preserves complete Gemini generateContent URLs", () => {
  assert.equal(
    resolveGeminiEndpoint({
      id: "gemini-3-pro-image-preview",
      baseUrl: "https://generativelanguage.googleapis.com/v1beta/models/gemini-3-pro-image-preview:generateContent",
      requestPath: ":generateContent",
    }),
    "https://generativelanguage.googleapis.com/v1beta/models/gemini-3-pro-image-preview:generateContent",
  )
})

test("builds Gemini image payload with inline data", () => {
  assert.deepEqual(
    buildGeminiPayload({
      model: {
        id: "gemini-3-pro-image-preview",
        defaultTemperature: 0.3,
      },
      tool: imageEditTool,
      inputText: "make it brighter",
      imageBase64: "aW1hZ2U=",
      imageMimeType: "image/png",
    }),
    {
      contents: [
        {
          role: "user",
          parts: [
            {
              inlineData: {
                mimeType: "image/png",
                data: "aW1hZ2U=",
              },
            },
            {
              text: "请根据以下指令编辑图片：make it brighter",
            },
          ],
        },
      ],
      generationConfig: {
        temperature: 0.3,
      },
    },
  )
})

await writeFile(join(outdir, "last-run.txt"), new Date().toISOString())

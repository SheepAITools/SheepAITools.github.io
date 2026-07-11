import assert from "node:assert/strict"
import { mkdir, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import test from "node:test"
import { build } from "esbuild"

const outdir = join(tmpdir(), "sheepai-tools-tests")
await mkdir(outdir, { recursive: true })
const outfile = join(outdir, "agentRunner.test-bundle.mjs")

await build({
  entryPoints: ["src/lib/agentRunner.ts"],
  outfile,
  bundle: true,
  format: "esm",
  platform: "browser",
  external: ["@/types/sheepai"],
  alias: {
    "@": join(process.cwd(), "src"),
  },
  define: {
    "import.meta.env": "{}",
  },
  logLevel: "silent",
})

const module = await import(`${outfile}?t=${Date.now()}`)

test("parses agent plans from fenced JSON", () => {
  const plan = module.parseAgentPlan(`
    下面是计划：
    \`\`\`json
    {
      "summary": "生成两张配图",
      "steps": [
        { "toolId": "image-generate", "input": "清晨草地上的赛博小羊" },
        { "toolId": "image-generate", "input": "夜晚城市里的赛博小羊" }
      ]
    }
    \`\`\`
  `)

  assert.equal(plan.summary, "生成两张配图")
  assert.equal(plan.steps.length, 2)
  assert.equal(plan.steps[0].toolId, "image-generate")
})

test("parses image edit source result references", () => {
  const plan = module.parseAgentPlan(JSON.stringify({
    summary: "修改第二张图",
    steps: [
      { toolId: "image-edit", input: "把背景改成粉色", sourceResultIndex: 2 },
    ],
  }))

  assert.equal(plan.steps[0].toolId, "image-edit")
  assert.equal(plan.steps[0].sourceResultIndex, 2)
})

test("sanitizes plans to known agent tools and caps step count", () => {
  const plan = module.sanitizeAgentPlan({
    summary: "mixed",
    steps: [
      { toolId: "image-generate", input: "one" },
      { toolId: "unknown-tool", input: "two" },
      { toolId: "translation", input: "three" },
      { toolId: "image-edit", input: "needs upload" },
      { toolId: "summary", input: "four" },
      { toolId: "code-explain", input: "five" },
      { toolId: "polishing", input: "six" },
      { toolId: "prompt-optimizer", input: "seven" },
    ],
  })

  assert.deepEqual(
    plan.steps.map((step) => step.toolId),
    ["image-generate", "translation", "image-edit", "summary", "code-explain", "polishing"],
  )
})

test("builds cached sessions without preserving running steps", () => {
  const session = module.normalizeAgentSession({
    id: "session-1",
    userRequest: "make images",
    status: "running",
    updatedAt: 1,
    messages: [{ role: "user", content: "make images", createdAt: 1 }],
    steps: [
      { id: "a", toolId: "image-generate", input: "one", status: "completed", outputText: "", outputImage: "data:image/png;base64,abc" },
      { id: "b", toolId: "image-generate", input: "two", status: "running" },
    ],
  })

  assert.equal(session.status, "interrupted")
  assert.equal(session.steps[0].status, "completed")
  assert.equal(session.steps[1].status, "interrupted")
})

test("selects image-looking custom models for image generation steps", () => {
  const textModel = {
    id: "gpt-4o-mini",
    enabled: true,
    ownedBy: "custom",
    modelType: "文本",
    tags: ["对话"],
    endpointTypes: ["openai"],
  }
  const imageModel = {
    id: "gpt-image-2",
    enabled: true,
    ownedBy: "custom",
    modelType: "文本",
    tags: ["对话"],
    endpointTypes: ["openai"],
  }
  const selected = module.selectAgentModelForTool(
    [textModel, imageModel],
    { id: "image-generate", modelFilter: "image-gen" },
    textModel,
  )

  assert.equal(selected.id, "gpt-image-2")
})

test("excludes image-looking custom models from agent text models", () => {
  const models = [
    {
      id: "gpt-4o-mini",
      enabled: true,
      ownedBy: "custom",
      modelType: "文本",
      tags: ["对话"],
      endpointTypes: ["openai"],
    },
    {
      id: "gpt-image-2",
      enabled: true,
      ownedBy: "custom",
      modelType: "文本",
      tags: ["对话"],
      endpointTypes: ["openai"],
    },
  ]

  assert.deepEqual(module.getAgentTextModels(models).map((model) => model.id), ["gpt-4o-mini"])
})

test("selects models from explicit capability groups before name heuristics", () => {
  const textModel = {
    id: "gpt-5.4",
    enabled: true,
    ownedBy: "custom",
    modelType: "文本",
    tags: ["对话"],
    endpointTypes: ["openai"],
  }
  const imageModel = {
    id: "paint-pro",
    enabled: true,
    ownedBy: "custom",
    modelType: "文本",
    tags: ["对话"],
    endpointTypes: ["openai"],
  }

  const selected = module.selectAgentModelForTool(
    [textModel, imageModel],
    { id: "image-generate", modelFilter: "image-gen" },
    textModel,
    {
      text: ["gpt-5.4"],
      vision: ["gpt-5.4"],
      imageGeneration: ["paint-pro"],
      imageEdit: ["paint-pro"],
      tts: [],
      stt: [],
    },
  )

  assert.equal(selected.id, "paint-pro")
})

test("prepares retry sessions by resetting only failed and interrupted steps", () => {
  const session = module.prepareFailedStepsForRetry({
    id: "session-1",
    userRequest: "make images",
    status: "failed",
    messages: [],
    steps: [
      { id: "done", toolId: "image-generate", input: "done", status: "completed", outputImage: "data:image/png;base64,ok" },
      { id: "failed", toolId: "image-generate", input: "failed", status: "failed", error: "busy" },
      { id: "interrupted", toolId: "image-generate", input: "interrupted", status: "interrupted", error: "refresh" },
    ],
    createdAt: 1,
    updatedAt: 1,
  })

  assert.equal(session.steps[0].status, "completed")
  assert.equal(session.steps[0].outputImage, "data:image/png;base64,ok")
  assert.equal(session.steps[1].status, "pending")
  assert.equal(session.steps[1].error, "")
  assert.equal(session.steps[2].status, "pending")
  assert.equal(session.status, "running")
})

test("marks dependent pending steps as skipped when prerequisites fail", () => {
  const session = module.markBlockedDependentSteps({
    id: "session-1",
    userRequest: "chain",
    status: "running",
    messages: [],
    steps: [
      { id: "first", toolId: "summary", input: "first", status: "failed", error: "bad input" },
      { id: "second", toolId: "polishing", input: "second", status: "pending", dependsOn: ["first"] },
    ],
    createdAt: 1,
    updatedAt: 1,
  })

  assert.equal(session.steps[1].status, "skipped")
  assert.equal(session.steps[1].error, "前置步骤失败，已跳过。")
})

test("builds follow-up planner prompt with image references but without image data", () => {
  const prompt = module.buildAgentPlannerPrompt({
    id: "session-1",
    userRequest: "make images",
    status: "completed",
    summary: "生成四张图",
    messages: [],
    steps: [
      { id: "one", toolId: "image-generate", input: "red cover", status: "completed", outputImage: "data:image/png;base64,AAA" },
      { id: "two", toolId: "image-generate", input: "blue cover", status: "completed", outputImage: "data:image/png;base64,BBB" },
    ],
    createdAt: 1,
    updatedAt: 1,
  }, "把第二张背景改成粉色")

  assert.equal(prompt.includes("data:image"), false)
  assert.equal(prompt.includes("图片 2"), true)
  assert.equal(prompt.includes("blue cover"), true)
  assert.equal(prompt.includes("sourceResultIndex"), true)
})

test("resolves image input from a referenced prior result", () => {
  const imageInput = module.resolveImageInputForStep({
    id: "session-1",
    userRequest: "make images",
    status: "completed",
    messages: [],
    steps: [
      { id: "one", toolId: "image-generate", input: "red cover", status: "completed", outputImage: "data:image/png;base64,AAA" },
      { id: "two", toolId: "image-generate", input: "blue cover", status: "completed", outputImage: "data:image/jpeg;base64,BBB" },
    ],
    createdAt: 1,
    updatedAt: 1,
  }, { id: "edit", toolId: "image-edit", input: "change", status: "pending", sourceResultIndex: 2 })

  assert.deepEqual(imageInput, { base64: "BBB", mimeType: "image/jpeg" })
})

test("prepares follow-up sessions without dropping prior results", () => {
  const session = module.prepareSessionForFollowUp({
    id: "session-1",
    userRequest: "make images",
    status: "completed",
    messages: [{ role: "user", content: "make images", createdAt: 1 }],
    steps: [
      { id: "one", toolId: "image-generate", input: "red cover", status: "completed", outputImage: "data:image/png;base64,AAA" },
    ],
    createdAt: 1,
    updatedAt: 1,
  }, "修改第一张")

  assert.equal(session.steps.length, 1)
  assert.equal(session.steps[0].outputImage, "data:image/png;base64,AAA")
  assert.equal(session.messages.at(-1).content, "修改第一张")
  assert.equal(session.status, "planning")
})

test("identifies follow-up sessions as needing a new plan", () => {
  const session = module.prepareSessionForFollowUp({
    id: "session-1",
    userRequest: "make images",
    status: "completed",
    messages: [],
    steps: [
      { id: "one", toolId: "image-generate", input: "red cover", status: "completed", outputImage: "data:image/png;base64,AAA" },
    ],
    createdAt: 1,
    updatedAt: 1,
  }, "修改第一张")

  assert.equal(module.shouldPlanAgentSession(session), true)
})

await writeFile(join(outdir, "agent-runner-last-run.txt"), new Date().toISOString())

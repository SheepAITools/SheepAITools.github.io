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
    ["image-generate", "translation", "summary", "code-explain", "polishing", "prompt-optimizer"],
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

await writeFile(join(outdir, "agent-runner-last-run.txt"), new Date().toISOString())

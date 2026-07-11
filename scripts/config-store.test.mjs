import assert from "node:assert/strict"
import { mkdir, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import test from "node:test"
import { build } from "esbuild"

const outdir = join(tmpdir(), "sheepai-tools-tests")
await mkdir(outdir, { recursive: true })
const outfile = join(outdir, "configStore.test-bundle.mjs")

await build({
  entryPoints: ["src/lib/configStore.ts"],
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

test("migrates legacy modelIds into capability groups", () => {
  const config = module.normalizeConfigForTest({
    id: "legacy",
    name: "Legacy",
    apiBaseUrl: "https://api.example.test/v1",
    apiKey: "sk-test",
    interfaceFormat: "openai-compatible",
    modelIds: ["gpt-5.4", "gpt-image-2"],
    selectedModelId: "gpt-5.4",
    timeoutSeconds: 600,
    createdAt: 1,
    updatedAt: 1,
  })

  assert.deepEqual(config.modelIdGroups.text, ["gpt-5.4"])
  assert.deepEqual(config.modelIdGroups.vision, ["gpt-5.4"])
  assert.deepEqual(config.modelIdGroups.imageGeneration, ["gpt-image-2"])
  assert.deepEqual(config.modelIdGroups.imageEdit, ["gpt-image-2"])
  assert.deepEqual(config.modelIds, ["gpt-5.4", "gpt-image-2"])
})

test("builds flat model list from grouped model IDs", () => {
  const draft = module.createEmptyConfigDraft()
  const config = module.buildConfigFromDraft({
    ...draft,
    modelIdGroups: {
      text: ["gpt-5.4"],
      vision: ["gpt-5.4"],
      imageGeneration: ["gpt-image-2"],
      imageEdit: ["gpt-image-2"],
      tts: [],
      stt: [],
    },
    selectedModelId: "gpt-5.4",
  })

  assert.deepEqual(config.modelIds, ["gpt-5.4", "gpt-image-2"])
  assert.deepEqual(config.modelIdGroups.imageEdit, ["gpt-image-2"])
})

await writeFile(join(outdir, "config-store-last-run.txt"), new Date().toISOString())

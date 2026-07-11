import assert from "node:assert/strict"
import { mkdir, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import test from "node:test"
import { build } from "esbuild"

const outdir = join(tmpdir(), "sheepai-tools-tests")
await mkdir(outdir, { recursive: true })
const outfile = join(outdir, "modelFiltering.test-bundle.mjs")

await build({
  entryPoints: ["src/data/models.ts"],
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

test("filters models by explicit capability groups", () => {
  const models = module.buildModelOptions(["gpt-5.4", "gpt-image-2"], {
    apiBaseUrl: "https://api.example.test/v1",
    interfaceFormat: "openai-compatible",
    modelIdGroups: {
      text: ["gpt-5.4"],
      vision: ["gpt-5.4"],
      imageGeneration: ["gpt-image-2"],
      imageEdit: ["gpt-image-2"],
      tts: [],
      stt: [],
    },
  })

  assert.deepEqual(module.filterModelsForTool(models, "text").map((model) => model.id), ["gpt-5.4"])
  assert.deepEqual(module.filterModelsForTool(models, "image-vision").map((model) => model.id), ["gpt-5.4"])
  assert.deepEqual(module.filterModelsForTool(models, "image-gen").map((model) => model.id), ["gpt-image-2"])
  assert.deepEqual(module.filterModelsForTool(models, "image-edit").map((model) => model.id), ["gpt-image-2"])
})

await writeFile(join(outdir, "model-filtering-last-run.txt"), new Date().toISOString())

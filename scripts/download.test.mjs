import assert from "node:assert/strict"
import { mkdir } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import test from "node:test"
import { build } from "esbuild"

const outdir = join(tmpdir(), "sheepai-tools-tests")
await mkdir(outdir, { recursive: true })
const outfile = join(outdir, "download.test-bundle.mjs")

await build({
  entryPoints: ["src/lib/download.ts"],
  outfile,
  bundle: true,
  format: "esm",
  platform: "browser",
  alias: {
    "@": join(process.cwd(), "src"),
  },
  define: {
    "import.meta.env": "{}",
  },
  logLevel: "silent",
})

const module = await import(`${outfile}?t=${Date.now()}`)

test("builds image download names from data url mime types", () => {
  assert.equal(
    module.buildImageDownloadName("agent-image-1", "data:image/jpeg;base64,abc", 123),
    "agent-image-1-123.jpg",
  )
  assert.equal(
    module.buildImageDownloadName("agent-image-2", "data:image/webp;base64,abc", 456),
    "agent-image-2-456.webp",
  )
})

test("falls back to png for image sources without a known extension", () => {
  assert.equal(
    module.buildImageDownloadName("agent-image", "https://example.test/generated-image", 789),
    "agent-image-789.png",
  )
})

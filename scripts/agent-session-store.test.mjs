import assert from "node:assert/strict"
import { mkdir } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import test from "node:test"
import { build } from "esbuild"

const outdir = join(tmpdir(), "sheepai-tools-tests")
await mkdir(outdir, { recursive: true })
const outfile = join(outdir, "agentSessionStore.test-bundle.mjs")

await build({
  entryPoints: ["src/lib/agentSessionStore.ts"],
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

function createRequest() {
  return {
    onsuccess: null,
    onerror: null,
    result: undefined,
    error: null,
  }
}

function finishRequest(request, result) {
  queueMicrotask(() => {
    request.result = result
    request.onsuccess?.({ target: request })
  })
}

function createFakeIndexedDB() {
  const stores = new Map()
  const db = {
    objectStoreNames: {
      contains(name) {
        return stores.has(name)
      },
    },
    createObjectStore(name) {
      if (!stores.has(name)) stores.set(name, new Map())
    },
    close() {},
    transaction(storeName) {
      const store = stores.get(storeName) ?? new Map()
      stores.set(storeName, store)
      const transaction = {
        oncomplete: null,
        onerror: null,
        error: null,
        objectStore() {
          return {
            get(key) {
              const request = createRequest()
              finishRequest(request, store.get(key))
              return request
            },
            put(record) {
              const request = createRequest()
              queueMicrotask(() => {
                store.set(record.key, record)
                request.result = record.key
                request.onsuccess?.({ target: request })
                transaction.oncomplete?.()
              })
              return request
            },
            delete(key) {
              const request = createRequest()
              queueMicrotask(() => {
                store.delete(key)
                request.result = undefined
                request.onsuccess?.({ target: request })
                transaction.oncomplete?.()
              })
              return request
            },
          }
        },
      }
      return transaction
    },
  }

  return {
    open() {
      const request = createRequest()
      queueMicrotask(() => {
        request.result = db
        request.onupgradeneeded?.({ target: request })
        request.onsuccess?.({ target: request })
      })
      return request
    },
  }
}

function installFakeBrowserStorage() {
  const fakeIndexedDB = createFakeIndexedDB()
  globalThis.indexedDB = fakeIndexedDB
  globalThis.window = {
    indexedDB: fakeIndexedDB,
    localStorage: {
      getItem() {
        return null
      },
      setItem() {
        throw new DOMException("Quota exceeded", "QuotaExceededError")
      },
      removeItem() {},
    },
  }
}

const module = await import(`${outfile}?t=${Date.now()}`)

test("persists image-heavy agent sessions when localStorage quota is unavailable", async () => {
  installFakeBrowserStorage()

  const session = {
    id: "session-image-heavy",
    userRequest: "generate images",
    status: "completed",
    messages: [{ role: "user", content: "generate images", createdAt: 1 }],
    steps: [
      {
        id: "image-1",
        toolId: "image-generate",
        input: "photo",
        status: "completed",
        outputImage: `data:image/png;base64,${"a".repeat(6_000_000)}`,
      },
    ],
    createdAt: 1,
    updatedAt: 2,
  }

  await module.saveAgentSession(session)
  const loaded = await module.loadAgentSession()

  assert.equal(loaded.id, session.id)
  assert.equal(loaded.steps[0].outputImage.length, session.steps[0].outputImage.length)
})

test("loads the latest session after queued updates", async () => {
  installFakeBrowserStorage()

  const firstSession = {
    id: "session-queued",
    userRequest: "generate images",
    status: "failed",
    messages: [],
    steps: [
      { id: "image-1", toolId: "image-generate", input: "photo", status: "completed", outputImage: "data:image/png;base64,a" },
      { id: "image-2", toolId: "image-generate", input: "photo", status: "failed", error: "busy" },
    ],
    createdAt: 1,
    updatedAt: 2,
  }
  const latestSession = {
    ...firstSession,
    status: "completed",
    steps: firstSession.steps.map((step) => ({ ...step, status: "completed", error: "", outputImage: "data:image/png;base64,b" })),
    updatedAt: 3,
  }

  await Promise.all([
    module.saveAgentSession(firstSession),
    module.saveAgentSession(latestSession),
  ])
  const loaded = await module.loadAgentSession()

  assert.equal(loaded.status, "completed")
  assert.equal(loaded.steps.every((step) => step.status === "completed"), true)
})

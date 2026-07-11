import { normalizeAgentSession, type AgentSession } from "@/lib/agentRunner"

const LEGACY_AGENT_SESSION_KEY = "sheepai-tools-agent-session:v1"
const DB_NAME = "sheepai-tools-agent-session"
const DB_VERSION = 1
const STORE_NAME = "sessions"
const SESSION_KEY = "current"

let writeQueue: Promise<void> = Promise.resolve()

type AgentSessionRecord = {
  key: string
  session: AgentSession
}

function getIndexedDb(): IDBFactory | null {
  if (typeof window === "undefined") return null
  return window.indexedDB ?? null
}

function openAgentSessionDb(): Promise<IDBDatabase> {
  const indexedDb = getIndexedDb()
  if (!indexedDb) return Promise.reject(new Error("IndexedDB is unavailable."))

  return new Promise((resolve, reject) => {
    const request = indexedDb.open(DB_NAME, DB_VERSION)

    request.onupgradeneeded = () => {
      const db = request.result
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: "key" })
      }
    }

    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error ?? new Error("Failed to open agent session store."))
  })
}

function readSessionFromIndexedDb(db: IDBDatabase): Promise<AgentSession | null> {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, "readonly")
    const store = transaction.objectStore(STORE_NAME)
    const request = store.get(SESSION_KEY)

    request.onsuccess = () => {
      const record = request.result as AgentSessionRecord | undefined
      resolve(record?.session ? normalizeAgentSession(record.session) : null)
    }
    request.onerror = () => reject(request.error ?? new Error("Failed to read agent session."))
  })
}

function writeSessionToIndexedDb(db: IDBDatabase, session: AgentSession): Promise<void> {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, "readwrite")
    const store = transaction.objectStore(STORE_NAME)
    const request = store.put({ key: SESSION_KEY, session } satisfies AgentSessionRecord)

    request.onerror = () => reject(request.error ?? new Error("Failed to save agent session."))
    transaction.oncomplete = () => resolve()
    transaction.onerror = () => reject(transaction.error ?? new Error("Failed to save agent session."))
  })
}

function deleteSessionFromIndexedDb(db: IDBDatabase): Promise<void> {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, "readwrite")
    const store = transaction.objectStore(STORE_NAME)
    const request = store.delete(SESSION_KEY)

    request.onerror = () => reject(request.error ?? new Error("Failed to clear agent session."))
    transaction.oncomplete = () => resolve()
    transaction.onerror = () => reject(transaction.error ?? new Error("Failed to clear agent session."))
  })
}

function loadLegacyAgentSession(): AgentSession | null {
  try {
    const raw = window.localStorage.getItem(LEGACY_AGENT_SESSION_KEY)
    if (!raw) return null
    return normalizeAgentSession(JSON.parse(raw))
  } catch {
    return null
  }
}

function saveLegacyAgentSession(session: AgentSession): void {
  try {
    window.localStorage.setItem(LEGACY_AGENT_SESSION_KEY, JSON.stringify(session))
  } catch {
    return
  }
}

function clearLegacyAgentSession(): void {
  try {
    window.localStorage.removeItem(LEGACY_AGENT_SESSION_KEY)
  } catch {
    return
  }
}

export async function loadAgentSession(): Promise<AgentSession | null> {
  await writeQueue.catch(() => undefined)

  try {
    const db = await openAgentSessionDb()
    const session = await readSessionFromIndexedDb(db)
    db.close()
    if (session) return session
  } catch {
    // Fall through to legacy storage for browsers without IndexedDB.
  }

  return loadLegacyAgentSession()
}

async function persistAgentSession(session: AgentSession): Promise<void> {
  try {
    const db = await openAgentSessionDb()
    await writeSessionToIndexedDb(db, session)
    db.close()
    clearLegacyAgentSession()
    return
  } catch {
    saveLegacyAgentSession(session)
  }
}

export function saveAgentSession(session: AgentSession): Promise<void> {
  writeQueue = writeQueue.catch(() => undefined).then(() => persistAgentSession(session))
  return writeQueue
}

async function deletePersistedAgentSession(): Promise<void> {
  try {
    const db = await openAgentSessionDb()
    await deleteSessionFromIndexedDb(db)
    db.close()
  } catch {
    // Legacy cleanup below still handles browsers without IndexedDB.
  }

  clearLegacyAgentSession()
}

export function clearAgentSession(): Promise<void> {
  writeQueue = writeQueue.catch(() => undefined).then(deletePersistedAgentSession)
  return writeQueue
}

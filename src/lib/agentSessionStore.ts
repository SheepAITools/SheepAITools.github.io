import { normalizeAgentSession, type AgentSession } from "@/lib/agentRunner"

const AGENT_SESSION_KEY = "sheepai-tools-agent-session:v1"

export function loadAgentSession(): AgentSession | null {
  try {
    const raw = window.localStorage.getItem(AGENT_SESSION_KEY)
    if (!raw) return null
    return normalizeAgentSession(JSON.parse(raw))
  } catch {
    return null
  }
}

export function saveAgentSession(session: AgentSession): void {
  try {
    window.localStorage.setItem(AGENT_SESSION_KEY, JSON.stringify(session))
  } catch {
    return
  }
}

export function clearAgentSession(): void {
  try {
    window.localStorage.removeItem(AGENT_SESSION_KEY)
  } catch {
    return
  }
}

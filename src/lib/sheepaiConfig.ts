export const SHEEPAI_ORIGIN = "https://www.sheepai.top"

function trimTrailingSlash(value: string): string {
  return value.trim().replace(/\/+$/, "")
}

function readProxyBase(): string {
  const rawProxyBase: string = import.meta.env.VITE_SHEEPAI_PROXY_BASE ?? ""
  return trimTrailingSlash(rawProxyBase)
}

export const SHEEPAI_PROXY_BASE: string = readProxyBase()
export const SHEEPAI_API_BASE: string = SHEEPAI_PROXY_BASE.length > 0 ? SHEEPAI_PROXY_BASE : SHEEPAI_ORIGIN
export const SHEEPAI_MODEL_BASE: string = SHEEPAI_API_BASE
export const GPT_BASE_URL: string = `${SHEEPAI_MODEL_BASE}/v1`
export const CLAUDE_BASE_URL: string = SHEEPAI_MODEL_BASE
export const IS_SHEEPAI_PROXY_ENABLED: boolean = SHEEPAI_PROXY_BASE.length > 0


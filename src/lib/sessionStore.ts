const USER_ID_KEY = "cyber-sheepai-user-id"
const LAST_TOKEN_ID_KEY = "cyber-sheepai-last-token-id"
const LAST_MODEL_ID_KEY = "cyber-sheepai-last-model-id"

function readValue(key: string): string {
  try {
    return window.localStorage.getItem(key) ?? ""
  } catch {
    return ""
  }
}

function writeValue(key: string, value: string): void {
  try {
    const trimmedValue: string = value.trim()
    if (trimmedValue.length > 0) {
      window.localStorage.setItem(key, trimmedValue)
      return
    }
    window.localStorage.removeItem(key)
  } catch {
    return
  }
}

export function loadUserId(): string {
  return readValue(USER_ID_KEY)
}

export function saveUserId(userId: string): void {
  writeValue(USER_ID_KEY, userId)
}

export function clearUserId(): void {
  writeValue(USER_ID_KEY, "")
}

export function loadLastTokenId(): string {
  return readValue(LAST_TOKEN_ID_KEY)
}

export function saveLastTokenId(tokenId: string): void {
  writeValue(LAST_TOKEN_ID_KEY, tokenId)
}

export function loadLastModelId(): string {
  return readValue(LAST_MODEL_ID_KEY)
}

export function saveLastModelId(modelId: string): void {
  writeValue(LAST_MODEL_ID_KEY, modelId)
}

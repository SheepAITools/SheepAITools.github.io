import { API_BASE_URL, systemApiUrl } from "@/lib/apiConfig"
import { buildModelOptions } from "@/data/models"
import type { AccountInfo, ModelDefinition, TokenPage, TokenRecord, TokenUsage } from "@/types/sheepai"

const DEFAULT_TOKEN_PAGE_SIZE = 10

interface SystemApiRequestOptions {
  userId: string
  systemToken: string
}

interface TokenModelOptions extends SystemApiRequestOptions {
  token: TokenRecord
}

interface TokenUsageOptions extends SystemApiRequestOptions {
  tokenId: string
}

type JsonRecord = Record<string, unknown>

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

function asString(value: unknown, fallback: string = ""): string {
  if (typeof value === "string") {
    return value
  }
  if (typeof value === "number" || typeof value === "boolean") {
    return String(value)
  }
  return fallback
}

function asNumber(value: unknown, fallback: number = 0): number {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value
  }
  if (typeof value === "string") {
    const parsedValue: number = Number(value)
    return Number.isFinite(parsedValue) ? parsedValue : fallback
  }
  return fallback
}

function asNullableNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === "") {
    return null
  }
  const parsedValue: number = asNumber(value, Number.NaN)
  return Number.isFinite(parsedValue) ? parsedValue : null
}

function asBoolean(value: unknown, fallback: boolean = true): boolean {
  if (typeof value === "boolean") {
    return value
  }
  if (typeof value === "number") {
    return value !== 0
  }
  if (typeof value === "string") {
    const normalizedValue: string = value.trim().toLowerCase()
    if (["true", "1", "enabled", "active", "valid", "normal"].includes(normalizedValue)) {
      return true
    }
    if (["false", "0", "disabled", "inactive", "expired", "deleted", "forbidden"].includes(normalizedValue)) {
      return false
    }
  }
  return fallback
}

function normalizeCredential(value: string): string {
  return value.trim().replace(/^bearer\s+/i, "").trim()
}

function formatUnixTime(value: unknown): string {
  const timestamp: number | null = asNullableNumber(value)
  if (timestamp === null) {
    return asString(value)
  }
  if (timestamp < 0) {
    return "永不过期"
  }
  if (timestamp === 0) {
    return ""
  }
  const milliseconds: number = timestamp > 10_000_000_000 ? timestamp : timestamp * 1000
  const dateValue: Date = new Date(milliseconds)
  if (Number.isNaN(dateValue.getTime())) {
    return String(timestamp)
  }
  return dateValue.toLocaleString("zh-CN", { hour12: false })
}

function pickRecord(value: unknown): JsonRecord {
  if (!isRecord(value)) {
    return {}
  }

  const dataValue: unknown = value.data
  if (isRecord(dataValue)) {
    return dataValue
  }

  return value
}

function pickArray(value: unknown): unknown[] {
  if (Array.isArray(value)) {
    return value
  }

  if (!isRecord(value)) {
    return []
  }

  const dataValue: unknown = value.data
  if (Array.isArray(dataValue)) {
    return dataValue
  }

  if (isRecord(dataValue)) {
    const dataItems: unknown = dataValue.items ?? dataValue.list ?? dataValue.tokens ?? dataValue.records
    if (Array.isArray(dataItems)) {
      return dataItems
    }
  }

  const itemsValue: unknown = value.items ?? value.list ?? value.tokens ?? value.records
  return Array.isArray(itemsValue) ? itemsValue : []
}

function extractMessageFromBody(body: unknown): string {
  if (!isRecord(body)) {
    return ""
  }

  const messageValue: string = asString(body.message)
  if (messageValue.length > 0) {
    return messageValue
  }

  const msgValue: string = asString(body.msg)
  if (msgValue.length > 0) {
    return msgValue
  }

  const errorValue: unknown = body.error
  if (isRecord(errorValue)) {
    const errorMessage: string = asString(errorValue.message)
    if (errorMessage.length > 0) {
      return errorMessage
    }
  }
  if (typeof errorValue === "string" && errorValue.length > 0) {
    return errorValue
  }

  return asString(body.detail)
}

function hasBusinessFailureSignal(body: unknown): boolean {
  if (!isRecord(body)) {
    return false
  }

  return body.success === false || body.code === false || body.ok === false || body.code === 401 || body.code === 403
}

function buildAuthorizationHeader(credential: string): string {
  return `Bearer ${normalizeCredential(credential)}`
}

function isBrowserLikeRuntime(): boolean {
  return typeof window !== "undefined" && typeof window.location !== "undefined"
}

function getBrowserOriginHint(): string {
  if (!isBrowserLikeRuntime()) {
    return ""
  }

  if (window.location.protocol === "file:") {
    return "当前页面通过 file:// 打开，浏览器 Origin 会是 null，跨域请求通常会被 SheepAI 系统 API 拒绝；请改用 npm run dev、本地 preview 或 HTTPS 静态托管访问。"
  }

  return `当前页面来源为 ${window.location.origin}，需要 SheepAI 系统 API 的 CORS 配置允许该来源及必要请求头：管理 API 需要 Authorization、New-Api-User；模型列表 API 需要 Authorization。`
}

function buildNetworkErrorMessage(path: string, cause: unknown): string {
  const causeMessage: string = cause instanceof Error && cause.message.trim().length > 0 ? cause.message : "浏览器 fetch 请求未获得可读取响应"
  const requestBase: string = API_BASE_URL
  const originHint: string = getBrowserOriginHint()
  const hintSegments: string[] = [
    `浏览器无法连接 SheepAI API（${requestBase}${path}）。`,
    "这通常不是用户 ID 或系统令牌错误，而是 CORS 预检、静态站点来源、代理或本地网络阻止导致。",
    originHint,
    "请使用 npm run dev 或 HTTPS 静态托管访问；若仍失败，需要 SheepAI 服务端放行浏览器跨域请求或提供同域/代理入口。",
    `原始错误：${causeMessage}`,
  ].filter((segment: string): boolean => segment.length > 0)

  return hintSegments.join("\n")
}

async function parseJsonResponse(response: Response): Promise<unknown> {
  const responseText: string = await response.text()
  if (responseText.trim().length === 0) {
    return {}
  }

  try {
    return JSON.parse(responseText) as unknown
  } catch {
    return { message: responseText.slice(0, 600) }
  }
}

async function requestJson(path: string, options: SystemApiRequestOptions, apiKey?: string): Promise<unknown> {
  const trimmedUserId: string = options.userId.trim()
  const trimmedSystemToken: string = options.systemToken.trim()

  if (trimmedUserId.length === 0) {
    throw new Error("请输入 SheepAI 用户 ID。")
  }
  if (trimmedSystemToken.length === 0) {
    throw new Error("请输入系统令牌。系统令牌不是模型调用 API Key。")
  }

  const headers: Record<string, string> = {
    Authorization: buildAuthorizationHeader(apiKey ?? trimmedSystemToken),
  }
  if (apiKey === undefined) {
    headers["New-Api-User"] = trimmedUserId
  }

  const url: string = systemApiUrl(path)
  let response: Response
  try {
    response = await fetch(url, {
      method: "GET",
      headers,
    })
  } catch (error: unknown) {
    throw new Error(buildNetworkErrorMessage(path, error))
  }
  const parsedBody: unknown = await parseJsonResponse(response)

  if (!response.ok) {
    const message: string = extractMessageFromBody(parsedBody)
    throw new Error(message || `系统 API 请求失败：HTTP ${response.status}`)
  }

  if (hasBusinessFailureSignal(parsedBody)) {
    const message: string = extractMessageFromBody(parsedBody)
    throw new Error(message || "系统 API 返回失败")
  }

  return parsedBody
}

function normalizeAccountInfo(body: unknown, fallbackUserId: string): AccountInfo {
  const record: JsonRecord = pickRecord(body)
  const resolvedUserId: string =
    asString(record.id) ||
    asString(record.userId) ||
    asString(record.user_id) ||
    asString(record.username) ||
    asString(record.name) ||
    fallbackUserId

  return {
    userId: resolvedUserId,
    displayName: asString(record.display_name) || asString(record.displayName) || asString(record.nickname) || asString(record.username),
    email: asString(record.email),
    status: asString(record.status) || asString(record.state) || "已验证",
    organization: asString(record.organization) || asString(record.org) || asString(record.group),
    quota: asNumber(record.quota, 0),
    usedQuota: asNumber(record.used_quota, 0),
    requestCount: asNumber(record.request_count, 0),
  }
}

function extractTokenValue(record: JsonRecord): string {
  return (
    asString(record.apiKey) ||
    asString(record.api_key) ||
    asString(record.key) ||
    asString(record.token) ||
    asString(record.value) ||
    asString(record.access_token)
  )
}

function normalizeTokenRecord(value: unknown, index: number): TokenRecord | null {
  if (!isRecord(value)) {
    return null
  }

  const tokenValue: string = extractTokenValue(value)
  const id: string = asString(value.id) || asString(value.tokenId) || asString(value.token_id) || tokenValue || `token-${index + 1}`
  const name: string = asString(value.name) || asString(value.key_name) || asString(value.label) || `API Key ${index + 1}`
  const enabled: boolean = asBoolean(value.enabled ?? value.status ?? value.state, true)
  const supportedModelsValue: unknown = value.supportedModelIds ?? value.supported_models ?? value.models
  const supportedModelIds: string[] = Array.isArray(supportedModelsValue)
    ? supportedModelsValue.map((modelId: unknown): string => asString(modelId)).filter((modelId: string): boolean => modelId.length > 0)
    : []

  return {
    id,
    name,
    tokenType: asString(value.tokenType) || asString(value.token_type) || "API Key",
    apiKey: normalizeCredential(tokenValue),
    description: asString(value.description) || asString(value.remark) || asString(value.group),
    expiresAt: asString(value.expiresAt) || asString(value.expires_at) || formatUnixTime(value.expired_time),
    enabled,
    usageCount: asNullableNumber(value.usageCount ?? value.used_count ?? value.quota_used),
    supportedModelIds,
    unlimitedQuota: asBoolean(value.unlimited_quota, true),
    usedQuota: asNumber(value.used_quota, 0),
    remainQuota: asNumber(value.remain_quota, 0),
  }
}

function normalizeTokenPage(body: unknown, page: number, size: number): TokenPage {
  const items: TokenRecord[] = pickArray(body)
    .map((item: unknown, index: number): TokenRecord | null => normalizeTokenRecord(item, index))
    .filter((item: TokenRecord | null): item is TokenRecord => item !== null)

  const record: JsonRecord = pickRecord(body)
  const total: number = asNumber(record.total ?? record.count ?? record.total_count, items.length)

  return {
    page: asNumber(record.page, page),
    size: asNumber(record.size ?? record.limit, size),
    total,
    items,
  }
}

function normalizeModels(body: unknown): ModelDefinition[] {
  const modelIds: string[] = pickArray(body)
    .map((item: unknown): string => {
      if (typeof item === "string") {
        return item
      }
      if (isRecord(item)) {
        return asString(item.id) || asString(item.model) || asString(item.name)
      }
      return ""
    })
    .filter((modelId: string): boolean => modelId.trim().length > 0)

  return buildModelOptions(modelIds)
}

function normalizeUsage(body: unknown, tokenId: string): TokenUsage {
  const record: JsonRecord = pickRecord(body)
  return {
    tokenId,
    promptTokens: asNumber(record.promptTokens ?? record.prompt_tokens ?? record.input_tokens, 0),
    completionTokens: asNumber(record.completionTokens ?? record.completion_tokens ?? record.output_tokens, 0),
    totalTokens: asNumber(record.totalTokens ?? record.total_tokens ?? record.used_tokens ?? record.quota_used, 0),
    resetAt: asString(record.resetAt) || asString(record.reset_at),
  }
}

export async function getSelf(userId: string, systemToken: string): Promise<AccountInfo> {
  const body: unknown = await requestJson("/api/sheep/user/self", { userId, systemToken })
  return normalizeAccountInfo(body, userId.trim())
}

export async function listTokens(
  userId: string,
  systemToken: string,
  page: number = 0,
  size: number = DEFAULT_TOKEN_PAGE_SIZE,
): Promise<TokenPage> {
  const searchParams: URLSearchParams = new URLSearchParams({
    p: String(page),
    size: String(size),
  })
  const body: unknown = await requestJson(`/api/sheep/tokens?${searchParams.toString()}`, { userId, systemToken })
  return normalizeTokenPage(body, page, size)
}

export async function getTokenModels(options: TokenModelOptions): Promise<ModelDefinition[]> {
  if (!options.token.enabled) {
    return []
  }

  if (options.token.supportedModelIds.length > 0) {
    return buildModelOptions(options.token.supportedModelIds)
  }

  const apiKey: string = options.token.apiKey.trim()
  if (apiKey.length === 0) {
    throw new Error("该 API Key 记录缺少可用于模型调用的令牌值，请在 SheepAI 控制台重新生成。")
  }

  const body: unknown = await requestJson("/api/sheep/models", options, apiKey)
  return normalizeModels(body)
}

export async function getTokenUsage(options: TokenUsageOptions): Promise<TokenUsage> {
  const searchParams: URLSearchParams = new URLSearchParams({ token_id: options.tokenId })
  const body: unknown = await requestJson(`/api/sheep/usage/token?${searchParams.toString()}`, options)
  return normalizeUsage(body, options.tokenId)
}

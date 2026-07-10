// ============ Model types ============

export type ModelProvider = "openai-compatible" | "anthropic-compatible" | "gemini-compatible"
export type ApiInterfaceFormat = ModelProvider

export type ModelFamily = "GPT" | "Claude" | "Qwen" | "DeepSeek" | "GLM" | "Gemini" | "Llama" | "Grok" | "Kimi" | "MiniMax" | "Other"

/** API 原始返回的模型数据 */
export interface RawModelInfo {
  id: string
  object: string
  created: number
  owned_by: string
  supported_endpoint_types: string[]
  model_type: string
  description: string
  tags: string
}

/** 前端使用的模型定义（增强版） */
export interface ModelDefinition {
  id: string
  label: string
  provider: ModelProvider
  family: ModelFamily
  baseUrl: string
  requestPath: string
  description: string
  defaultTemperature: number
  enabled: boolean
  /** 供应商标识 */
  ownedBy: string
  /** 模型类型：文本/图像/音视频/检索 */
  modelType: string
  /** 标签数组 */
  tags: string[]
  /** API 端点类型 */
  endpointTypes: string[]
}

export interface ApiConfiguration {
  id: string
  name: string
  apiBaseUrl: string
  apiKey: string
  interfaceFormat: ApiInterfaceFormat
  modelIds: string[]
  timeoutSeconds: number
  selectedModelId: string
  createdAt: number
  updatedAt: number
}

/** 供应商分组 */
export interface ProviderGroup {
  providerKey: string
  providerName: string
  models: ModelDefinition[]
}

// ============ Tool types ============

export type ToolCategory = "text" | "image" | "audio"

export interface ToolDefinition {
  id: string
  name: string
  shortName: string
  category: ToolCategory
  description: string
  icon: string
  outputLabel: string
  placeholder: string
  systemPrompt: string
  buildUserPrompt: (inputText: string) => string
  defaultInput: string
  /** 工具需要的模型过滤类型 */
  modelFilter?: string
  /** 工具支持图片输入 */
  supportsImageInput?: boolean
  /** 工具产出图片输出 */
  supportsImageOutput?: boolean
}

// ============ Auth / Account types ============

export interface AccountInfo {
  userId: string
  displayName: string
  email: string
  status: string
  organization: string
  /** 用户余额 (quota units) */
  quota: number
  /** 已使用量 (quota units) */
  usedQuota: number
  /** 请求次数 */
  requestCount: number
}

export interface TokenRecord {
  id: string
  name: string
  tokenType: string
  apiKey: string
  description: string
  expiresAt: string
  enabled: boolean
  usageCount: number | null
  supportedModelIds: string[]
  /** 无用量限制 */
  unlimitedQuota: boolean
  /** 已使用量 (quota units) */
  usedQuota: number
  /** 剩余额度 (quota units)，unlimited_quota=true 时无效 */
  remainQuota: number
}

export interface TokenPage {
  page: number
  size: number
  total: number
  items: TokenRecord[]
}

export interface TokenUsage {
  tokenId: string
  promptTokens: number
  completionTokens: number
  totalTokens: number
  resetAt: string
}

// ============ API call types ============

export interface RunToolRequest {
  apiKey: string
  model: ModelDefinition
  tool: ToolDefinition
  inputText: string
  timeoutSeconds?: number
  /** 可选的图片 base64 数据 */
  imageBase64?: string
  /** 图片 MIME 类型 */
  imageMimeType?: string
}

export interface RunToolResponse {
  content: string
  endpoint: string
  provider: ModelProvider
  /** 图片类工具返回的 base64 或 URL */
  imageData?: string
}

// ============ OpenAI / Anthropic protocol types ============

export interface OpenAiChatMessage {
  role: "system" | "user" | "assistant"
  content: string | OpenAiContentPart[]
}

export interface OpenAiContentPart {
  type: "text" | "image_url"
  text?: string
  image_url?: {
    url: string
    detail?: "auto" | "low" | "high"
  }
}

export interface OpenAiChatCompletionRequest {
  model: string
  messages: OpenAiChatMessage[]
  temperature: number
  stream: false
}

export interface AnthropicMessage {
  role: "user" | "assistant"
  content: string | AnthropicContentBlock[]
}

export interface AnthropicContentBlock {
  type: "text" | "image"
  text?: string
  source?: {
    type: "base64"
    media_type: string
    data: string
  }
}

export interface AnthropicMessagesRequest {
  model: string
  max_tokens: number
  temperature: number
  system: string
  messages: AnthropicMessage[]
}

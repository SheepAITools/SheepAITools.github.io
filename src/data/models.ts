import { CLAUDE_BASE_URL, GPT_BASE_URL } from "@/lib/sheepaiConfig"
import type { ApiInterfaceFormat, ModelCapability, ModelDefinition, ModelFamily, ModelIdGroups, ModelProvider, ProviderGroup } from "@/types/sheepai"

// ============ Latest recommended models (July 2026) ============

export const RECOMMENDED_MODEL_IDS = new Set([
  // Anthropic — latest Mythos + Opus
  "claude-fable-5", "claude-mythos-5", "claude-opus-4-8", "claude-opus-4-7",
  // OpenAI — GPT-5.5 series
  "gpt-5.5", "gpt-5.5-pro", "gpt-5.5-instant", "gpt-5.5-mini",
  // DeepSeek — V4 series
  "deepseek-v4-pro", "deepseek-v4-pro[1m]", "deepseek-v4-flash", "deepseek-v4",
  // Qwen — 3.7 series
  "qwen3.7-max", "qwen3.7-plus", "qwen3-coder-plus",
  // Kimi — K2.7 / K2.6
  "kimi-k2.7", "kimi-k2.6",
  // GLM — 5 series
  "glm-5.2", "glm-5",
  // Grok
  "grok-4", "grok-4-fast-reasoning",
  // MiniMax
  "MiniMax-M2.7",
  // Image models
  "gpt-image-2", "qwen-image-max-2025-12-30", "wan2.7-image-pro",
  // TTS
  "tts-1", "gpt-4o-mini-tts",
])

// ============ Provider display names ============

const PROVIDER_NAMES: Record<string, string> = {
  openai: "OpenAI",
  custom: "第三方",
  ali: "阿里（通义）",
  baidu: "百度",
  minimax: "MiniMax",
  midjourney: "Midjourney",
  xai: "xAI（Grok）",
  meta: "Meta",
  deepseek: "DeepSeek",
  zhipu_4v: "智谱 AI",
  coze: "Coze",
  "vertex-ai": "Google Vertex",
  siliconflow: "硅基流动",
  awsboto3: "AWS",
  volcengine: "火山引擎",
  xunfei: "讯飞",
  stepfun: "阶跃星辰",
  moonshot: "月之暗面",
}

export function getProviderName(key: string): string {
  return PROVIDER_NAMES[key] ?? key
}

// ============ Model type display ============

const MODEL_TYPE_NAMES: Record<string, string> = {
  "文本": "📝 文本",
  "图像": "🎨 图像",
  "音视频": "🎬 音视频",
  "检索": "🔍 检索",
}

export function getModelTypeLabel(type: string): string {
  return MODEL_TYPE_NAMES[type] ?? type
}

// ============ Model family inference ============

function inferModelFamily(id: string, ownedBy: string): ModelFamily {
  if (id.includes("claude")) return "Claude"
  if (id.includes("gpt") || id.includes("o1-") || id.includes("o3-") || id.includes("o4-")) return "GPT"
  if (id.includes("qwen") || id.includes("qwq")) return "Qwen"
  if (id.includes("deepseek")) return "DeepSeek"
  if (id.includes("glm")) return "GLM"
  if (id.includes("gemma") || id.includes("gemini")) return "Gemini"
  if (id.includes("llama")) return "Llama"
  if (id.includes("grok")) return "Grok"
  if (id.includes("kimi") || id.includes("k2")) return "Kimi"
  if (id.includes("minimax") || id.includes("hailuo")) return "MiniMax"
  if (ownedBy === "openai") return "GPT"
  return "Other"
}

function inferModelProvider(_modelId: string, endpointTypes: string[]): ModelProvider {
  if (endpointTypes.includes("anthropic") && !endpointTypes.includes("openai")) {
    return "anthropic-compatible"
  }
  return "openai-compatible"
}

function getBaseUrl(provider: ModelProvider): string {
  if (provider === "gemini-compatible") return "https://generativelanguage.googleapis.com/v1beta"
  return provider === "anthropic-compatible" ? CLAUDE_BASE_URL : GPT_BASE_URL
}

function getRequestPath(provider: ModelProvider): string {
  if (provider === "gemini-compatible") return ":generateContent"
  return provider === "anthropic-compatible" ? "/v1/messages" : "/chat/completions"
}

// ============ Tag normalization ============

/** Normalize tag inconsistencies (e.g., 绘画 vs 绘图 → both map to 绘画) */
const TAG_ALIASES: Record<string, string> = {
  "绘图": "绘画",
  "图像生成": "绘画",
  "图片生成": "绘画",
  "文生图": "绘画",
  "文字转语音": "音频",
  "语音合成": "音频",
  "语音转文字": "音频",
  "音转文": "音频",
  "动作模仿": "视频",
  "主体替换": "视频",
  "参考生视频": "视频",
  "首尾帧": "视频",
}

export function parseTags(tagsStr: string): string[] {
  const raw = tagsStr.split(/[,，]/).map((t) => t.trim()).filter((t) => t.length > 0)
  const normalized = raw.map((t) => TAG_ALIASES[t] || t)
  return [...new Set(normalized)]
}

// ============ Build ModelDefinition from raw API data ============

export function buildModelFromRaw(raw: {
  id: string
  owned_by: string
  supported_endpoint_types: string[]
  model_type: string
  tags: string
  description: string
}): ModelDefinition {
  const provider = inferModelProvider(raw.id, raw.supported_endpoint_types)
  const family = inferModelFamily(raw.id, raw.owned_by)
  const parsedTags = parseTags(raw.tags)
  const isDeprecated = parsedTags.includes("弃用")
  const cleanDesc = raw.description.replace(/<[^>]*>/g, "").trim().slice(0, 200)

  return {
    id: raw.id,
    label: raw.id,
    provider,
    family,
    baseUrl: getBaseUrl(provider),
    requestPath: getRequestPath(provider),
    description: cleanDesc || "由当前 API Key 返回的可用模型。",
    defaultTemperature: provider === "anthropic-compatible" ? 0.35 : 0.3,
    enabled: !isDeprecated,
    ownedBy: raw.owned_by,
    modelType: raw.model_type || "文本",
    tags: parsedTags,
    endpointTypes: raw.supported_endpoint_types,
  }
}

// ============ Build from model ID string (fallback) ============

interface BuildModelOptionsParams {
  apiBaseUrl?: string
  interfaceFormat?: ApiInterfaceFormat
  modelIdGroups?: ModelIdGroups
}

function getCapabilitiesForModel(modelId: string, groups?: ModelIdGroups): ModelCapability[] {
  if (!groups) return []
  return (Object.keys(groups) as ModelCapability[]).filter((capability) => groups[capability].includes(modelId))
}

function buildFallbackModel(modelId: string, params: BuildModelOptionsParams = {}): ModelDefinition {
  const provider = params.interfaceFormat ?? inferModelProvider(modelId, ["openai"])
  const endpointTypes = provider === "anthropic-compatible"
    ? ["anthropic"]
    : provider === "gemini-compatible"
      ? ["gemini"]
      : ["openai"]
  return {
    id: modelId,
    label: modelId,
    provider,
    family: inferModelFamily(modelId, "custom"),
    baseUrl: params.apiBaseUrl?.trim().replace(/\/+$/, "") || getBaseUrl(provider),
    requestPath: getRequestPath(provider),
    description: "由当前 API 配置提供。",
    defaultTemperature: 0.3,
    enabled: true,
    ownedBy: "custom",
    modelType: "文本",
    tags: ["对话"],
    endpointTypes,
    capabilities: getCapabilitiesForModel(modelId, params.modelIdGroups),
  }
}

export function buildModelOptions(modelIds: string[], params: BuildModelOptionsParams = {}): ModelDefinition[] {
  return [...new Set(modelIds.map((m) => m.trim()).filter(Boolean))]
    .map((modelId) => buildFallbackModel(modelId, params))
}

// ============ Group models: by model_type → provider ============

const MODEL_TYPE_ORDER: Record<string, number> = {
  "文本": 0, "图像": 1, "音视频": 2, "检索": 3,
}

export function groupModelsByProvider(models: ModelDefinition[]): ProviderGroup[] {
  const groupMap = new Map<string, ModelDefinition[]>()

  for (const model of models) {
    // Group key: model_type + "|" + provider
    const key = `${model.modelType || "文本"}|${model.ownedBy || "custom"}`
    if (!groupMap.has(key)) groupMap.set(key, [])
    groupMap.get(key)!.push(model)
  }

  // Sort within each group
  for (const [, groupModels] of groupMap) {
    groupModels.sort((a, b) => {
      if (a.enabled !== b.enabled) return a.enabled ? -1 : 1
      if (a.family !== b.family) return a.family.localeCompare(b.family)
      return b.id.localeCompare(a.id)
    })
  }

  // Sort groups: by model_type order, then provider priority, then count
  const groups: ProviderGroup[] = [...groupMap.entries()]
    .sort(([keyA, modelsA], [keyB, modelsB]) => {
      const [typeA, provA] = keyA.split("|")
      const [typeB, provB] = keyB.split("|")
      const toA = MODEL_TYPE_ORDER[typeA] ?? 99
      const toB = MODEL_TYPE_ORDER[typeB] ?? 99
      if (toA !== toB) return toA - toB
      if (provA === "openai") return -1
      if (provB === "openai") return 1
      return modelsB.length - modelsA.length
    })
    .map(([key, models]) => {
      const [, provKey] = key.split("|")
      const typeLabel = models[0]?.modelType || "文本"
      return {
        providerKey: key,
        providerName: `${getModelTypeLabel(typeLabel)} · ${getProviderName(provKey)}`,
        models,
      }
    })

  return groups
}

// ============ Filter models by tool type ============

export function filterModelsForTool(models: ModelDefinition[], toolModelFilter?: string): ModelDefinition[] {
  if (!toolModelFilter) return models.filter((m) => m.enabled)
  const hasCapabilityGroups = models.some((m) => (m.capabilities?.length ?? 0) > 0)
  if (hasCapabilityGroups) {
    const capabilityByFilter: Record<string, ModelCapability> = {
      text: "text",
      "image-gen": "imageGeneration",
      "image-edit": "imageEdit",
      "image-vision": "vision",
      tts: "tts",
      stt: "stt",
    }
    const capability = capabilityByFilter[toolModelFilter]
    if (capability) return models.filter((m) => m.enabled && m.capabilities?.includes(capability))
  }

  if (models.every((m) => m.ownedBy === "custom")) return models.filter((m) => m.enabled)

  return models.filter((m) => {
    if (!m.enabled) return false

    switch (toolModelFilter) {
      case "text":
        // Only text models with conversational capability
        return m.modelType === "文本" && m.tags.includes("对话") &&
          (m.endpointTypes.includes("openai") || m.endpointTypes.includes("anthropic") || m.endpointTypes.includes("openai-response"))

      case "image-gen":
        // Image generation models (tags or model_type)
        return (m.modelType === "图像" || m.tags.includes("绘画")) &&
          (m.endpointTypes.includes("dall-e-3") || m.endpointTypes.includes("images-generations") ||
           m.endpointTypes.includes("image-generation") || m.endpointTypes.includes("kling生图") ||
           m.endpointTypes.includes("mj想象模式") || m.endpointTypes.includes("mj模态模式"))

      case "image-edit":
        // Image editing capable
        return (m.modelType === "图像" || m.tags.includes("绘画")) &&
          (m.endpointTypes.includes("openai编辑图片") || m.endpointTypes.includes("image-generation") ||
           m.endpointTypes.includes("images-generations") || m.endpointTypes.includes("kling多图生图") ||
           m.endpointTypes.includes("kling扩图"))

      case "image-vision":
        // Vision-capable models (must have 识图 tag)
        return m.tags.includes("识图") &&
          (m.modelType === "文本" || m.modelType === "图像") &&
          (m.endpointTypes.includes("openai") || m.endpointTypes.includes("anthropic") || m.endpointTypes.includes("openai-response"))

      case "tts":
        return (m.modelType === "音视频" || m.tags.includes("音频")) &&
          (m.endpointTypes.includes("文本转语音") || m.endpointTypes.includes("同步语音") ||
           m.endpointTypes.includes("异步语音") || m.endpointTypes.includes("vidu语音合成"))

      case "stt":
        return (m.modelType === "音视频" || m.tags.includes("音频")) &&
          (m.endpointTypes.includes("语音转文字") || m.endpointTypes.includes("openai"))

      default:
        return m.tags.includes("对话") &&
          (m.endpointTypes.includes("openai") || m.endpointTypes.includes("anthropic"))
    }
  })
}

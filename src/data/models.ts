import { CLAUDE_BASE_URL, GPT_BASE_URL } from "@/lib/sheepaiConfig"
import type { ModelDefinition, ModelFamily, ModelProvider, ProviderGroup } from "@/types/sheepai"

// ============ Provider display names ============

const PROVIDER_NAMES: Record<string, string> = {
  openai: "OpenAI",
  custom: "通用",
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
  return provider === "anthropic-compatible" ? CLAUDE_BASE_URL : GPT_BASE_URL
}

function getRequestPath(provider: ModelProvider): string {
  return provider === "anthropic-compatible" ? "/v1/messages" : "/chat/completions"
}

// ============ Model tag parsing ============

export function parseTags(tagsStr: string): string[] {
  return tagsStr.split(/[,，]/).map((t) => t.trim()).filter((t) => t.length > 0)
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

function buildFallbackModel(modelId: string): ModelDefinition {
  const provider = inferModelProvider(modelId, ["openai"])
  return {
    id: modelId,
    label: modelId,
    provider,
    family: inferModelFamily(modelId, "custom"),
    baseUrl: getBaseUrl(provider),
    requestPath: getRequestPath(provider),
    description: "由 API Key 返回。具体能力请以 SheepAI 控制台为准。",
    defaultTemperature: 0.3,
    enabled: true,
    ownedBy: "custom",
    modelType: "文本",
    tags: ["对话"],
    endpointTypes: ["openai"],
  }
}

// ============ Build model options from ID list ============

export function buildModelOptions(modelIds: string[]): ModelDefinition[] {
  return [...new Set(modelIds.map((m) => m.trim()).filter(Boolean))]
    .map(buildFallbackModel)
}

// ============ Group models by provider ============

export function groupModelsByProvider(models: ModelDefinition[]): ProviderGroup[] {
  const groupMap = new Map<string, ModelDefinition[]>()

  for (const model of models) {
    const key = model.ownedBy || "custom"
    if (!groupMap.has(key)) groupMap.set(key, [])
    groupMap.get(key)!.push(model)
  }

  for (const [, groupModels] of groupMap) {
    groupModels.sort((a, b) => {
      if (a.enabled !== b.enabled) return a.enabled ? -1 : 1
      if (a.family !== b.family) return a.family.localeCompare(b.family)
      return b.id.localeCompare(a.id)
    })
  }

  const groups: ProviderGroup[] = [...groupMap.entries()]
    .sort(([keyA, modelsA], [keyB, modelsB]) => {
      if (keyA === "openai") return -1
      if (keyB === "openai") return 1
      return modelsB.length - modelsA.length
    })
    .map(([key, models]) => ({
      providerKey: key,
      providerName: getProviderName(key),
      models,
    }))

  return groups
}

// ============ Filter models by tool type ============

export function filterModelsForTool(models: ModelDefinition[], toolModelFilter?: string): ModelDefinition[] {
  if (!toolModelFilter) return models.filter((m) => m.enabled)

  return models.filter((m) => {
    if (!m.enabled) return false

    switch (toolModelFilter) {
      case "text":
        return m.modelType === "文本" && m.tags.includes("对话") &&
          (m.endpointTypes.includes("openai") || m.endpointTypes.includes("anthropic") || m.endpointTypes.includes("openai-response"))

      case "image-gen":
        return (m.modelType === "图像" || m.tags.includes("绘画")) &&
          (m.endpointTypes.includes("dall-e-3") || m.endpointTypes.includes("images-generations") ||
           m.endpointTypes.includes("image-generation") || m.endpointTypes.includes("kling生图") ||
           m.endpointTypes.includes("mj想象模式"))

      case "image-edit":
        return (m.modelType === "图像" || m.tags.includes("绘画")) &&
          (m.endpointTypes.includes("openai编辑图片") || m.endpointTypes.includes("image-generation") ||
           m.endpointTypes.includes("images-generations") || m.endpointTypes.includes("kling多图生图") ||
           m.endpointTypes.includes("kling扩图"))

      case "image-vision":
        return m.tags.includes("识图") && m.modelType === "文本" &&
          (m.endpointTypes.includes("openai") || m.endpointTypes.includes("anthropic"))

      case "tts":
        return (m.modelType === "音视频" || m.tags.includes("音频")) &&
          (m.endpointTypes.includes("文本转语音") || m.endpointTypes.includes("同步语音") || m.endpointTypes.includes("异步语音"))

      default:
        return m.tags.includes("对话") &&
          (m.endpointTypes.includes("openai") || m.endpointTypes.includes("anthropic"))
    }
  })
}

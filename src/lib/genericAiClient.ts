import {
  buildAuthorizationHeader,
  buildEndpoint,
  extractAnthropicContent,
  extractOpenAiContent,
  parseErrorResponse,
} from "@/lib/sheepaiClient"
import type {
  AnthropicMessagesRequest,
  ApiConfiguration,
  OpenAiChatCompletionRequest,
  RunToolRequest,
  RunToolResponse,
  ToolDefinition,
  ModelDefinition,
} from "@/types/sheepai"

function timeoutSignal(seconds: number | undefined): AbortSignal {
  const timeoutMs = Math.max(1, seconds ?? 600) * 1000
  return AbortSignal.timeout(timeoutMs)
}

function getTimeoutErrorMessage(seconds: number | undefined): string {
  return `请求超时，请检查 API 地址或将超时时间调大（当前 ${seconds ?? 600} 秒）。`
}

function extractImageData(body: unknown): string | undefined {
  if (typeof body !== "object" || body === null) return undefined
  const data = (body as { data?: unknown }).data
  if (!Array.isArray(data)) return undefined
  const first = data[0]
  if (typeof first !== "object" || first === null) return undefined
  const item = first as { b64_json?: unknown; url?: unknown }
  if (typeof item.b64_json === "string" && item.b64_json.trim()) return item.b64_json
  if (typeof item.url === "string" && item.url.trim()) return item.url
  return undefined
}

function normalizeImageData(value: string | undefined): string | undefined {
  if (!value) return undefined
  if (value.startsWith("http://") || value.startsWith("https://") || value.startsWith("data:")) return value
  return `data:image/png;base64,${value}`
}

function isImageGenerationTool(tool: ToolDefinition): boolean {
  return tool.modelFilter === "image-gen" || (tool.supportsImageOutput === true && tool.supportsImageInput !== true)
}

function isImageEditTool(tool: ToolDefinition): boolean {
  return tool.modelFilter === "image-edit" || (tool.supportsImageInput === true && tool.supportsImageOutput === true)
}

function stripKnownEndpointSuffix(baseUrl: string): string {
  return baseUrl
    .trim()
    .replace(/\/+$/, "")
    .replace(/\/images\/generations$/i, "")
    .replace(/\/images\/edits$/i, "")
    .replace(/\/chat\/completions$/i, "")
}

export function resolveOpenAiToolEndpoint(model: ModelDefinition, tool: ToolDefinition): string {
  const baseUrl = stripKnownEndpointSuffix(model.baseUrl)
  if (isImageEditTool(tool)) return buildEndpoint(baseUrl, "/images/edits")
  if (isImageGenerationTool(tool)) return buildEndpoint(baseUrl, "/images/generations")
  return buildEndpoint(model.baseUrl, model.requestPath)
}

function base64ToBlob(base64: string, mimeType: string): Blob {
  const binary = atob(base64)
  const bytes = new Uint8Array(binary.length)
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index)
  }
  return new Blob([bytes], { type: mimeType })
}

export function buildOpenAiToolPayload(request: Pick<RunToolRequest, "model" | "tool" | "inputText" | "imageBase64" | "imageMimeType">): OpenAiChatCompletionRequest | Record<string, unknown> | FormData {
  if (isImageEditTool(request.tool)) {
    if (!request.imageBase64) throw new Error("请先上传需要编辑的图片。")
    const formData = new FormData()
    formData.set("model", request.model.id)
    formData.set("prompt", request.tool.buildUserPrompt(request.inputText))
    formData.set("image", base64ToBlob(request.imageBase64, request.imageMimeType ?? "image/png"), "image.png")
    return formData
  }

  if (isImageGenerationTool(request.tool)) {
    return {
      model: request.model.id,
      prompt: request.tool.buildUserPrompt(request.inputText),
    }
  }

  const content = request.imageBase64
    ? [
        { type: "text" as const, text: request.tool.buildUserPrompt(request.inputText) },
        {
          type: "image_url" as const,
          image_url: { url: `data:${request.imageMimeType ?? "image/png"};base64,${request.imageBase64}` },
        },
      ]
    : request.tool.buildUserPrompt(request.inputText)

  return {
    model: request.model.id,
    messages: [
      { role: "system", content: request.tool.systemPrompt },
      { role: "user", content },
    ],
    temperature: request.model.defaultTemperature,
    stream: false,
  }
}

function extractGeminiContent(body: unknown): string {
  if (typeof body !== "object" || body === null) throw new Error("Gemini 接口未返回可展示内容。")
  const candidates = (body as { candidates?: unknown }).candidates
  if (!Array.isArray(candidates)) throw new Error("Gemini 接口未返回可展示内容。")
  const parts = (candidates[0] as { content?: { parts?: unknown } } | undefined)?.content?.parts
  if (!Array.isArray(parts)) throw new Error("Gemini 接口未返回可展示内容。")
  const text = parts
    .map((part) => typeof part === "object" && part !== null && "text" in part ? String((part as { text?: unknown }).text ?? "") : "")
    .filter(Boolean)
    .join("\n")
    .trim()
  if (!text) throw new Error("Gemini 接口未返回可展示内容。")
  return text
}

function extractGeminiImageData(body: unknown): string | undefined {
  if (typeof body !== "object" || body === null) return undefined
  const candidates = (body as { candidates?: unknown }).candidates
  if (!Array.isArray(candidates)) return undefined
  const parts = (candidates[0] as { content?: { parts?: unknown } } | undefined)?.content?.parts
  if (!Array.isArray(parts)) return undefined

  for (const part of parts) {
    if (typeof part !== "object" || part === null) continue
    const inlineData = (part as { inlineData?: unknown; inline_data?: unknown }).inlineData ?? (part as { inline_data?: unknown }).inline_data
    if (typeof inlineData !== "object" || inlineData === null) continue
    const data = (inlineData as { data?: unknown }).data
    const mimeType = (inlineData as { mimeType?: unknown; mime_type?: unknown }).mimeType ?? (inlineData as { mime_type?: unknown }).mime_type
    if (typeof data === "string" && data.trim()) {
      return `data:${typeof mimeType === "string" ? mimeType : "image/png"};base64,${data}`
    }
  }

  return undefined
}

export function resolveGeminiEndpoint(model: ModelDefinition): string {
  const baseUrl = model.baseUrl.trim().replace(/\/+$/, "")
  const modelPath = model.id.startsWith("models/") ? model.id : `models/${model.id}`
  if (baseUrl.includes(":generateContent")) {
    return baseUrl
  }
  if (baseUrl.endsWith(modelPath)) {
    return `${baseUrl}:generateContent`
  }
  return `${baseUrl}/${modelPath}:generateContent`
}

export function buildGeminiPayload(request: Pick<RunToolRequest, "model" | "tool" | "inputText" | "imageBase64" | "imageMimeType">): Record<string, unknown> {
  const parts: Array<Record<string, unknown>> = [{ text: request.tool.buildUserPrompt(request.inputText) }]
  if (request.imageBase64) {
    parts.unshift({
      inlineData: {
        mimeType: request.imageMimeType ?? "image/png",
        data: request.imageBase64,
      },
    })
  }

  return {
    contents: [{ role: "user", parts }],
    generationConfig: {
      temperature: request.model.defaultTemperature,
    },
  }
}

function normalizeFetchError(error: unknown, seconds: number | undefined): Error {
  if (error instanceof DOMException && error.name === "TimeoutError") {
    return new Error(getTimeoutErrorMessage(seconds))
  }
  if (error instanceof Error && error.name === "AbortError") {
    return new Error(getTimeoutErrorMessage(seconds))
  }
  return error instanceof Error ? error : new Error("请求失败。")
}

async function runOpenAiCompatibleTool(request: RunToolRequest): Promise<RunToolResponse> {
  const endpoint = resolveOpenAiToolEndpoint(request.model, request.tool)
  const payload = buildOpenAiToolPayload(request)
  const isFormDataPayload = payload instanceof FormData

  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        Authorization: buildAuthorizationHeader(request.apiKey),
        ...(isFormDataPayload ? {} : { "Content-Type": "application/json" }),
      },
      body: isFormDataPayload ? payload : JSON.stringify(payload),
      signal: timeoutSignal(request.timeoutSeconds),
    })

    if (!response.ok) throw new Error(await parseErrorResponse(response))

    const body = await response.json()
    return {
      content: isImageGenerationTool(request.tool) || isImageEditTool(request.tool)
        ? "图片已生成。"
        : extractOpenAiContent(body),
      imageData: normalizeImageData(extractImageData(body)),
      endpoint,
      provider: request.model.provider,
    }
  } catch (error: unknown) {
    throw normalizeFetchError(error, request.timeoutSeconds)
  }
}

async function runGeminiCompatibleTool(request: RunToolRequest): Promise<RunToolResponse> {
  const endpoint = resolveGeminiEndpoint(request.model)
  const separator = endpoint.includes("?") ? "&" : "?"
  const requestUrl = `${endpoint}${separator}key=${encodeURIComponent(request.apiKey.trim().replace(/^bearer\s+/i, "").trim())}`

  try {
    const response = await fetch(requestUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(buildGeminiPayload(request)),
      signal: timeoutSignal(request.timeoutSeconds),
    })

    if (!response.ok) throw new Error(await parseErrorResponse(response))

    const body = await response.json()
    const imageData = extractGeminiImageData(body)
    return {
      content: imageData ? "图片已生成。" : extractGeminiContent(body),
      imageData,
      endpoint,
      provider: request.model.provider,
    }
  } catch (error: unknown) {
    throw normalizeFetchError(error, request.timeoutSeconds)
  }
}

async function runAnthropicCompatibleTool(request: RunToolRequest): Promise<RunToolResponse> {
  const endpoint = buildEndpoint(request.model.baseUrl, request.model.requestPath)
  const userContent = request.imageBase64
    ? [
        {
          type: "image" as const,
          source: {
            type: "base64" as const,
            media_type: request.imageMimeType ?? "image/png",
            data: request.imageBase64,
          },
        },
        { type: "text" as const, text: request.tool.buildUserPrompt(request.inputText) },
      ]
    : request.tool.buildUserPrompt(request.inputText)

  const payload: AnthropicMessagesRequest = {
    model: request.model.id,
    max_tokens: 1800,
    temperature: request.model.defaultTemperature,
    system: request.tool.systemPrompt,
    messages: [{ role: "user", content: userContent }],
  }

  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "x-api-key": request.apiKey.trim().replace(/^bearer\s+/i, "").trim(),
        Authorization: buildAuthorizationHeader(request.apiKey),
        "anthropic-version": "2023-06-01",
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
      signal: timeoutSignal(request.timeoutSeconds),
    })

    if (!response.ok) throw new Error(await parseErrorResponse(response))

    const body = await response.json()
    return {
      content: extractAnthropicContent(body),
      endpoint,
      provider: request.model.provider,
    }
  } catch (error: unknown) {
    throw normalizeFetchError(error, request.timeoutSeconds)
  }
}

export async function runConfiguredTool(request: RunToolRequest): Promise<RunToolResponse> {
  const trimmedApiKey = request.apiKey.trim()
  const trimmedInputText = request.inputText.trim()

  if (trimmedApiKey.length === 0) throw new Error("请先填写 API Key。")
  if (request.model.id.trim().length === 0) throw new Error("请先填写模型 ID。")
  if (!request.tool.supportsImageInput && trimmedInputText.length === 0) throw new Error("请输入需要处理的内容。")

  const normalizedRequest: RunToolRequest = {
    ...request,
    apiKey: trimmedApiKey,
    inputText: trimmedInputText,
  }

  if (request.model.provider === "anthropic-compatible") {
    return runAnthropicCompatibleTool(normalizedRequest)
  }

  if (request.model.provider === "gemini-compatible") {
    return runGeminiCompatibleTool(normalizedRequest)
  }

  return runOpenAiCompatibleTool(normalizedRequest)
}

export async function runConnectivityTest(config: ApiConfiguration): Promise<void> {
  const modelId = config.selectedModelId || config.modelIds[0]
  if (!config.apiBaseUrl.trim()) throw new Error("请填写 API 地址。")
  if (!config.apiKey.trim()) throw new Error("请填写 API Key。")
  if (!modelId) throw new Error("请至少填写一个模型 ID。")

  const requestPath = config.interfaceFormat === "anthropic-compatible" ? "/v1/messages" : "/chat/completions"
  if (config.interfaceFormat === "gemini-compatible") {
    const modelPath = modelId.startsWith("models/") ? modelId : `models/${modelId}`
    const baseUrl = config.apiBaseUrl.trim().replace(/\/+$/, "")
    const endpoint = baseUrl.includes(":generateContent")
      ? baseUrl
      : `${baseUrl}/${modelPath}:generateContent`
    const separator = endpoint.includes("?") ? "&" : "?"
    const response = await fetch(`${endpoint}${separator}key=${encodeURIComponent(config.apiKey.trim().replace(/^bearer\s+/i, "").trim())}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ contents: [{ role: "user", parts: [{ text: "ping" }] }] }),
      signal: timeoutSignal(config.timeoutSeconds),
    }).catch((error: unknown) => {
      throw normalizeFetchError(error, config.timeoutSeconds)
    })

    if (!response.ok) throw new Error(await parseErrorResponse(response))
    return
  }

  const endpoint = buildEndpoint(config.apiBaseUrl, requestPath)

  const response = await fetch(endpoint, {
    method: "POST",
    headers: config.interfaceFormat === "anthropic-compatible"
      ? {
          "x-api-key": config.apiKey.trim().replace(/^bearer\s+/i, "").trim(),
          Authorization: buildAuthorizationHeader(config.apiKey),
          "anthropic-version": "2023-06-01",
          "Content-Type": "application/json",
        }
      : {
          Authorization: buildAuthorizationHeader(config.apiKey),
          "Content-Type": "application/json",
        },
    body: JSON.stringify(config.interfaceFormat === "anthropic-compatible"
      ? {
          model: modelId,
          max_tokens: 8,
          messages: [{ role: "user", content: "ping" }],
        }
      : {
          model: modelId,
          messages: [{ role: "user", content: "ping" }],
          temperature: 0,
          stream: false,
        }),
    signal: timeoutSignal(config.timeoutSeconds),
  }).catch((error: unknown) => {
    throw normalizeFetchError(error, config.timeoutSeconds)
  })

  if (!response.ok) throw new Error(await parseErrorResponse(response))
}

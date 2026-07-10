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
  const endpoint = buildEndpoint(request.model.baseUrl, request.model.requestPath)
  const content = request.imageBase64
    ? [
        { type: "text" as const, text: request.tool.buildUserPrompt(request.inputText) },
        {
          type: "image_url" as const,
          image_url: { url: `data:${request.imageMimeType ?? "image/png"};base64,${request.imageBase64}` },
        },
      ]
    : request.tool.buildUserPrompt(request.inputText)

  const payload: OpenAiChatCompletionRequest = {
    model: request.model.id,
    messages: [
      { role: "system", content: request.tool.systemPrompt },
      { role: "user", content },
    ],
    temperature: request.model.defaultTemperature,
    stream: false,
  }

  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        Authorization: buildAuthorizationHeader(request.apiKey),
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
      signal: timeoutSignal(request.timeoutSeconds),
    })

    if (!response.ok) throw new Error(await parseErrorResponse(response))

    const body = await response.json()
    return {
      content: extractOpenAiContent(body),
      imageData: extractImageData(body),
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

  return runOpenAiCompatibleTool(normalizedRequest)
}

export async function runConnectivityTest(config: ApiConfiguration): Promise<void> {
  const modelId = config.selectedModelId || config.modelIds[0]
  if (!config.apiBaseUrl.trim()) throw new Error("请填写 API 地址。")
  if (!config.apiKey.trim()) throw new Error("请填写 API Key。")
  if (!modelId) throw new Error("请至少填写一个模型 ID。")

  const requestPath = config.interfaceFormat === "anthropic-compatible" ? "/v1/messages" : "/chat/completions"
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

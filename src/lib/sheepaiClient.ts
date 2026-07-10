import type {
  AnthropicMessagesRequest,
  OpenAiChatCompletionRequest,
  RunToolRequest,
  RunToolResponse,
} from "@/types/sheepai"

interface OpenAiChatCompletionResponse {
  choices?: Array<{
    message?: {
      content?: string
    }
  }>
  error?: {
    message?: string
  }
}

interface AnthropicMessagesResponse {
  content?: Array<{
    type?: string
    text?: string
  }>
  error?: {
    message?: string
  }
}

export function buildEndpoint(baseUrl: string, requestPath: string): string {
  const normalizedBaseUrl: string = baseUrl.replace(/\/$/, "")
  const normalizedPath: string = requestPath.startsWith("/") ? requestPath : `/${requestPath}`
  if (normalizedBaseUrl.endsWith(normalizedPath)) {
    return normalizedBaseUrl
  }
  return `${normalizedBaseUrl}${normalizedPath}`
}

export function buildAuthorizationHeader(apiKey: string): string {
  return `Bearer ${apiKey.trim().replace(/^bearer\s+/i, "").trim()}`
}

export async function parseErrorResponse(response: Response): Promise<string> {
  const fallbackMessage: string = `请求失败：HTTP ${response.status}`

  try {
    const responseText: string = await response.text()
    if (responseText.trim().length === 0) {
      return fallbackMessage
    }

    const parsedBody: unknown = JSON.parse(responseText)
    if (typeof parsedBody === "object" && parsedBody !== null && "error" in parsedBody) {
      const errorValue: unknown = (parsedBody as { error?: unknown }).error
      if (typeof errorValue === "object" && errorValue !== null && "message" in errorValue) {
        const messageValue: unknown = (errorValue as { message?: unknown }).message
        return typeof messageValue === "string" ? messageValue : fallbackMessage
      }
      if (typeof errorValue === "string") {
        return errorValue
      }
    }

    return responseText.slice(0, 600)
  } catch {
    return fallbackMessage
  }
}

export function extractOpenAiContent(body: OpenAiChatCompletionResponse): string {
  const content: string = body.choices?.[0]?.message?.content?.trim() ?? ""
  if (content.length === 0) {
    const apiErrorMessage: string = body.error?.message ?? "OpenAI 兼容接口未返回可展示内容。"
    throw new Error(apiErrorMessage)
  }
  return content
}

export function extractAnthropicContent(body: AnthropicMessagesResponse): string {
  const textBlocks: string[] = body.content
    ?.filter((block) => block.type === "text" && typeof block.text === "string")
    .map((block) => block.text ?? "") ?? []
  const content: string = textBlocks.join("\n").trim()

  if (content.length === 0) {
    const apiErrorMessage: string = body.error?.message ?? "Claude Messages 兼容接口未返回可展示内容。"
    throw new Error(apiErrorMessage)
  }
  return content
}

async function runOpenAiCompatibleTool(request: RunToolRequest): Promise<RunToolResponse> {
  const endpoint: string = buildEndpoint(request.model.baseUrl, request.model.requestPath)
  const payload: OpenAiChatCompletionRequest = {
    model: request.model.id,
    messages: [
      {
        role: "system",
        content: request.tool.systemPrompt,
      },
      {
        role: "user",
        content: request.tool.buildUserPrompt(request.inputText),
      },
    ],
    temperature: request.model.defaultTemperature,
    stream: false,
  }

  const response: Response = await fetch(endpoint, {
    method: "POST",
    headers: {
      Authorization: buildAuthorizationHeader(request.apiKey),
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  })

  if (!response.ok) {
    throw new Error(await parseErrorResponse(response))
  }

  const body: OpenAiChatCompletionResponse = (await response.json()) as OpenAiChatCompletionResponse
  return {
    content: extractOpenAiContent(body),
    endpoint,
    provider: request.model.provider,
  }
}

async function runAnthropicCompatibleTool(request: RunToolRequest): Promise<RunToolResponse> {
  const endpoint: string = buildEndpoint(request.model.baseUrl, request.model.requestPath)
  const payload: AnthropicMessagesRequest = {
    model: request.model.id,
    max_tokens: 1800,
    temperature: request.model.defaultTemperature,
    system: request.tool.systemPrompt,
    messages: [
      {
        role: "user",
        content: request.tool.buildUserPrompt(request.inputText),
      },
    ],
  }

  const response: Response = await fetch(endpoint, {
    method: "POST",
    headers: {
      "x-api-key": request.apiKey.trim().replace(/^bearer\s+/i, "").trim(),
      Authorization: buildAuthorizationHeader(request.apiKey),
      "anthropic-version": "2023-06-01",
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  })

  if (!response.ok) {
    throw new Error(await parseErrorResponse(response))
  }

  const body: AnthropicMessagesResponse = (await response.json()) as AnthropicMessagesResponse
  return {
    content: extractAnthropicContent(body),
    endpoint,
    provider: request.model.provider,
  }
}

export async function runSheepAiTool(request: RunToolRequest): Promise<RunToolResponse> {
  const trimmedApiKey: string = request.apiKey.trim()
  const trimmedInputText: string = request.inputText.trim()

  if (trimmedApiKey.length === 0) {
    throw new Error("请输入 SheepAI API Key。")
  }

  if (trimmedInputText.length === 0) {
    throw new Error("请输入需要处理的文本。")
  }

  const normalizedRequest: RunToolRequest = {
    ...request,
    apiKey: trimmedApiKey,
    inputText: trimmedInputText,
  }

  if (request.model.provider === "openai-compatible") {
    return runOpenAiCompatibleTool(normalizedRequest)
  }

  return runAnthropicCompatibleTool(normalizedRequest)
}

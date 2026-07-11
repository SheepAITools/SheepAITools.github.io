import { TOOL_DEFINITIONS, getToolById } from "@/data/toolDefinitions"
import { filterModelsForTool } from "@/data/models"
import { normalizeToolImageOutput, runConfiguredTool } from "@/lib/genericAiClient"
import type { ApiConfiguration, ModelCapability, ModelDefinition, ModelIdGroups, ToolDefinition } from "@/types/sheepai"

export type AgentStepStatus = "pending" | "running" | "completed" | "failed" | "interrupted"
export type AgentSessionStatus = "idle" | "planning" | "running" | "completed" | "failed" | "interrupted"

export interface AgentPlanStep {
  toolId: string
  input: string
}

export interface AgentPlan {
  summary: string
  steps: AgentPlanStep[]
}

export interface AgentMessage {
  role: "user" | "assistant"
  content: string
  createdAt: number
}

export interface AgentSessionStep extends AgentPlanStep {
  id: string
  status: AgentStepStatus
  toolName?: string
  outputText?: string
  outputImage?: string
  endpoint?: string
  error?: string
}

export interface AgentSession {
  id: string
  userRequest: string
  status: AgentSessionStatus
  summary?: string
  messages: AgentMessage[]
  steps: AgentSessionStep[]
  error?: string
  createdAt: number
  updatedAt: number
}

export interface AgentRunContext {
  config: ApiConfiguration
  textModel: ModelDefinition
  availableModels: ModelDefinition[]
  onSessionChange?: (session: AgentSession) => void
}

const AGENT_ALLOWED_TOOL_IDS = new Set([
  "translation",
  "polishing",
  "summary",
  "prompt-optimizer",
  "code-explain",
  "code-generate",
  "text-correct",
  "format-convert",
  "image-generate",
])

const MAX_AGENT_STEPS = 6

const AGENT_PLANNER_TOOL: ToolDefinition = {
  id: "agent-planner",
  name: "智能体规划",
  shortName: "规划",
  category: "text",
  icon: "Sparkles",
  description: "理解用户需求并选择站内工具。",
  outputLabel: "执行计划",
  placeholder: "",
  systemPrompt: [
    "你是一个站内工具调度智能体，只能选择给定工具完成用户需求。",
    "你必须只输出 JSON，不要输出 Markdown、解释或额外文本。",
    "JSON 格式：{\"summary\":\"一句话说明计划\",\"steps\":[{\"toolId\":\"工具 ID\",\"input\":\"传给该工具的完整输入\"}]}。",
    "最多输出 6 个步骤。需要多张图片时，为每张图片创建一个 image-generate 步骤。",
    "不要选择需要上传文件或图片输入的工具。",
  ].join("\n"),
  buildUserPrompt: (inputText: string): string => inputText,
  defaultInput: "",
  modelFilter: "text",
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null
}

function asString(value: unknown): string {
  return typeof value === "string" ? value.trim() : ""
}

function extractJsonCandidate(content: string): string {
  const trimmed = content.trim()
  const fencedMatch = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i)
  if (fencedMatch?.[1]) return fencedMatch[1].trim()

  const firstBrace = trimmed.indexOf("{")
  const lastBrace = trimmed.lastIndexOf("}")
  if (firstBrace >= 0 && lastBrace > firstBrace) {
    return trimmed.slice(firstBrace, lastBrace + 1)
  }

  return trimmed
}

export function parseAgentPlan(content: string): AgentPlan {
  const parsed: unknown = JSON.parse(extractJsonCandidate(content))
  return sanitizeAgentPlan(parsed)
}

export function sanitizeAgentPlan(value: unknown): AgentPlan {
  if (!isRecord(value)) throw new Error("智能体没有返回可执行计划。")
  const rawSteps = Array.isArray(value.steps) ? value.steps : []
  const steps = rawSteps
    .map((step): AgentPlanStep | null => {
      if (!isRecord(step)) return null
      const toolId = asString(step.toolId)
      const input = asString(step.input)
      if (!AGENT_ALLOWED_TOOL_IDS.has(toolId)) return null
      if (!input) return null
      return { toolId, input }
    })
    .filter((step): step is AgentPlanStep => step !== null)
    .slice(0, MAX_AGENT_STEPS)

  if (steps.length === 0) throw new Error("智能体没有生成可执行步骤。")

  return {
    summary: asString(value.summary) || "已生成执行计划。",
    steps,
  }
}

export function getAgentCallableTools(): ToolDefinition[] {
  return TOOL_DEFINITIONS.filter((tool) => AGENT_ALLOWED_TOOL_IDS.has(tool.id))
}

export function getAgentTextModels(models: ModelDefinition[]): ModelDefinition[] {
  const explicitTextModels = models.filter((model) => model.enabled && model.capabilities?.includes("text"))
  if (explicitTextModels.length > 0) return explicitTextModels

  return models.filter((model) => {
    if (!model.enabled) return false
    if (model.ownedBy === "custom") return !looksLikeImageModel(model.id) && !/tts|speech|audio|voice/i.test(model.id)
    return model.modelType === "文本" && (
      model.tags.includes("对话") ||
      model.endpointTypes.includes("openai") ||
      model.endpointTypes.includes("anthropic") ||
      model.endpointTypes.includes("openai-response")
    )
  })
}

export function getAgentToolById(toolId: string): ToolDefinition | undefined {
  if (!AGENT_ALLOWED_TOOL_IDS.has(toolId)) return undefined
  return getToolById(toolId)
}

function normalizeStep(value: unknown, index: number): AgentSessionStep | null {
  if (!isRecord(value)) return null
  const toolId = asString(value.toolId)
  const input = asString(value.input)
  if (!AGENT_ALLOWED_TOOL_IDS.has(toolId) || !input) return null
  const rawStatus = asString(value.status)
  const status: AgentStepStatus = rawStatus === "completed" || rawStatus === "failed"
    ? rawStatus
    : rawStatus === "running" || rawStatus === "interrupted"
      ? "interrupted"
      : "pending"
  const tool = getToolById(toolId)

  return {
    id: asString(value.id) || `step-${index + 1}`,
    toolId,
    input,
    status,
    toolName: asString(value.toolName) || tool?.name,
    outputText: asString(value.outputText),
    outputImage: asString(value.outputImage),
    endpoint: asString(value.endpoint),
    error: asString(value.error),
  }
}

function normalizeMessage(value: unknown): AgentMessage | null {
  if (!isRecord(value)) return null
  const role = value.role === "assistant" ? "assistant" : value.role === "user" ? "user" : undefined
  const content = asString(value.content)
  if (!role || !content) return null
  const createdAt = typeof value.createdAt === "number" && Number.isFinite(value.createdAt)
    ? value.createdAt
    : Date.now()
  return { role, content, createdAt }
}

export function normalizeAgentSession(value: unknown): AgentSession {
  if (!isRecord(value)) throw new Error("invalid session")
  const now = Date.now()
  const steps = Array.isArray(value.steps)
    ? value.steps.map(normalizeStep).filter((step): step is AgentSessionStep => step !== null)
    : []
  const hasInterruptedStep = steps.some((step) => step.status === "interrupted")
  const rawStatus = asString(value.status)
  const status: AgentSessionStatus = hasInterruptedStep || rawStatus === "running" || rawStatus === "planning"
    ? "interrupted"
    : rawStatus === "completed" || rawStatus === "failed"
      ? rawStatus
      : "idle"

  return {
    id: asString(value.id) || crypto.randomUUID(),
    userRequest: asString(value.userRequest),
    status,
    summary: asString(value.summary),
    messages: Array.isArray(value.messages)
      ? value.messages.map(normalizeMessage).filter((message): message is AgentMessage => message !== null)
      : [],
    steps,
    error: asString(value.error),
    createdAt: typeof value.createdAt === "number" && Number.isFinite(value.createdAt) ? value.createdAt : now,
    updatedAt: typeof value.updatedAt === "number" && Number.isFinite(value.updatedAt) ? value.updatedAt : now,
  }
}

export function createAgentSession(userRequest: string): AgentSession {
  const now = Date.now()
  const trimmedRequest = userRequest.trim()
  return {
    id: crypto.randomUUID(),
    userRequest: trimmedRequest,
    status: "idle",
    messages: [{ role: "user", content: trimmedRequest, createdAt: now }],
    steps: [],
    createdAt: now,
    updatedAt: now,
  }
}

export function createStepsFromPlan(plan: AgentPlan): AgentSessionStep[] {
  return plan.steps.map((step, index) => {
    const tool = getToolById(step.toolId)
    return {
      ...step,
      id: `${Date.now()}-${index}`,
      status: "pending",
      toolName: tool?.name ?? step.toolId,
    }
  })
}

function buildPlannerPrompt(userRequest: string): string {
  const toolList = getAgentCallableTools()
    .map((tool) => `- ${tool.id}: ${tool.name}，${tool.description}`)
    .join("\n")

  return [
    "可调用工具：",
    toolList,
    "",
    "用户需求：",
    userRequest,
  ].join("\n")
}

function looksLikeImageModel(modelId: string): boolean {
  return /(^|[-_])(image|dall|flux|wan|sdxl|midjourney|mj)([-_]|$)|qwen-image|gpt-image/i.test(modelId)
}

function getCapabilityForTool(tool: Pick<ToolDefinition, "modelFilter">): ModelCapability | undefined {
  switch (tool.modelFilter) {
    case "text": return "text"
    case "image-gen": return "imageGeneration"
    case "image-edit": return "imageEdit"
    case "image-vision": return "vision"
    case "tts": return "tts"
    case "stt": return "stt"
    default: return undefined
  }
}

export function selectAgentModelForTool(availableModels: ModelDefinition[], tool: Pick<ToolDefinition, "id" | "modelFilter">, fallbackTextModel: ModelDefinition, groups?: ModelIdGroups): ModelDefinition | undefined {
  const capability = getCapabilityForTool(tool)
  const groupedModelIds = capability ? groups?.[capability] ?? [] : []
  if (groupedModelIds.length > 0) {
    const groupedModel = groupedModelIds
      .map((modelId) => availableModels.find((model) => model.id === modelId && model.enabled))
      .find((model): model is ModelDefinition => Boolean(model))
    if (groupedModel) return groupedModel
  }

  if (capability) {
    const taggedModel = availableModels.find((model) => model.enabled && model.capabilities?.includes(capability))
    if (taggedModel) return taggedModel
  }

  const compatibleModels = filterModelsForTool(availableModels, tool.modelFilter)
  if (tool.modelFilter === "text") {
    return compatibleModels.find((model) => model.id === fallbackTextModel.id) ?? compatibleModels[0] ?? fallbackTextModel
  }
  if (tool.modelFilter === "image-gen") {
    return compatibleModels.find((model) => looksLikeImageModel(model.id)) ?? compatibleModels[0]
  }
  return compatibleModels[0]
}

function emitSession(session: AgentSession, onSessionChange: AgentRunContext["onSessionChange"]): void {
  session.updatedAt = Date.now()
  onSessionChange?.({ ...session, messages: [...session.messages], steps: session.steps.map((step) => ({ ...step })) })
}

export async function planAgentSession(session: AgentSession, context: AgentRunContext): Promise<AgentSession> {
  const nextSession: AgentSession = {
    ...session,
    status: "planning",
    error: "",
    updatedAt: Date.now(),
  }
  emitSession(nextSession, context.onSessionChange)

  const response = await runConfiguredTool({
    apiKey: context.config.apiKey,
    model: context.textModel,
    tool: AGENT_PLANNER_TOOL,
    inputText: buildPlannerPrompt(nextSession.userRequest),
    timeoutSeconds: context.config.timeoutSeconds,
  })
  const plan = parseAgentPlan(response.content)
  nextSession.summary = plan.summary
  nextSession.steps = createStepsFromPlan(plan)
  nextSession.messages = [
    ...nextSession.messages,
    { role: "assistant", content: plan.summary, createdAt: Date.now() },
  ]
  nextSession.status = "running"
  emitSession(nextSession, context.onSessionChange)
  return nextSession
}

export async function executeAgentSession(session: AgentSession, context: AgentRunContext): Promise<AgentSession> {
  const nextSession: AgentSession = {
    ...session,
    status: "running",
    error: "",
    steps: session.steps.map((step) => step.status === "interrupted" ? { ...step, status: "pending" } : { ...step }),
    updatedAt: Date.now(),
  }
  emitSession(nextSession, context.onSessionChange)

  for (const step of nextSession.steps) {
    if (step.status === "completed") continue
    const tool = getAgentToolById(step.toolId)
    if (!tool) {
      step.status = "failed"
      step.error = "工具不可用。"
      emitSession(nextSession, context.onSessionChange)
      continue
    }

    const model = selectAgentModelForTool(context.availableModels, tool, context.textModel, context.config.modelIdGroups)
    if (!model) {
      step.status = "failed"
      step.error = "当前配置缺少该工具可用的模型。"
      emitSession(nextSession, context.onSessionChange)
      continue
    }

    step.status = "running"
    step.error = ""
    emitSession(nextSession, context.onSessionChange)

    try {
      const response = await runConfiguredTool({
        apiKey: context.config.apiKey,
        model,
        tool,
        inputText: step.input,
        timeoutSeconds: context.config.timeoutSeconds,
      })
      step.status = "completed"
      step.outputText = response.content
      step.outputImage = normalizeToolImageOutput(response.imageData)
      step.endpoint = response.endpoint
    } catch (error: unknown) {
      step.status = "failed"
      step.error = error instanceof Error ? error.message : "工具调用失败。"
    }

    emitSession(nextSession, context.onSessionChange)
  }

  nextSession.status = nextSession.steps.some((step) => step.status === "failed") ? "failed" : "completed"
  nextSession.messages = [
    ...nextSession.messages,
    {
      role: "assistant",
      content: nextSession.status === "completed" ? "已完成全部步骤。" : "部分步骤执行失败。",
      createdAt: Date.now(),
    },
  ]
  emitSession(nextSession, context.onSessionChange)
  return nextSession
}

export async function runAgentSession(session: AgentSession, context: AgentRunContext): Promise<AgentSession> {
  const plannedSession = session.steps.length > 0 ? session : await planAgentSession(session, context)
  return executeAgentSession(plannedSession, context)
}

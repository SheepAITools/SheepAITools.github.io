import { useMemo, useState } from "react"
import { useNavigate } from "react-router-dom"
import {
  AlertCircle, ArrowLeft, Bot, CheckCircle2, ImageIcon, Loader2,
  Play, RotateCcw, Sparkles, XCircle,
} from "lucide-react"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Textarea } from "@/components/ui/textarea"
import { ModelSelector } from "@/components/models/ModelSelector"
import { useApiConfig } from "@/components/config/useApiConfig"
import {
  createAgentSession,
  executeAgentSession,
  getAgentTextModels,
  planAgentSession,
  runAgentSession,
  type AgentSession,
  type AgentSessionStep,
} from "@/lib/agentRunner"
import { clearAgentSession, loadAgentSession, saveAgentSession } from "@/lib/agentSessionStore"
import { cn } from "@/lib/utils"

function getStatusLabel(status: AgentSession["status"] | AgentSessionStep["status"]): string {
  switch (status) {
    case "planning": return "规划中"
    case "running": return "运行中"
    case "completed": return "已完成"
    case "failed": return "失败"
    case "interrupted": return "已中断"
    default: return "待运行"
  }
}

function StepStatusIcon({ status }: { status: AgentSessionStep["status"] }) {
  if (status === "running") return <Loader2 className="h-4 w-4 animate-spin text-emerald-500" />
  if (status === "completed") return <CheckCircle2 className="h-4 w-4 text-emerald-500" />
  if (status === "failed") return <XCircle className="h-4 w-4 text-red-500" />
  if (status === "interrupted") return <AlertCircle className="h-4 w-4 text-amber-500" />
  return <Sparkles className="h-4 w-4 text-slate-300" />
}

function StepCard({ step, index }: { step: AgentSessionStep; index: number }) {
  return (
    <Card className="border-white/75 bg-white/90 shadow-lg shadow-slate-200/60">
      <CardHeader className="space-y-3">
        <div className="flex items-start justify-between gap-3">
          <div>
            <CardTitle className="text-base">步骤 {index + 1} · {step.toolName ?? step.toolId}</CardTitle>
            <CardDescription className="mt-2 break-words leading-6">{step.input}</CardDescription>
          </div>
          <Badge variant="outline" className="shrink-0 gap-1">
            <StepStatusIcon status={step.status} />
            {getStatusLabel(step.status)}
          </Badge>
        </div>
      </CardHeader>
      {(step.error || step.outputImage || step.outputText) && (
        <CardContent className="space-y-3">
          {step.error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>执行失败</AlertTitle>
              <AlertDescription>{step.error}</AlertDescription>
            </Alert>
          )}
          {step.outputImage && (
            <div className="overflow-hidden rounded-2xl border border-slate-200 bg-slate-50">
              <img src={step.outputImage} alt={`${step.toolName ?? step.toolId} 结果`} className="max-h-[420px] w-full object-contain" />
            </div>
          )}
          {step.outputText && step.outputText !== "图片已生成。" && (
            <pre className="whitespace-pre-wrap break-words rounded-2xl bg-slate-950 p-4 font-sans text-sm leading-7 text-slate-100">
              {step.outputText}
            </pre>
          )}
          {step.endpoint && (
            <p className="break-all rounded-xl bg-slate-50 p-3 font-mono text-xs text-slate-500">Request: {step.endpoint}</p>
          )}
        </CardContent>
      )}
    </Card>
  )
}

export function AgentPage() {
  const navigate = useNavigate()
  const { activeConfig, activeModel, availableModels, hasRunnableConfig } = useApiConfig()
  const [session, setSession] = useState<AgentSession | null>(() => loadAgentSession())
  const [inputText, setInputText] = useState(session?.userRequest ?? "")
  const [error, setError] = useState("")
  const [isRunning, setIsRunning] = useState(false)

  const textModels = useMemo(() => getAgentTextModels(availableModels), [availableModels])
  const textModel = useMemo(() => {
    return textModels.find((model) => model.id === activeModel?.id) ?? textModels[0]
  }, [activeModel?.id, textModels])
  const canRun = Boolean(activeConfig && hasRunnableConfig && textModel && !isRunning)
  const canResume = Boolean(session && session.steps.length > 0 && session.status !== "completed" && !isRunning)

  function updateSession(nextSession: AgentSession) {
    setSession(nextSession)
    saveAgentSession(nextSession)
  }

  function resetSession() {
    clearAgentSession()
    setSession(null)
    setInputText("")
    setError("")
  }

  async function runWithSession(targetSession: AgentSession, mode: "full" | "execute") {
    if (!activeConfig || !textModel) {
      setError("请先配置可用的文本模型。")
      return
    }

    setIsRunning(true)
    setError("")
    try {
      const context = {
        config: activeConfig,
        textModel,
        availableModels,
        onSessionChange: updateSession,
      }
      const result = mode === "execute"
        ? await executeAgentSession(targetSession, context)
        : await runAgentSession(targetSession, context)
      updateSession(result)
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "智能体运行失败。"
      const failedSession: AgentSession = {
        ...targetSession,
        status: "failed",
        error: message,
        updatedAt: Date.now(),
      }
      updateSession(failedSession)
      setError(message)
    } finally {
      setIsRunning(false)
    }
  }

  async function handleRun() {
    const trimmed = inputText.trim()
    if (!trimmed) {
      setError("请输入你的需求。")
      return
    }

    const nextSession = createAgentSession(trimmed)
    updateSession(nextSession)
    await runWithSession(nextSession, "full")
  }

  async function handleResume() {
    if (!session) return
    await runWithSession(session, session.steps.length > 0 ? "execute" : "full")
  }

  async function handleReplan() {
    if (!session || !activeConfig || !textModel) return
    const freshSession = createAgentSession(session.userRequest)
    updateSession(freshSession)
    setIsRunning(true)
    setError("")
    try {
      const planned = await planAgentSession(freshSession, {
        config: activeConfig,
        textModel,
        availableModels,
        onSessionChange: updateSession,
      })
      const result = await executeAgentSession(planned, {
        config: activeConfig,
        textModel,
        availableModels,
        onSessionChange: updateSession,
      })
      updateSession(result)
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "智能体运行失败。"
      updateSession({ ...freshSession, status: "failed", error: message, updatedAt: Date.now() })
      setError(message)
    } finally {
      setIsRunning(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Button variant="outline" size="sm" onClick={() => navigate("/console")}><ArrowLeft className="h-4 w-4" /> 返回</Button>
          <h2 className="text-2xl font-bold">工具智能体</h2>
          <Badge variant="secondary">多工具</Badge>
        </div>
        <ModelSelector toolModelFilter="text" />
      </div>

      {!textModel && (
        <Alert className="border-amber-200 bg-amber-50 text-amber-950">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>需要文本模型</AlertTitle>
          <AlertDescription className="text-amber-800">请先在 API 配置中添加并选择可用的文本模型。</AlertDescription>
        </Alert>
      )}

      {!hasRunnableConfig && (
        <Alert className="border-amber-200 bg-amber-50 text-amber-950">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>需要 API 配置</AlertTitle>
          <AlertDescription className="text-amber-800">填写 API 地址、API Key 和模型 ID 后即可运行智能体。</AlertDescription>
        </Alert>
      )}

      <div className="grid gap-6 lg:grid-cols-[360px_1fr]">
        <aside className="space-y-4">
          <Card className="border-white/75 bg-white/90 shadow-xl backdrop-blur-xl">
            <CardHeader>
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-950 text-white">
                <Bot className="h-5 w-5" />
              </div>
              <CardTitle>描述你的需求</CardTitle>
              <CardDescription className="leading-6">智能体会选择合适的站内工具，并按步骤执行。</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Textarea
                value={inputText}
                onChange={(event) => setInputText(event.target.value)}
                placeholder="例如：帮我生成 4 张适合小红书封面的赛博小羊配图，每张风格不同。"
                className="min-h-[180px] resize-y bg-white leading-7"
                disabled={isRunning}
              />
              <Button className="h-12 w-full" size="lg" onClick={handleRun} disabled={!canRun}>
                {isRunning ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
                {isRunning ? "运行中..." : "运行智能体"}
              </Button>
              <div className="grid grid-cols-2 gap-2">
                <Button variant="outline" onClick={handleResume} disabled={!canResume}>
                  <RotateCcw className="h-4 w-4" /> 继续
                </Button>
                <Button variant="outline" onClick={resetSession} disabled={isRunning || (!session && !inputText)}>
                  清空
                </Button>
              </div>
            </CardContent>
          </Card>

          {session && (
            <Card className="border-white/75 bg-white/90 shadow-lg">
              <CardHeader>
                <CardTitle className="text-base">当前会话</CardTitle>
                <CardDescription className="break-words leading-6">{session.userRequest}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                <div className="flex items-center justify-between rounded-xl bg-slate-50 px-3 py-2">
                  <span className="text-slate-500">状态</span>
                  <Badge variant={session.status === "failed" ? "destructive" : "outline"}>{getStatusLabel(session.status)}</Badge>
                </div>
                {session.summary && <p className="rounded-xl bg-slate-50 p-3 leading-6 text-slate-600">{session.summary}</p>}
                {session.status === "failed" && session.steps.length === 0 && (
                  <Button variant="outline" className="w-full" onClick={handleReplan} disabled={!activeConfig || !textModel || isRunning}>
                    重新规划
                  </Button>
                )}
              </CardContent>
            </Card>
          )}
        </aside>

        <main className="space-y-4">
          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>运行失败</AlertTitle>
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {!session && (
            <div className="flex min-h-[420px] flex-col items-center justify-center rounded-3xl border border-white/75 bg-white/90 p-8 text-center shadow-xl backdrop-blur-xl">
              <Sparkles className="h-10 w-10 text-slate-300" />
              <h3 className="mt-4 text-lg font-bold text-slate-700">结果将在这里展示</h3>
              <p className="mt-2 max-w-md text-sm leading-6 text-slate-500">输入需求后，智能体会生成计划并展示每一步结果。</p>
            </div>
          )}

          {session && session.steps.length === 0 && (
            <div className={cn("flex min-h-[320px] flex-col items-center justify-center rounded-3xl border border-white/75 bg-white/90 p-8 text-center shadow-xl backdrop-blur-xl", isRunning && "animate-pulse")}>
              {isRunning ? <Loader2 className="h-10 w-10 animate-spin text-emerald-500" /> : <Bot className="h-10 w-10 text-slate-300" />}
              <h3 className="mt-4 text-lg font-bold text-slate-700">{isRunning ? "正在规划" : "等待计划"}</h3>
            </div>
          )}

          {session?.steps.map((step, index) => <StepCard key={step.id} step={step} index={index} />)}

          {session?.steps.some((step) => step.outputImage) && (
            <Card className="border-white/75 bg-white/90 shadow-xl">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base"><ImageIcon className="h-4 w-4" /> 图片结果</CardTitle>
              </CardHeader>
              <CardContent className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {session.steps.filter((step) => step.outputImage).map((step) => (
                  <a key={`${step.id}-image`} href={step.outputImage} target="_blank" rel="noreferrer"
                    className="overflow-hidden rounded-2xl border border-slate-200 bg-slate-50 transition hover:border-emerald-300">
                    <img src={step.outputImage} alt={step.input} className="aspect-square w-full object-cover" />
                  </a>
                ))}
              </CardContent>
            </Card>
          )}
        </main>
      </div>
    </div>
  )
}

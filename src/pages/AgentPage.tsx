import { useEffect, useMemo, useState } from "react"
import { useNavigate } from "react-router-dom"
import {
  AlertCircle, ArrowLeft, Bot, CheckCircle2, ImageIcon, Loader2,
  Play, RotateCcw, Sparkles, XCircle,
} from "lucide-react"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
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
  prepareSessionForFollowUp,
  prepareFailedStepsForRetry,
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
    case "skipped": return "已跳过"
    default: return "待运行"
  }
}

function StepStatusIcon({ status }: { status: AgentSessionStep["status"] }) {
  if (status === "running") return <Loader2 className="h-4 w-4 animate-spin text-emerald-500" />
  if (status === "completed") return <CheckCircle2 className="h-4 w-4 text-emerald-500" />
  if (status === "failed") return <XCircle className="h-4 w-4 text-red-500" />
  if (status === "interrupted") return <AlertCircle className="h-4 w-4 text-amber-500" />
  if (status === "skipped") return <AlertCircle className="h-4 w-4 text-slate-400" />
  return <Sparkles className="h-4 w-4 text-slate-300" />
}

function StepStatusRow({ step, index }: { step: AgentSessionStep; index: number }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3">
      <div className="flex items-start gap-3">
        <div className={cn(
          "mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold",
          step.status === "completed" ? "border border-emerald-200 bg-white text-emerald-700" :
            step.status === "failed" ? "border border-red-200 bg-white text-red-700" :
              step.status === "running" ? "border border-sky-200 bg-white text-sky-700" : "border border-slate-300 bg-white text-slate-700",
        )}>
          {index + 1}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="truncate text-sm font-semibold text-slate-950">{step.toolName ?? step.toolId}</p>
            <Badge variant="outline" className="shrink-0 gap-1">
              <StepStatusIcon status={step.status} />
              {getStatusLabel(step.status)}
            </Badge>
          </div>
          <p className="mt-1 line-clamp-2 text-xs leading-5 text-slate-500">{step.input}</p>
          {step.error && <p className="mt-2 line-clamp-2 text-xs leading-5 text-red-500">{step.error}</p>}
        </div>
      </div>
    </div>
  )
}

function TextResultCard({ step, index }: { step: AgentSessionStep; index: number }) {
  if (!step.outputText || step.outputText === "图片已生成。") return null
  return (
    <Card className="border-white/75 bg-white/90 shadow-lg">
      <CardHeader>
        <CardTitle className="text-base">文本结果 {index + 1}</CardTitle>
        <CardDescription className="line-clamp-2">{step.input}</CardDescription>
      </CardHeader>
      <CardContent>
        <pre className="whitespace-pre-wrap break-words rounded-2xl bg-slate-950 p-4 font-sans text-sm leading-7 text-slate-100">
          {step.outputText}
        </pre>
      </CardContent>
    </Card>
  )
}

export function AgentPage() {
  const navigate = useNavigate()
  const { activeConfig, activeModel, availableModels, hasRunnableConfig } = useApiConfig()
  const [session, setSession] = useState<AgentSession | null>(null)
  const [inputText, setInputText] = useState("")
  const [error, setError] = useState("")
  const [isRunning, setIsRunning] = useState(false)
  const [isSessionLoaded, setIsSessionLoaded] = useState(false)

  useEffect(() => {
    let isMounted = true

    loadAgentSession().then((loadedSession) => {
      if (!isMounted) return
      if (loadedSession) {
        setSession(loadedSession)
        setInputText(loadedSession.userRequest)
      }
      setIsSessionLoaded(true)
    })

    return () => {
      isMounted = false
    }
  }, [])

  const textModels = useMemo(() => getAgentTextModels(availableModels), [availableModels])
  const textModel = useMemo(() => {
    return textModels.find((model) => model.id === activeModel?.id) ?? textModels[0]
  }, [activeModel?.id, textModels])
  const canRun = Boolean(activeConfig && hasRunnableConfig && textModel && !isRunning && isSessionLoaded)
  const failedStepCount = session?.steps.filter((step) => step.status === "failed" || step.status === "interrupted" || step.status === "skipped").length ?? 0
  const completedStepCount = session?.steps.filter((step) => step.status === "completed").length ?? 0
  const runningStepCount = session?.steps.filter((step) => step.status === "running").length ?? 0
  const canRetryFailed = Boolean(session && failedStepCount > 0 && !isRunning)

  function updateSession(nextSession: AgentSession): Promise<void> {
    setSession(nextSession)
    return saveAgentSession(nextSession)
  }

  function resetSession() {
    void clearAgentSession()
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
      await updateSession(result)
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "智能体运行失败。"
      const failedSession: AgentSession = {
        ...targetSession,
        status: "failed",
        error: message,
        updatedAt: Date.now(),
      }
      await updateSession(failedSession)
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

    const nextSession = session ? prepareSessionForFollowUp(session, trimmed) : createAgentSession(trimmed)
    await updateSession(nextSession)
    await runWithSession(nextSession, "full")
  }

  function handleNewSessionConfirmed() {
    resetSession()
  }

  async function handleRetryFailed() {
    if (!session) return
    await runWithSession(prepareFailedStepsForRetry(session), "execute")
  }

  async function handleReplan() {
    if (!session || !activeConfig || !textModel) return
    const freshSession = createAgentSession(session.userRequest)
    await updateSession(freshSession)
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
      await updateSession(result)
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "智能体运行失败。"
      await updateSession({ ...freshSession, status: "failed", error: message, updatedAt: Date.now() })
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
                {isRunning ? "运行中..." : session ? "发送到当前会话" : "运行智能体"}
              </Button>
              <div className="grid grid-cols-2 gap-2">
                <Button variant="outline" onClick={handleRetryFailed} disabled={!canRetryFailed}>
                  <RotateCcw className="h-4 w-4" /> 重试失败
                </Button>
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="outline" disabled={isRunning || !session}>
                      新会话
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>开始新的会话？</AlertDialogTitle>
                      <AlertDialogDescription>
                        开启新会话会清空当前会话信息和已保存的结果。
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>取消</AlertDialogCancel>
                      <AlertDialogAction onClick={handleNewSessionConfirmed}>确定</AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
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
                <div className="grid grid-cols-3 gap-2">
                  <div className="rounded-xl bg-emerald-50 px-3 py-2 text-center">
                    <p className="text-xs text-emerald-600">成功</p>
                    <p className="mt-1 font-bold text-emerald-700">{completedStepCount}</p>
                  </div>
                  <div className="rounded-xl bg-red-50 px-3 py-2 text-center">
                    <p className="text-xs text-red-600">失败</p>
                    <p className="mt-1 font-bold text-red-700">{failedStepCount}</p>
                  </div>
                  <div className="rounded-xl bg-sky-50 px-3 py-2 text-center">
                    <p className="text-xs text-sky-700">运行</p>
                    <p className="mt-1 font-bold text-sky-800">{runningStepCount}</p>
                  </div>
                </div>
                {session.summary && <p className="rounded-xl bg-slate-50 p-3 leading-6 text-slate-600">{session.summary}</p>}
                {failedStepCount > 0 && (
                  <Button variant="outline" className="w-full" onClick={handleRetryFailed} disabled={!canRetryFailed}>
                    <RotateCcw className="h-4 w-4" /> 重试失败任务
                  </Button>
                )}
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

          {session?.steps.some((step) => step.outputImage) && (
            <Card className="border-white/75 bg-white/90 shadow-xl">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base"><ImageIcon className="h-4 w-4" /> 最终结果</CardTitle>
                <CardDescription>已成功生成的图片会集中展示在这里。</CardDescription>
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

          {session?.steps.some((step) => step.outputText && step.outputText !== "图片已生成。") && (
            <div className="space-y-4">
              {session.steps.map((step, index) => <TextResultCard key={`${step.id}-text`} step={step} index={index} />)}
            </div>
          )}

          {session && session.steps.length > 0 && (
            <Card className="border-white/75 bg-white/90 shadow-xl">
              <CardHeader>
                <CardTitle className="text-base">执行状态</CardTitle>
                <CardDescription>{completedStepCount} / {session.steps.length} 个步骤已完成</CardDescription>
              </CardHeader>
              <CardContent className="space-y-2">
                {session.steps.map((step, index) => <StepStatusRow key={step.id} step={step} index={index} />)}
              </CardContent>
            </Card>
          )}
        </main>
      </div>
    </div>
  )
}

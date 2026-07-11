import { useNavigate } from "react-router-dom"
import { AlertCircle, ArrowRight, Bot, KeyRound, Sparkles, type LucideIcon } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { ModelSelector } from "@/components/models/ModelSelector"
import { useApiConfig } from "@/components/config/useApiConfig"
import { TOOL_DEFINITIONS } from "@/data/toolDefinitions"
import * as LucideIcons from "lucide-react"
import type { ToolDefinition } from "@/types/sheepai"

function getIcon(name: string): LucideIcon {
  return (LucideIcons as unknown as Record<string, LucideIcon>)[name] || Sparkles
}

const CAT_LABELS: Record<string, string> = { text: "文本工具", image: "图像工具", audio: "音频工具" }

export function ConsolePage() {
  const { activeConfig, availableModels, hasRunnableConfig } = useApiConfig()
  const navigate = useNavigate()

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="rounded-3xl border border-white/70 bg-white/85 p-6 shadow-xl backdrop-blur-xl sm:p-8">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div className="space-y-3">
            <Badge variant="secondary">{TOOL_DEFINITIONS.length} 个工具可用</Badge>
            <h2 className="text-3xl font-black tracking-tight sm:text-4xl">控制台</h2>
            <p className="max-w-2xl text-slate-500">选择工具开始调用；API 配置和模型可在右上角切换。</p>
          </div>
          <ModelSelector />
        </div>
      </div>

      {!hasRunnableConfig && (
        <Alert className="border-amber-200 bg-amber-50 text-amber-950">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>需要 API 配置</AlertTitle>
          <AlertDescription className="flex flex-col gap-3 text-amber-800 sm:flex-row sm:items-center sm:justify-between">
            <span>填写 API 地址、API Key 和模型 ID 后即可运行工具。</span>
            <Button size="sm" onClick={() => navigate("/settings")} className="w-fit">
              <KeyRound className="h-4 w-4" /> 去配置
            </Button>
          </AlertDescription>
        </Alert>
      )}

      {hasRunnableConfig && activeConfig && (
        <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-white/75 bg-white/90 px-4 py-3 text-sm shadow-lg backdrop-blur-xl">
          <KeyRound className="h-4 w-4 text-slate-400" />
          <span className="font-semibold">{activeConfig.name}</span>
          <span className="text-slate-400">·</span>
          <span className="text-slate-500">{availableModels.length} 个模型</span>
          <span className="text-slate-400">·</span>
          <span className="truncate font-mono text-xs text-slate-500">{activeConfig.apiBaseUrl}</span>
        </div>
      )}

      <button type="button" onClick={() => navigate("/agent")}
        disabled={!hasRunnableConfig}
        className="group w-full rounded-3xl border border-white/75 bg-white/90 p-5 text-left shadow-lg shadow-slate-200/60 transition hover:-translate-y-1 hover:border-emerald-200 hover:shadow-2xl hover:shadow-emerald-100/70 disabled:cursor-not-allowed disabled:opacity-60">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-start gap-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-slate-950 text-white transition group-hover:bg-emerald-500">
              <Bot className="h-5 w-5" />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="text-lg font-bold text-slate-950">工具智能体</h3>
                <Badge variant="secondary">多工具</Badge>
              </div>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">描述需求后自动选择并调用站内工具，适合批量生成和组合任务。</p>
            </div>
          </div>
          <ArrowRight className="mt-3 h-5 w-5 text-slate-300 transition group-hover:translate-x-1 group-hover:text-emerald-500" />
        </div>
      </button>

      {/* Tool categories */}
      {(["text", "image", "audio"] as const).map((cat) => {
        const tools = TOOL_DEFINITIONS.filter((t) => t.category === cat)
        if (tools.length === 0) return null
        return (
          <div key={cat}>
            <h3 className="text-lg font-bold text-slate-600 mb-3">{CAT_LABELS[cat]}</h3>
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {tools.map((tool: ToolDefinition) => {
                const Icon = getIcon(tool.icon)
                return (
                  <button key={tool.id} type="button" onClick={() => navigate(`/tools/${tool.id}`)}
                    disabled={!hasRunnableConfig}
                    className="group rounded-3xl border border-white/75 bg-white/90 p-5 text-left shadow-lg shadow-slate-200/60 transition hover:-translate-y-1 hover:border-emerald-200 hover:shadow-2xl hover:shadow-emerald-100/70 disabled:cursor-not-allowed disabled:opacity-60">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-950 text-white transition group-hover:bg-emerald-500">
                        <Icon className="h-5 w-5" />
                      </div>
                      <ArrowRight className="mt-3 h-5 w-5 text-slate-300 transition group-hover:translate-x-1 group-hover:text-emerald-500" />
                    </div>
                    <h3 className="mt-5 text-lg font-bold text-slate-950">{tool.name}</h3>
                    <p className="mt-2 line-clamp-3 text-sm leading-6 text-slate-500">{tool.description}</p>
                  </button>
                )
              })}
            </div>
          </div>
        )
      })}
    </div>
  )
}

import { useNavigate } from "react-router-dom"
import { AlertCircle, ArrowRight, Sparkles, type LucideIcon } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { ModelSelector } from "@/components/models/ModelSelector"
import { useAuth } from "@/components/auth/AuthProvider"
import { TOOL_DEFINITIONS } from "@/data/toolDefinitions"
import * as LucideIcons from "lucide-react"
import type { ToolDefinition } from "@/types/sheepai"

function getIcon(name: string): LucideIcon {
  return (LucideIcons as unknown as Record<string, LucideIcon>)[name] || Sparkles
}

const CAT_LABELS: Record<string, string> = { text: "文本工具", image: "图像工具", audio: "音频工具" }

export function ConsolePage() {
  const { state, selectedToken } = useAuth()
  const navigate = useNavigate()
  const hasKey = (selectedToken?.apiKey ?? "").trim().length > 0
  const hasModels = state.availableModels.length > 0

  return (
    <div className="space-y-8">
      <div className="rounded-3xl border border-white/70 bg-white/85 p-6 shadow-xl backdrop-blur-xl sm:p-8">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div className="space-y-3">
            <Badge variant="secondary">{TOOL_DEFINITIONS.length} 个工具可用</Badge>
            <h2 className="text-3xl font-black tracking-tight sm:text-4xl">控制台</h2>
            <p className="max-w-2xl text-slate-500">确认 API Key 与模型后，选择一个工具开始调用。</p>
          </div>
          <ModelSelector />
        </div>
      </div>

      {state.errorMessage && (
        <Alert variant="destructive"><AlertCircle className="h-4 w-4" /><AlertTitle>需要处理</AlertTitle><AlertDescription>{state.errorMessage}</AlertDescription></Alert>
      )}

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
                    disabled={!hasKey || !hasModels}
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

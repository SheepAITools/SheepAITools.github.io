import { useState, useMemo } from "react"
import { Check, ChevronDown, ChevronRight, Search, X, Sparkles, AlertTriangle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { DropdownMenu, DropdownMenuContent, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { ScrollArea } from "@/components/ui/scroll-area"
import { useAuth } from "@/components/auth/AuthProvider"
import { groupModelsByProvider, getProviderName, filterModelsForTool } from "@/data/models"
import { cn } from "@/lib/utils"
import type { ModelDefinition, ProviderGroup } from "@/types/sheepai"

// Recommended model IDs that are highlighted at the top
const RECOMMENDED_MODEL_IDS = new Set([
  "gpt-4o-mini", "gpt-4o", "gpt-5", "claude-sonnet-4-5-20250915",
  "claude-opus-4-7", "deepseek-v4-pro", "deepseek-v4-flash",
  "qwen3-235b-a22b-instruct-2507", "qwen3-max", "kimi-k2",
  "gpt-image-1", "qwen-image-max-2025-12-30", "tts-1",
])

function getModelTypeBadge(modelType: string) {
  switch (modelType) {
    case "文本": return { label: "文本", className: "bg-blue-50 text-blue-700 border-blue-200" }
    case "图像": return { label: "图像", className: "bg-purple-50 text-purple-700 border-purple-200" }
    case "音视频": return { label: "音视频", className: "bg-orange-50 text-orange-700 border-orange-200" }
    case "检索": return { label: "检索", className: "bg-slate-50 text-slate-600 border-slate-200" }
    default: return { label: modelType || "未知", className: "bg-slate-50 text-slate-500 border-slate-200" }
  }
}

function getTagBadgeStyle(tag: string) {
  if (["对话", "思考"].includes(tag)) return "bg-blue-50 text-blue-600 border-blue-100"
  if (["识图", "工具"].includes(tag)) return "bg-green-50 text-green-600 border-green-100"
  if (["绘画"].includes(tag)) return "bg-purple-50 text-purple-600 border-purple-100"
  if (["音频", "视频"].includes(tag)) return "bg-orange-50 text-orange-600 border-orange-100"
  if (["弃用"].includes(tag)) return "bg-red-50 text-red-500 border-red-100"
  return "bg-slate-50 text-slate-500 border-slate-100"
}

interface ModelSelectorProps {
  toolModelFilter?: string
  className?: string
}

export function ModelSelector({ toolModelFilter, className }: ModelSelectorProps) {
  const { state, selectModel, selectedModel } = useAuth()
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState("")
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set())

  const { filtered, recommended, groups, incompatibleCount } = useMemo(() => {
    let all = state.availableModels
    const allCount = all.length

    // Filter by tool type
    if (toolModelFilter) {
      all = filterModelsForTool(all, toolModelFilter)
    }

    // Search filter
    let searched = all
    if (search.trim()) {
      const q = search.toLowerCase()
      searched = all.filter((m) =>
        m.id.toLowerCase().includes(q) ||
        m.ownedBy.toLowerCase().includes(q) ||
        getProviderName(m.ownedBy).includes(q) ||
        m.tags.some((t) => t.includes(q)) ||
        (m.description && m.description.toLowerCase().includes(q))
      )
    }

    // Split recommended from others
    const recs = searched.filter((m) => RECOMMENDED_MODEL_IDS.has(m.id))
    const rest = searched.filter((m) => !RECOMMENDED_MODEL_IDS.has(m.id))
    const groups = groupModelsByProvider(rest)
    const incompatibleCount = toolModelFilter ? allCount - all.length : 0

    return { filtered: searched, recommended: recs, groups, incompatibleCount }
  }, [state.availableModels, toolModelFilter, search])

  // Auto-collapse large groups
  const displayGroups = useMemo(() => {
    if (search.trim() && filtered.length <= 20) {
      // When searching with few results, expand all
      return groups.map(g => ({ ...g, collapsed: false }))
    }
    return groups.map(g => ({
      ...g,
      collapsed: collapsedGroups.has(g.providerKey)
    }))
  }, [groups, collapsedGroups, search, filtered.length])

  function toggleGroup(key: string) {
    setCollapsedGroups(prev => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  if (state.availableModels.length === 0) {
    return <Button variant="outline" size="sm" disabled className={className}>暂无可用模型</Button>
  }

  const totalAvailable = state.availableModels.length

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className={cn("gap-1 max-w-[220px]", className)}>
          <span className="truncate text-xs">{selectedModel?.id ?? "选择模型"}</span>
          <ChevronDown className="h-3 w-3 shrink-0 ml-auto" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-[460px] p-0" sideOffset={8}>
        {/* Header with search */}
        <div className="flex items-center border-b px-3 py-2 gap-2">
          <Search className="h-4 w-4 text-slate-400 shrink-0" />
          <Input value={search} onChange={(e) => setSearch(e.target.value)}
            placeholder={`搜索 ${totalAvailable} 个模型...`}
            className="border-0 shadow-none focus-visible:ring-0 h-8 text-sm px-0" />
          {search && <Button variant="ghost" size="icon" className="h-6 w-6 shrink-0" onClick={() => setSearch("")}><X className="h-3 w-3" /></Button>}
        </div>

        {/* Filter info bar */}
        {toolModelFilter && (
          <div className="px-3 py-1.5 text-xs text-slate-500 bg-slate-50 border-b flex items-center gap-2">
            <Sparkles className="h-3 w-3 text-amber-500" />
            已按工具类型筛选
            {incompatibleCount > 0 && (
              <span className="text-slate-400">（隐藏了 {incompatibleCount} 个不兼容模型）</span>
            )}
            {filtered.length === 0 && (
              <span className="text-red-500 flex items-center gap-1"><AlertTriangle className="h-3 w-3" />没有匹配的模型</span>
            )}
          </div>
        )}

        <ScrollArea className="max-h-[420px]">
          {/* Recommended section */}
          {recommended.length > 0 && !search.trim() && (
            <div className="border-b border-amber-100 bg-amber-50/50">
              <div className="px-3 py-1.5 text-xs font-semibold text-amber-700 uppercase tracking-wider">
                推荐模型 · {recommended.length}
              </div>
              {recommended.map((model: ModelDefinition) => renderModelRow(model, selectedModel, selectModel, () => setOpen(false)))}
            </div>
          )}

          {/* Provider groups */}
          {displayGroups.length === 0 ? (
            <div className="px-4 py-8 text-center text-sm text-slate-500">
              {search ? "没有匹配的模型" : "没有兼容的模型"}
            </div>
          ) : (
            displayGroups.map((group: ProviderGroup & { collapsed?: boolean }) => (
              <div key={group.providerKey}>
                <button
                  type="button"
                  onClick={() => toggleGroup(group.providerKey)}
                  className="sticky top-0 bg-white w-full flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-400 uppercase tracking-wider border-b hover:bg-slate-50 transition-colors"
                >
                  <ChevronRight className={cn("h-3 w-3 transition-transform", !group.collapsed && "rotate-90")} />
                  {group.providerName}
                  <span className="font-normal text-slate-300 ml-1">({group.models.length})</span>
                </button>
                {!group.collapsed && group.models.map((model: ModelDefinition) =>
                  renderModelRow(model, selectedModel, selectModel, () => setOpen(false))
                )}
              </div>
            ))
          )}
        </ScrollArea>

        {/* Footer */}
        <div className="border-t px-3 py-2 text-xs text-slate-400 flex items-center justify-between">
          <span>{totalAvailable} 个模型 · {filtered.length} 个可选</span>
          {toolModelFilter && <Badge variant="secondary" className="text-[10px]">已筛选</Badge>}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

function renderModelRow(
  model: ModelDefinition,
  selectedModel: ModelDefinition | undefined,
  selectModel: (id: string) => void,
  close: () => void,
) {
  const isSelected = selectedModel?.id === model.id
  const typeBadge = getModelTypeBadge(model.modelType)

  return (
    <button key={model.id} type="button"
      onClick={() => { selectModel(model.id); close() }}
      disabled={!model.enabled}
      className={cn(
        "w-full flex items-start gap-3 px-3 py-2.5 text-left hover:bg-slate-50 transition-colors",
        isSelected && "bg-emerald-50",
        !model.enabled && "opacity-40 cursor-not-allowed",
      )}>
      <div className={cn("mt-0.5 h-4 w-4 rounded-full border-2 flex items-center justify-center shrink-0",
        isSelected ? "border-emerald-500 bg-emerald-500" : "border-slate-300")}>
        {isSelected && <Check className="h-3 w-3 text-white" />}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-sm font-medium text-slate-900 truncate max-w-[180px]">{model.id}</span>
          <Badge variant="outline" className={cn("text-[10px] px-1 py-0 leading-normal", typeBadge.className)}>
            {typeBadge.label}
          </Badge>
          {model.tags.filter(t => t !== "弃用").slice(0, 2).map((tag) => (
            <Badge key={tag} variant="outline" className={cn("text-[10px] px-1 py-0 leading-normal", getTagBadgeStyle(tag))}>
              {tag}
            </Badge>
          ))}
        </div>
        {model.description && (
          <p className="text-xs text-slate-400 mt-0.5 line-clamp-1 leading-relaxed">{model.description}</p>
        )}
      </div>
    </button>
  )
}

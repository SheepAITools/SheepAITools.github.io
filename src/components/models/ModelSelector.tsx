import { useState, useMemo } from "react"
import { Check, ChevronDown, Search, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { DropdownMenu, DropdownMenuContent, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { ScrollArea } from "@/components/ui/scroll-area"
import { useAuth } from "@/components/auth/AuthProvider"
import { groupModelsByProvider, getProviderName, filterModelsForTool } from "@/data/models"
import { cn } from "@/lib/utils"
import type { ModelDefinition } from "@/types/sheepai"

interface ModelSelectorProps {
  toolModelFilter?: string
  className?: string
}

export function ModelSelector({ toolModelFilter, className }: ModelSelectorProps) {
  const { state, selectModel, selectedModel } = useAuth()
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState("")

  const filteredModels = useMemo(() => {
    let models = state.availableModels
    if (toolModelFilter) models = filterModelsForTool(models, toolModelFilter)
    if (search.trim()) {
      const q = search.toLowerCase()
      models = models.filter((m) =>
        m.id.toLowerCase().includes(q) || m.ownedBy.toLowerCase().includes(q) ||
        m.tags.some((t) => t.includes(q)) || getProviderName(m.ownedBy).includes(q))
    }
    return models
  }, [state.availableModels, toolModelFilter, search])

  const groups = useMemo(() => groupModelsByProvider(filteredModels), [filteredModels])

  if (state.availableModels.length === 0) {
    return <Button variant="outline" size="sm" disabled className={className}>暂无可用模型</Button>
  }

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className={cn("gap-1 max-w-[200px]", className)}>
          <span className="truncate text-xs">{selectedModel?.id ?? "选择模型"}</span>
          <ChevronDown className="h-3 w-3 shrink-0" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-[420px] p-0" sideOffset={8}>
        <div className="flex items-center border-b px-3 py-2">
          <Search className="h-4 w-4 text-slate-400 shrink-0" />
          <Input value={search} onChange={(e) => setSearch(e.target.value)}
            placeholder="搜索模型名称、供应商..." className="border-0 shadow-none focus-visible:ring-0 h-8 text-sm" />
          {search && <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setSearch("")}><X className="h-3 w-3" /></Button>}
        </div>
        <ScrollArea className="max-h-[400px]">
          {groups.length === 0 ? (
            <div className="px-4 py-8 text-center text-sm text-slate-500">{toolModelFilter ? "没有匹配当前工具的模型" : "没有匹配的模型"}</div>
          ) : (
            groups.map((group) => (
              <div key={group.providerKey}>
                <div className="sticky top-0 bg-white px-3 py-1.5 text-xs font-semibold text-slate-400 uppercase tracking-wider border-b">
                  {group.providerName}<span className="ml-1 font-normal">({group.models.length})</span>
                </div>
                {group.models.map((model: ModelDefinition) => {
                  const isSelected = selectedModel?.id === model.id
                  return (
                    <button key={model.id} type="button"
                      onClick={() => { selectModel(model.id); setOpen(false) }}
                      disabled={!model.enabled}
                      className={cn("w-full flex items-start gap-3 px-3 py-2.5 text-left hover:bg-slate-50 transition-colors",
                        isSelected && "bg-emerald-50", !model.enabled && "opacity-40 cursor-not-allowed")}>
                      <div className={cn("mt-0.5 h-4 w-4 rounded-full border-2 flex items-center justify-center shrink-0",
                        isSelected ? "border-emerald-500 bg-emerald-500" : "border-slate-300")}>
                        {isSelected && <Check className="h-3 w-3 text-white" />}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-medium text-slate-900 truncate">{model.id}</span>
                          <Badge variant="outline" className="text-[10px] px-1.5 py-0">{model.modelType}</Badge>
                          {model.tags.slice(0, 2).map((tag) => (
                            <Badge key={tag} variant="secondary" className="text-[10px] px-1.5 py-0">{tag}</Badge>
                          ))}
                        </div>
                        {model.description && <p className="text-xs text-slate-500 mt-0.5 line-clamp-1">{model.description}</p>}
                      </div>
                    </button>
                  )
                })}
              </div>
            ))
          )}
        </ScrollArea>
        <div className="border-t px-3 py-2 text-xs text-slate-400">共 {filteredModels.length} 个模型，{groups.length} 个供应商</div>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

import { Link, useNavigate } from "react-router-dom"
import {
  ChevronDown,
  ExternalLink,
  KeyRound,
  Settings,
  Sparkles,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { useApiConfig } from "@/components/config/useApiConfig"
import { ModelSelector } from "@/components/models/ModelSelector"

const SHEEPAI_HOME = "https://www.sheepai.top"

export function Navbar() {
  const { state, activeConfig, selectConfig } = useApiConfig()
  const navigate = useNavigate()

  return (
    <header className="sticky top-0 z-30 border-b border-white/70 bg-white/80 backdrop-blur-xl">
      <div className="flex items-center gap-3 px-4 py-3 sm:px-6 lg:px-8">
        {/* Logo */}
        <Link to="/console" className="flex items-center gap-3 shrink-0">
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-slate-950 text-white shadow-lg">
            <Sparkles className="h-5 w-5" />
          </div>
          <div className="hidden lg:block">
            <p className="text-xs font-medium uppercase tracking-[0.2em] text-slate-400">Cyber SheepAI Toolbox</p>
            <h1 className="text-base font-bold tracking-tight">赛博小羊的ai工具箱</h1>
          </div>
        </Link>

        {/* Token & Model selectors */}
        <div className="hidden md:flex items-center gap-2 ml-4">
          {state.configs.length > 0 && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="gap-1 max-w-[180px]">
                  <KeyRound className="h-3.5 w-3.5 shrink-0 text-slate-400" />
                  <span className="truncate text-xs">{activeConfig?.name ?? "API 配置"}</span>
                  <ChevronDown className="h-3 w-3 shrink-0" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-64">
                <DropdownMenuLabel>切换 API 配置</DropdownMenuLabel>
                {state.configs.map((config) => (
                  <DropdownMenuItem key={config.id} onClick={() => selectConfig(config.id)}>
                    <span className="truncate">{config.name}</span>
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          )}
          <ModelSelector />
        </div>

        <div className="flex-1" />

        {/* Actions */}
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" asChild>
            <a href={SHEEPAI_HOME} target="_blank" rel="noreferrer">
              SheepAI
              <ExternalLink className="h-3 w-3 ml-1" />
            </a>
          </Button>

          <Button variant="ghost" size="icon" onClick={() => navigate("/settings")} aria-label="设置">
            <Settings className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </header>
  )
}

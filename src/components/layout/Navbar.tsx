import { Link, useNavigate } from "react-router-dom"
import {
  ChevronDown,
  ExternalLink,
  LogOut,
  Settings,
  Sparkles,
  UserRound,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { useAuth } from "@/components/auth/AuthProvider"
import { ModelSelector } from "@/components/models/ModelSelector"

const SHEEPAI_HOME = "https://www.sheepai.top"

export function Navbar() {
  const { state, selectedToken, logout } = useAuth()
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
          {selectedToken && (
            <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-500">
              Token: {selectedToken.name}
            </span>
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

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" className="gap-1">
                <UserRound className="h-4 w-4" />
                <span className="hidden sm:inline max-w-[100px] truncate">
                  {state.account?.displayName || state.account?.userId || "用户"}
                </span>
                <ChevronDown className="h-3 w-3" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel>
                <div className="text-xs text-slate-500">已登录账号</div>
                <div className="font-medium">{state.account?.displayName || state.userId}</div>
                {state.account?.email && <div className="text-xs text-slate-400">{state.account.email}</div>}
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => navigate("/settings")}>
                <Settings className="h-4 w-4 mr-2" />
                设置
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={logout} className="text-red-600">
                <LogOut className="h-4 w-4 mr-2" />
                退出登录
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </header>
  )
}

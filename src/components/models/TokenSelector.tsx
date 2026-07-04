import { useState } from "react"
import { Check, ChevronDown, KeyRound, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { useAuth } from "@/components/auth/AuthProvider"
import { maskSecret } from "@/lib/display"
import { cn } from "@/lib/utils"
import type { TokenRecord } from "@/types/sheepai"

export function TokenSelector() {
  const { state, selectToken, selectedToken } = useAuth()
  const [open, setOpen] = useState(false)

  if (state.tokenPage.items.length === 0) return null

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className="gap-1 max-w-[180px]">
          <KeyRound className="h-3.5 w-3.5 shrink-0 text-slate-400" />
          <span className="truncate text-xs">{selectedToken?.name ?? "选择令牌"}</span>
          <ChevronDown className="h-3 w-3 shrink-0" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-[380px]" sideOffset={8}>
        <DropdownMenuLabel className="flex items-center justify-between">
          <span>切换 API 令牌 ({state.tokenPage.total || state.tokenPage.items.length})</span>
          {state.isLoadingModels && (
            <span className="flex items-center gap-1 text-xs text-emerald-600">
              <Loader2 className="h-3 w-3 animate-spin" />加载中
            </span>
          )}
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <div className="max-h-[320px] overflow-y-auto">
          {state.tokenPage.items.map((token: TokenRecord) => {
            const isActive = selectedToken?.id === token.id
            return (
              <DropdownMenuItem
                key={token.id}
                disabled={!token.enabled || state.isLoadingModels}
                onClick={() => { selectToken(token); setOpen(false) }}
                className={cn("flex items-start gap-3 py-3 cursor-pointer", isActive && "bg-emerald-50")}
              >
                <div className={cn("mt-0.5 h-4 w-4 rounded-full border-2 flex items-center justify-center shrink-0",
                  isActive ? "border-emerald-500 bg-emerald-500" : "border-slate-300")}>
                  {isActive && <Check className="h-3 w-3 text-white" />}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium truncate">{token.name}</span>
                    <Badge variant={token.enabled ? "default" : "secondary"} className="text-[10px] px-1.5 py-0 shrink-0">
                      {token.enabled ? "可用" : "停用"}
                    </Badge>
                  </div>
                  <p className="text-xs text-slate-500 mt-0.5 font-mono break-all">{maskSecret(token.apiKey)}</p>
                  <p className="text-xs text-slate-400 mt-0.5">
                    {token.tokenType}{token.expiresAt ? ` · ${token.expiresAt}` : ""}
                  </p>
                </div>
              </DropdownMenuItem>
            )
          })}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

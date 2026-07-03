import { NavLink } from "react-router-dom"
import { ChevronLeft, Home, type LucideIcon } from "lucide-react"
import { useState } from "react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { getToolCategories, type ToolCategoryGroup } from "@/data/toolDefinitions"
import * as LucideIcons from "lucide-react"

function getIcon(iconName: string): LucideIcon {
  return (LucideIcons as unknown as Record<string, LucideIcon>)[iconName] || LucideIcons.Box
}

export function Sidebar() {
  const [collapsed, setCollapsed] = useState(false)
  const categories = getToolCategories()

  return (
    <aside
      className={cn(
        "relative border-r border-white/70 bg-white/85 backdrop-blur-xl transition-all duration-200 flex flex-col",
        collapsed ? "w-[60px]" : "w-[220px]",
      )}
    >
      <Button
        variant="ghost"
        size="icon"
        className="absolute -right-3 top-4 h-6 w-6 rounded-full border bg-white shadow-sm z-10"
        onClick={() => setCollapsed(!collapsed)}
      >
        <ChevronLeft className={cn("h-3 w-3 transition-transform", collapsed && "rotate-180")} />
      </Button>

      <nav className="flex-1 overflow-y-auto py-4 px-2 space-y-1">
        <NavLink
          to="/console"
          className={({ isActive }) =>
            cn(
              "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors",
              isActive ? "bg-slate-950 text-white" : "text-slate-600 hover:bg-slate-100 hover:text-slate-900",
            )
          }
        >
          <Home className="h-4 w-4 shrink-0" />
          {!collapsed && <span>控制台</span>}
        </NavLink>

        {categories.map((cat: ToolCategoryGroup) => (
          <div key={cat.category}>
            {!collapsed && (
              <p className="px-3 pt-4 pb-1 text-xs font-semibold uppercase tracking-wider text-slate-400">
                {cat.label}
              </p>
            )}
            {cat.tools.map((tool) => {
              const Icon = getIcon(tool.icon)
              const path = `/tools/${tool.id}`
              return (
                <NavLink
                  key={tool.id}
                  to={path}
                  className={({ isActive }) =>
                    cn(
                      "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition-colors",
                      isActive ? "bg-slate-950 text-white" : "text-slate-600 hover:bg-slate-100 hover:text-slate-900",
                    )
                  }
                >
                  <Icon className="h-4 w-4 shrink-0" />
                  {!collapsed && <span>{tool.shortName}</span>}
                </NavLink>
              )
            })}
          </div>
        ))}
      </nav>

      {!collapsed && (
        <div className="border-t border-slate-100 px-4 py-3 text-xs text-slate-400">
          赛博小羊 · AI 工具箱
        </div>
      )}
    </aside>
  )
}

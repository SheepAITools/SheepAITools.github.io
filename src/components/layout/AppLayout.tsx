import { Outlet } from "react-router-dom"
import { Navbar } from "./Navbar"
import { Sidebar } from "./Sidebar"

export function AppLayout() {
  return (
    <div className="sheepai-grid-bg min-h-screen bg-slate-50 text-slate-950">
      <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden" aria-hidden="true">
        <div className="sheepai-orb absolute left-[-8rem] top-[-8rem] h-72 w-72 rounded-full bg-emerald-300" />
        <div className="sheepai-orb absolute bottom-[-8rem] right-[-7rem] h-80 w-80 rounded-full bg-sky-300" />
      </div>

      <Navbar />

      <div className="flex">
        <Sidebar />
        <main className="flex-1 min-h-[calc(100vh-65px)] overflow-auto">
          <div className="p-4 sm:p-6 lg:p-8">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  )
}

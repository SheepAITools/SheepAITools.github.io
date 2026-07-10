import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom"
import { ApiConfigProvider } from "@/components/config/ApiConfigProvider"
import { AppLayout } from "@/components/layout/AppLayout"
import { ConsolePage } from "@/pages/ConsolePage"
import { SettingsPage } from "@/pages/SettingsPage"
import { ToolPage } from "@/pages/ToolPage"
import { Toaster } from "@/components/ui/sonner"

export default function App() {
  return (
    <BrowserRouter>
      <ApiConfigProvider>
        <Routes>
          <Route element={<AppLayout />}>
            <Route path="/" element={<Navigate to="/console" replace />} />
            <Route path="/console" element={<ConsolePage />} />
            <Route path="/settings" element={<SettingsPage />} />
            <Route path="/tools/:toolId" element={<ToolPage />} />
          </Route>
          <Route path="*" element={<Navigate to="/console" replace />} />
        </Routes>
        <Toaster />
      </ApiConfigProvider>
    </BrowserRouter>
  )
}

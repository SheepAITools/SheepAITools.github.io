import { BrowserRouter, Routes, Route, Navigate, Outlet } from "react-router-dom"
import { AuthProvider, useAuth } from "@/components/auth/AuthProvider"
import { AppLayout } from "@/components/layout/AppLayout"
import { LoginPage } from "@/components/auth/LoginPage"
import { AccountConfirmPage } from "@/components/auth/AccountConfirmPage"
import { ConsolePage } from "@/pages/ConsolePage"
import { ToolPage } from "@/pages/ToolPage"

function ProtectedRoute() {
  const { state } = useAuth()
  if (!state.account && !state.isLoadingAccount) return <Navigate to="/" replace />
  return <Outlet />
}

function TokenRequiredRoute() {
  const { state, selectedToken } = useAuth()
  if (!state.account) return <Navigate to="/" replace />
  if (!selectedToken && !state.isLoadingModels && state.availableModels.length === 0) {
    return <Navigate to="/account-confirm" replace />
  }
  return <Outlet />
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/" element={<LoginPage />} />
          <Route element={<ProtectedRoute />}>
            <Route path="/account-confirm" element={<AccountConfirmPage />} />
            <Route element={<TokenRequiredRoute />}>
              <Route element={<AppLayout />}>
                <Route path="/console" element={<ConsolePage />} />
                <Route path="/tools/:toolId" element={<ToolPage />} />
              </Route>
            </Route>
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  )
}

import { type ReactNode, useEffect } from "react"
import { useNavigate } from "react-router-dom"
import {
  AlertCircle, KeyRound, Loader2,
  RefreshCw, ShieldCheck, Sparkles, UserRound,
} from "lucide-react"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { useAuth } from "@/components/auth/AuthProvider"
import { formatNullableText, maskSecret } from "@/lib/display"
import type { TokenRecord } from "@/types/sheepai"

export function AccountConfirmPage() {
  const { state, selectToken, refreshTokens } = useAuth()
  const navigate = useNavigate()

  useEffect(() => {
    if (state.availableModels.length > 0 && state.selectedTokenId) {
      navigate("/console", { replace: true })
    }
  }, [state.availableModels.length, state.selectedTokenId, navigate])

  useEffect(() => {
    if (!state.account && !state.isLoadingAccount) {
      navigate("/", { replace: true })
    }
  }, [state.account, state.isLoadingAccount, navigate])

  async function handleSelectToken(token: TokenRecord) {
    await selectToken(token)
  }

  return (
    <main className="sheepai-grid-bg min-h-screen bg-slate-50 text-slate-950">
      <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden" aria-hidden="true">
        <div className="sheepai-orb absolute left-[-8rem] top-[-8rem] h-72 w-72 rounded-full bg-emerald-300" />
        <div className="sheepai-orb absolute bottom-[-8rem] right-[-7rem] h-80 w-80 rounded-full bg-sky-300" />
      </div>

      <header className="sticky top-0 z-30 border-b border-white/70 bg-white/80 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-slate-950 text-white shadow-lg">
              <Sparkles className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs font-medium uppercase tracking-[0.2em] text-slate-400">Cyber SheepAI Toolbox</p>
              <h1 className="text-lg font-bold tracking-tight">赛博小羊的ai工具箱</h1>
            </div>
          </div>
          <Button variant="ghost" size="sm" onClick={() => { void refreshTokens() }}>
            <RefreshCw className="h-4 w-4" /> 刷新
          </Button>
        </div>
      </header>

      <section className="mx-auto grid max-w-7xl gap-6 px-4 py-8 sm:px-6 lg:grid-cols-[320px_1fr] lg:px-8">
        <aside className="space-y-4">
          <Card className="border-white/75 bg-white/90 shadow-xl shadow-slate-200/70 backdrop-blur-xl">
            <CardHeader>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <CardTitle className="flex items-center gap-2 text-base"><UserRound className="h-4 w-4" />账号确认</CardTitle>
                  <CardDescription className="mt-2">已通过系统 API 查询账号信息。</CardDescription>
                </div>
                <Badge variant="default">已登录</Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div className="flex justify-between gap-4"><span className="text-slate-500">用户 ID</span><span className="font-medium text-slate-950">{formatNullableText(state.account?.userId ?? "")}</span></div>
              <div className="flex justify-between gap-4"><span className="text-slate-500">显示名</span><span className="font-medium text-slate-950">{formatNullableText(state.account?.displayName ?? "")}</span></div>
              <div className="flex justify-between gap-4"><span className="text-slate-500">状态</span><span className="font-medium text-slate-950">{formatNullableText(state.account?.status ?? "")}</span></div>
              <div className="flex justify-between gap-4"><span className="text-slate-500">邮箱</span><span className="break-all text-right font-medium text-slate-950">{formatNullableText(state.account?.email ?? "")}</span></div>
            </CardContent>
          </Card>
          <Alert className="border-emerald-200 bg-emerald-50 text-emerald-950">
            <ShieldCheck className="h-4 w-4" />
            <AlertTitle>凭证边界</AlertTitle>
            <AlertDescription className="text-emerald-800">系统令牌只在当前页面内存中使用，不写入 localStorage。</AlertDescription>
          </Alert>
        </aside>

        <div className="space-y-6">
          <div className="rounded-3xl border border-white/70 bg-white/85 p-6 shadow-xl sm:p-8">
            <Badge variant="secondary">第 2 步 / 选择 API Key</Badge>
            <h2 className="mt-3 text-3xl font-black tracking-tight sm:text-4xl">选择模型调用令牌</h2>
            <p className="mt-2 max-w-2xl text-slate-500">选择一个 API Key，工具箱会查询该 Key 支持的模型，再进入控制台。</p>
          </div>

          {state.errorMessage && (
            <Alert variant="destructive"><AlertCircle className="h-4 w-4" /><AlertTitle>令牌不可用</AlertTitle><AlertDescription>{state.errorMessage}</AlertDescription></Alert>
          )}

          {state.tokenPage.items.length === 0 ? (
            <Card className="border-white/75 bg-white/90 shadow-xl backdrop-blur-xl">
              <CardContent className="flex min-h-[260px] flex-col items-center justify-center gap-4 py-10 text-center">
                <KeyRound className="h-12 w-12 text-slate-300" />
                <div><h3 className="text-lg font-bold">当前账号暂无可用 API Key</h3><p className="mt-2 text-sm text-slate-500">请前往 SheepAI 控制台创建模型调用 API Key。</p></div>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {state.tokenPage.items.map((token: TokenRecord): ReactNode => {
                const isSelected = state.selectedTokenId === token.id
                return (
                  <button key={token.id} type="button" onClick={() => { void handleSelectToken(token) }}
                    disabled={state.isLoadingModels || !token.enabled}
                    className="rounded-3xl border border-white/75 bg-white/90 p-5 text-left shadow-lg shadow-slate-200/60 transition hover:-translate-y-1 hover:border-emerald-200 hover:shadow-2xl hover:shadow-emerald-100/70 disabled:cursor-not-allowed disabled:opacity-60">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-950 text-white"><KeyRound className="h-5 w-5" /></div>
                      <Badge variant={token.enabled ? "default" : "secondary"}>{token.enabled ? "可用" : "停用"}</Badge>
                    </div>
                    <h3 className="mt-5 text-lg font-bold text-slate-950">{token.name}</h3>
                    <p className="mt-2 text-sm leading-6 text-slate-500">{token.description || "选择后查询此 API Key 支持的模型。"}</p>
                    <div className="mt-4 space-y-2 text-xs text-slate-500">
                      <p className="break-all font-mono">Key：{maskSecret(token.apiKey)}</p>
                      <p>类型：{token.tokenType} · 用量：{token.usageCount ?? "未返回"}</p>
                      {token.expiresAt && <p>过期时间：{token.expiresAt}</p>}
                    </div>
                    {isSelected && state.isLoadingModels && (
                      <div className="mt-4 flex items-center gap-2 text-sm font-medium text-emerald-600"><Loader2 className="h-4 w-4 animate-spin" />正在查询模型...</div>
                    )}
                  </button>
                )
              })}
            </div>
          )}
        </div>
      </section>
    </main>
  )
}

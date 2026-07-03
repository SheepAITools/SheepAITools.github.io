import { type ChangeEvent, type FormEvent, useEffect, useState } from "react"
import { useNavigate } from "react-router-dom"
import {
  AlertCircle, ArrowRight, Copy, ExternalLink, KeyRound,
  Loader2, LockKeyhole, Sparkles, UserRound,
} from "lucide-react"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { useAuth } from "@/components/auth/AuthProvider"

const SHEEPAI_HOME = "https://www.sheepai.top"
const SHEEPAI_DOCS = "https://sheepai.apifox.cn/"

export function LoginPage() {
  const { state, setCredentials, login } = useAuth()
  const navigate = useNavigate()
  const [userId, setUserId] = useState(state.userId || "")
  const [systemToken, setSystemToken] = useState("")
  const [rememberUserId, setRememberUserId] = useState(true)

  const hasInput = userId.trim().length > 0 && systemToken.trim().length > 0

  // Redirect after successful login
  useEffect(() => {
    if (state.account && state.tokenPage.items.length > 0) {
      navigate("/account-confirm", { replace: true })
    }
  }, [state.account, state.tokenPage.items.length, navigate])

  async function handleSubmit(event?: FormEvent<HTMLFormElement>) {
    event?.preventDefault()
    setCredentials(userId, systemToken, rememberUserId)
    await login(userId, systemToken, rememberUserId)
  }

  return (
    <main className="sheepai-grid-bg relative min-h-screen overflow-hidden bg-slate-950 text-white">
      <div className="pointer-events-none fixed inset-0 overflow-hidden" aria-hidden="true">
        <div className="sheepai-orb absolute left-[-7rem] top-[-7rem] h-80 w-80 rounded-full bg-emerald-400" />
        <div className="sheepai-orb absolute bottom-[-8rem] right-[-5rem] h-96 w-96 rounded-full bg-sky-500" />
      </div>

      <div className="relative mx-auto flex min-h-screen max-w-6xl flex-col px-4 py-6 sm:px-6 lg:px-8">
        <header className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white text-slate-950 shadow-lg">
              <Sparkles className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm font-medium text-white/60">Cyber SheepAI Toolbox</p>
              <h1 className="text-lg font-bold tracking-tight">赛博小羊的ai工具箱</h1>
            </div>
          </div>
          <nav className="flex items-center gap-2">
            <Button variant="secondary" size="sm" asChild>
              <a href={SHEEPAI_DOCS} target="_blank" rel="noreferrer">文档<ExternalLink className="h-4 w-4" /></a>
            </Button>
            <Button variant="outline" size="sm" className="border-white/20 bg-white/10 text-white hover:bg-white/20 hover:text-white" asChild>
              <a href={SHEEPAI_HOME} target="_blank" rel="noreferrer">控制台<ExternalLink className="h-4 w-4" /></a>
            </Button>
          </nav>
        </header>

        <section className="grid flex-1 items-center gap-10 py-14 lg:grid-cols-[1fr_430px] lg:py-20">
          <div className="max-w-3xl space-y-7">
            <Badge className="bg-white/10 text-white hover:bg-white/10">纯前端 · 账号确认 · 令牌选型 · 模型调用</Badge>
            <div className="space-y-5">
              <h2 className="text-5xl font-black tracking-tight sm:text-6xl lg:text-7xl">
                登录后，
                <span className="block bg-gradient-to-r from-emerald-300 via-sky-300 to-violet-300 bg-clip-text text-transparent">
                  再选择你的 AI 能力。
                </span>
              </h2>
              <p className="max-w-2xl text-lg leading-8 text-slate-300">
                使用用户 ID 与系统令牌校验账号，随后选择 API Key、查询可用模型，使用翻译、润色、图片生成、语音合成等 AI 工具。
              </p>
            </div>
          </div>

          <Card className="border-white/15 bg-white/95 text-slate-950 shadow-2xl shadow-black/30 backdrop-blur-xl">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-2xl">
                <LockKeyhole className="h-5 w-5" />
                登录工具箱
              </CardTitle>
              <CardDescription>
                系统令牌只用于查询账号与令牌列表；模型调用使用下一步选择的 API Key。
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form className="space-y-5" onSubmit={handleSubmit}>
                <div className="space-y-2">
                  <Label htmlFor="user-id" className="flex items-center gap-2">
                    <UserRound className="h-3.5 w-3.5" />用户 ID
                  </Label>
                  <div className="relative">
                    <Input id="user-id" value={userId} onChange={(e: ChangeEvent<HTMLInputElement>) => setUserId(e.target.value)}
                      placeholder="在 SheepAI 个人设置中复制" autoComplete="username" className="h-12 bg-white text-base pr-10" />
                    <button type="button" onClick={() => navigator.clipboard.readText().then(t => { if (t) setUserId(t) }).catch(() => {})}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600" title="从剪贴板粘贴">
                      <Copy className="h-4 w-4" />
                    </button>
                  </div>
                  <p className="text-xs text-slate-400">SheepAI 控制台 → 个人设置 → 用户名旁边可查看并复制</p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="system-token" className="flex items-center gap-2">
                    <KeyRound className="h-3.5 w-3.5" />系统令牌
                  </Label>
                  <Input id="system-token" type="password" value={systemToken}
                    onChange={(e: ChangeEvent<HTMLInputElement>) => setSystemToken(e.target.value)}
                    placeholder="安全设置中生成的系统令牌" autoComplete="off" className="h-12 bg-white text-base" />
                  <p className="text-xs text-slate-400">SheepAI 控制台 → 个人设置 → 安全设置 → 生成并复制</p>
                </div>

                <div className="flex items-center justify-between gap-4 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                  <div>
                    <Label htmlFor="remember-user-id" className="text-sm font-semibold">仅记住用户 ID</Label>
                    <p className="mt-1 text-xs text-slate-500">不会保存系统令牌或 API Key。</p>
                  </div>
                  <Switch id="remember-user-id" checked={rememberUserId} onCheckedChange={setRememberUserId} />
                </div>

                <div className="grid gap-3 rounded-3xl border border-slate-200 bg-slate-50 p-4 text-sm leading-6 text-slate-600">
                  <div><span className="font-semibold text-slate-950">用户 ID：</span>SheepAI 控制台 → 个人设置 → 用户名旁边可复制。</div>
                  <div><span className="font-semibold text-slate-950">系统令牌：</span>SheepAI 控制台 → 个人设置 → 安全设置 → 生成并复制。</div>
                  <div><span className="font-semibold text-slate-950">API Key：</span>登录后由系统 API 返回，用于模型调用；不要把系统令牌当作 API Key。</div>
                  <div><span className="font-semibold text-slate-950">浏览器访问：</span>请通过 HTTPS 或 <code className="rounded bg-slate-200 px-1 text-xs">npm run dev</code> 访问。</div>
                </div>

                {state.loginMessage && (
                  <Alert variant="destructive">
                    <AlertCircle className="h-4 w-4" />
                    <AlertTitle>无法登录</AlertTitle>
                    <AlertDescription>{state.loginMessage}</AlertDescription>
                  </Alert>
                )}

                <Button type="submit" size="lg" className="h-12 w-full" disabled={!hasInput || state.isLoadingAccount}>
                  {state.isLoadingAccount ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowRight className="h-4 w-4" />}
                  {state.isLoadingAccount ? "正在查询账号..." : "查询账号并继续"}
                </Button>

                <p className="text-center text-xs leading-5 text-slate-500">
                  本平台不新增后端、不代理请求、不埋点；凭证与输入内容仅由浏览器直连 SheepAI。
                </p>
              </form>
            </CardContent>
          </Card>
        </section>
      </div>
    </main>
  )
}

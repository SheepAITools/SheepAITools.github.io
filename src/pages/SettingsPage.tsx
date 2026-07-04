import { useState } from "react"
import { ArrowLeft, Save, Sliders } from "lucide-react"
import { useNavigate } from "react-router-dom"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Slider } from "@/components/ui/slider"
import { Badge } from "@/components/ui/badge"
import { useAuth } from "@/components/auth/AuthProvider"
import { API_BASE_URL } from "@/lib/apiConfig"
import { toast } from "sonner"

export function SettingsPage() {
  const navigate = useNavigate()
  const { state } = useAuth()

  const [backendUrl, setBackendUrl] = useState(API_BASE_URL)
  const [defaultTemp, setDefaultTemp] = useState(0.3)
  const [maxTokens, setMaxTokens] = useState(4096)

  function handleSave() {
    toast.success("设置已保存（仅本次会话生效）")
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="outline" size="sm" onClick={() => navigate("/console")}>
          <ArrowLeft className="h-4 w-4" /> 返回
        </Button>
        <h2 className="text-2xl font-bold">设置</h2>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Backend */}
        <Card className="border-white/75 bg-white/90 shadow-xl backdrop-blur-xl">
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Sliders className="h-5 w-5" /> 后端代理</CardTitle>
            <CardDescription>系统 API 请求通过此后端代理转发到 SheepAI。</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>当前后端地址</Label>
              <Input value={backendUrl} onChange={(e) => setBackendUrl(e.target.value)}
                className="font-mono text-sm" />
              <p className="text-xs text-slate-400">开发时可改为 http://localhost:3000</p>
            </div>
            <Button onClick={handleSave} size="sm"><Save className="h-4 w-4" /> 保存</Button>
          </CardContent>
        </Card>

        {/* Model defaults */}
        <Card className="border-white/75 bg-white/90 shadow-xl backdrop-blur-xl">
          <CardHeader>
            <CardTitle>模型调用默认值</CardTitle>
            <CardDescription>调整模型调用参数，适用于所有工具。</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-2">
              <div className="flex justify-between"><Label>默认温度</Label><Badge variant="secondary">{defaultTemp.toFixed(2)}</Badge></div>
              <Slider value={[defaultTemp]} onValueChange={([v]) => setDefaultTemp(v)} min={0} max={2} step={0.05} />
              <p className="text-xs text-slate-400">越低输出越确定，越高越有创意</p>
            </div>
            <div className="space-y-2">
              <Label>最大输出 Token</Label>
              <Input type="number" value={maxTokens} onChange={(e) => setMaxTokens(Number(e.target.value))}
                min={1} max={128000} className="font-mono text-sm" />
              <p className="text-xs text-slate-400">1-128000，默认 4096</p>
            </div>
            <Button onClick={handleSave} size="sm"><Save className="h-4 w-4" /> 保存</Button>
          </CardContent>
        </Card>
      </div>

      {/* Info */}
      <Card className="border-white/75 bg-white/90 shadow-xl backdrop-blur-xl">
        <CardHeader><CardTitle>关于</CardTitle></CardHeader>
        <CardContent>
          <div className="grid gap-2 text-sm text-slate-600">
            <div className="flex justify-between gap-4"><span>登录方式</span><Badge variant="outline">{state.account?.userId === "guest" ? "游客模式" : "系统令牌登录"}</Badge></div>
            <div className="flex justify-between gap-4"><span>当前模型</span><span className="font-mono text-xs">{state.selectedModelId || "未选择"}</span></div>
            <div className="flex justify-between gap-4"><span>可用模型数</span><span>{state.availableModels.length}</span></div>
            <div className="flex justify-between gap-4"><span>后端地址</span><span className="font-mono text-xs">{API_BASE_URL}</span></div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

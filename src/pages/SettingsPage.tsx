import { useMemo, useState } from "react"
import {
  ArrowLeft,
  CheckCircle2,
  ExternalLink,
  KeyRound,
  Loader2,
  Plus,
  Save,
  Trash2,
  Wifi,
} from "lucide-react"
import { useNavigate } from "react-router-dom"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { useApiConfig } from "@/components/config/useApiConfig"
import { createEmptyConfigDraft, draftFromConfig, type ApiConfigDraft } from "@/lib/configStore"
import { cn } from "@/lib/utils"
import type { ApiConfiguration, ApiInterfaceFormat } from "@/types/sheepai"
import { toast } from "sonner"

const SHEEPAI_HOME = "https://www.sheepai.top"

const GUIDE_STEPS = [
  { title: "注册并登录", body: "打开 SheepAI，完成账号注册与登录。" },
  { title: "购买额度", body: "进入控制台的钱包页面，充值并购买可调用额度。" },
  { title: "复制令牌", body: "在 API 令牌页面添加令牌，复制生成的 Key。" },
  { title: "填写配置", body: "回到这里填写 API 地址、API Key 和模型 ID。" },
]

function modelTextFromDraft(draft: ApiConfigDraft): string {
  return draft.modelIds.join("\n")
}

function parseModelText(value: string): string[] {
  return [...new Set(value.split(/[\n,，]/).map((item) => item.trim()).filter(Boolean))]
}

export function SettingsPage() {
  const navigate = useNavigate()
  const {
    state,
    activeConfig,
    upsertConfig,
    deleteConfig,
    selectConfig,
    testConfig,
    clearTest,
  } = useApiConfig()

  const initialDraft = activeConfig ? draftFromConfig(activeConfig) : createEmptyConfigDraft()
  const [editingId, setEditingId] = useState(activeConfig?.id ?? "")
  const [draft, setDraft] = useState<ApiConfigDraft>(() => initialDraft)
  const [modelText, setModelText] = useState(() => modelTextFromDraft(initialDraft))

  const editingConfig = useMemo<ApiConfiguration | undefined>(() => {
    return state.configs.find((config) => config.id === editingId)
  }, [state.configs, editingId])

  function updateDraft(patch: Partial<ApiConfigDraft>) {
    clearTest()
    setDraft((current) => ({ ...current, ...patch }))
  }

  function chooseConfig(config: ApiConfiguration) {
    setEditingId(config.id)
    const nextDraft = draftFromConfig(config)
    setDraft(nextDraft)
    setModelText(modelTextFromDraft(nextDraft))
    selectConfig(config.id)
    clearTest()
  }

  function startNewConfig() {
    const nextDraft = createEmptyConfigDraft()
    setEditingId("")
    setDraft(nextDraft)
    setModelText(modelTextFromDraft(nextDraft))
    clearTest()
  }

  function buildDraftForSave(): ApiConfigDraft {
    const modelIds = parseModelText(modelText)
    return {
      ...draft,
      modelIds,
      selectedModelId: modelIds.includes(draft.selectedModelId) ? draft.selectedModelId : modelIds[0] ?? "",
    }
  }

  function handleSave(): ApiConfiguration | null {
    const nextDraft = buildDraftForSave()
    if (!nextDraft.name.trim()) { toast.error("请填写配置名称"); return null }
    if (!nextDraft.apiBaseUrl.trim()) { toast.error("请填写 API 地址"); return null }
    if (!nextDraft.apiKey.trim()) { toast.error("请填写 API Key"); return null }
    if (nextDraft.modelIds.length === 0) { toast.error("请至少填写一个模型 ID"); return null }

    const saved = upsertConfig(nextDraft, editingId || undefined)
    setEditingId(saved.id)
    setDraft(draftFromConfig(saved))
    setModelText(modelTextFromDraft(draftFromConfig(saved)))
    selectConfig(saved.id)
    toast.success("配置已保存")
    return saved
  }

  async function handleTest() {
    const saved = handleSave()
    if (!saved) return
    await testConfig(saved)
  }

  function handleDelete() {
    if (!editingId) return
    deleteConfig(editingId)
    toast.success("配置已删除")
    startNewConfig()
  }

  const selectedModelId = draft.selectedModelId || parseModelText(modelText)[0] || ""

  return (
    <div className="mx-auto grid max-w-6xl gap-6 xl:grid-cols-[280px_1fr]">
      <aside className="space-y-4">
        <div className="flex items-center gap-3">
          <Button variant="outline" size="sm" onClick={() => navigate("/console")}>
            <ArrowLeft className="h-4 w-4" /> 返回
          </Button>
          <h2 className="text-2xl font-bold">设置</h2>
        </div>

        <Card className="border-white/75 bg-white/90 shadow-xl backdrop-blur-xl">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">API 配置</CardTitle>
            <CardDescription>保存多套配置并快速切换。</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {state.configs.length === 0 ? (
              <p className="rounded-2xl bg-slate-50 p-4 text-sm text-slate-500">暂无配置</p>
            ) : state.configs.map((config) => (
              <button
                key={config.id}
                type="button"
                onClick={() => chooseConfig(config)}
                className={cn(
                  "w-full rounded-2xl border px-3 py-3 text-left transition",
                  editingId === config.id ? "border-slate-950 bg-slate-950 text-white" : "border-slate-200 bg-white hover:border-emerald-200",
                )}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="truncate text-sm font-semibold">{config.name}</span>
                  {state.activeConfigId === config.id && <Badge variant="secondary" className="shrink-0">当前</Badge>}
                </div>
                <p className={cn("mt-1 truncate font-mono text-xs", editingId === config.id ? "text-white/60" : "text-slate-400")}>
                  {config.apiBaseUrl}
                </p>
              </button>
            ))}
            <Button variant="outline" className="w-full" onClick={startNewConfig}>
              <Plus className="h-4 w-4" /> 新建配置
            </Button>
          </CardContent>
        </Card>
      </aside>

      <div className="space-y-6">
        <Card className="border-white/75 bg-white/90 shadow-xl backdrop-blur-xl">
          <CardHeader>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <KeyRound className="h-5 w-5" /> 配置向导
                </CardTitle>
                <CardDescription>按顺序完成后即可开始使用工具。</CardDescription>
              </div>
              <Button variant="outline" size="sm" asChild>
                <a href={SHEEPAI_HOME} target="_blank" rel="noreferrer">
                  打开 SheepAI <ExternalLink className="h-4 w-4" />
                </a>
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3 md:grid-cols-4">
              {GUIDE_STEPS.map((step, index) => (
                <div key={step.title} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <div className="flex items-center gap-2">
                    <span className="flex h-7 w-7 items-center justify-center rounded-full bg-slate-950 text-xs font-bold text-white">
                      {index + 1}
                    </span>
                    <h3 className="font-semibold">{step.title}</h3>
                  </div>
                  <p className="mt-3 text-sm leading-6 text-slate-500">{step.body}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card className="border-white/75 bg-white/90 shadow-xl backdrop-blur-xl">
          <CardHeader>
            <CardTitle>{editingConfig ? "编辑 API 配置" : "新建 API 配置"}</CardTitle>
            <CardDescription>配置保存在当前浏览器中。</CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="config-name">配置名称</Label>
                <Input
                  id="config-name"
                  data-testid="config-name-input"
                  value={draft.name}
                  onChange={(event) => updateDraft({ name: event.target.value })}
                  placeholder="例如：SheepAI 主配置"
                  className="bg-white"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="interface-format">API 接口格式</Label>
                <Select
                  value={draft.interfaceFormat}
                  onValueChange={(value) => updateDraft({ interfaceFormat: value as ApiInterfaceFormat })}
                >
                  <SelectTrigger id="interface-format" className="bg-white">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="openai-compatible">OpenAI 兼容</SelectItem>
                    <SelectItem value="anthropic-compatible">Anthropic Messages 兼容</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="api-base-url">API 地址</Label>
              <Input
                id="api-base-url"
                data-testid="api-base-url-input"
                value={draft.apiBaseUrl}
                onChange={(event) => updateDraft({ apiBaseUrl: event.target.value })}
                placeholder="https://www.sheepai.top/v1"
                className="bg-white font-mono text-sm"
              />
            </div>

            <div className="grid gap-4 md:grid-cols-[1fr_180px]">
              <div className="space-y-2">
                <Label htmlFor="api-key">API Key</Label>
                <Input
                  id="api-key"
                  data-testid="api-key-input"
                  type="password"
                  value={draft.apiKey}
                  onChange={(event) => updateDraft({ apiKey: event.target.value })}
                  placeholder="粘贴 API token"
                  className="bg-white font-mono text-sm"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="timeout">请求超时（秒）</Label>
                <Input
                  id="timeout"
                  data-testid="timeout-input"
                  type="number"
                  min={1}
                  value={draft.timeoutSeconds}
                  onChange={(event) => updateDraft({ timeoutSeconds: Number(event.target.value) })}
                  className="bg-white font-mono text-sm"
                />
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-[1fr_240px]">
              <div className="space-y-2">
                <Label htmlFor="models">模型 ID</Label>
                <Textarea
                  id="models"
                  data-testid="models-textarea"
                  value={modelText}
                  onChange={(event) => {
                    clearTest()
                    setModelText(event.target.value)
                  }}
                  placeholder="每行一个模型 ID，例如：&#10;gpt-4o-mini&#10;gpt-4o"
                  className="min-h-32 bg-white font-mono text-sm"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="default-model">默认模型</Label>
                <Select value={selectedModelId} onValueChange={(value) => updateDraft({ selectedModelId: value })}>
                  <SelectTrigger id="default-model" className="bg-white">
                    <SelectValue placeholder="选择模型" />
                  </SelectTrigger>
                  <SelectContent>
                    {parseModelText(modelText).map((modelId) => (
                      <SelectItem key={modelId} value={modelId}>{modelId}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs leading-5 text-slate-400">工具页面也可以随时切换当前模型。</p>
              </div>
            </div>

            {state.testStatus !== "idle" && (
              <Alert className={cn(
                state.testStatus === "success" ? "border-emerald-200 bg-emerald-50 text-emerald-950" : "border-red-200 bg-red-50 text-red-950",
              )}>
                {state.testStatus === "success" ? <CheckCircle2 className="h-4 w-4" /> : <Wifi className="h-4 w-4" />}
                <AlertTitle>{state.testStatus === "success" ? "测试通过" : "测试失败"}</AlertTitle>
                <AlertDescription>{state.testMessage}</AlertDescription>
              </Alert>
            )}

            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-5">
              <div className="flex flex-wrap gap-2">
                <Button onClick={handleSave} data-testid="save-config-button">
                  <Save className="h-4 w-4" /> 保存
                </Button>
                <Button variant="outline" onClick={handleTest} disabled={state.isTesting}>
                  {state.isTesting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wifi className="h-4 w-4" />}
                  连通性测试
                </Button>
              </div>
              {editingId && (
                <Button
                  variant="outline"
                  className="border-red-200 text-red-600 hover:bg-red-50 hover:text-red-700"
                  onClick={handleDelete}
                  data-testid="delete-config-button"
                >
                  <Trash2 className="h-4 w-4" /> 删除
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

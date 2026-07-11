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
import type { ApiConfiguration, ApiInterfaceFormat, ModelCapability, ModelIdGroups } from "@/types/sheepai"
import { toast } from "sonner"

const SHEEPAI_HOME = "https://www.sheepai.top"

const GUIDE_STEPS = [
  { title: "注册并登录", body: "打开 SheepAI，完成账号注册与登录。" },
  { title: "购买额度", body: "进入控制台的钱包页面，充值并购买可调用额度。" },
  { title: "复制令牌", body: "在 API 令牌页面添加令牌，复制生成的 Key。" },
  { title: "填写配置", body: "回到这里填写 API 地址、API Key 和模型 ID。" },
]

function parseModelText(value: string): string[] {
  return [...new Set(value.split(/[\n,，]/).map((item) => item.trim()).filter(Boolean))]
}

function modelGroupTextFromDraft(draft: ApiConfigDraft): Record<ModelCapability, string> {
  return {
    text: draft.modelIdGroups.text.join("\n"),
    vision: draft.modelIdGroups.vision.join("\n"),
    imageGeneration: draft.modelIdGroups.imageGeneration.join("\n"),
    imageEdit: draft.modelIdGroups.imageEdit.join("\n"),
    tts: draft.modelIdGroups.tts.join("\n"),
    stt: draft.modelIdGroups.stt.join("\n"),
  }
}

function parseModelGroups(value: Record<ModelCapability, string>): ModelIdGroups {
  return {
    text: parseModelText(value.text),
    vision: parseModelText(value.vision),
    imageGeneration: parseModelText(value.imageGeneration),
    imageEdit: parseModelText(value.imageEdit),
    tts: parseModelText(value.tts),
    stt: parseModelText(value.stt),
  }
}

function flattenGroups(groups: ModelIdGroups): string[] {
  return [...new Set([
    ...groups.text,
    ...groups.vision,
    ...groups.imageGeneration,
    ...groups.imageEdit,
    ...groups.tts,
    ...groups.stt,
  ])]
}

const MODEL_GROUP_FIELDS: Array<{
  capability: ModelCapability
  label: string
  description: string
  placeholder: string
}> = [
  {
    capability: "text",
    label: "文本 / 智能体模型",
    description: "用于文本工具、智能体聊天和规划。",
    placeholder: "gpt-5.4",
  },
  {
    capability: "vision",
    label: "视觉理解模型",
    description: "用于上传图片后进行识图和分析。",
    placeholder: "gpt-5.4",
  },
  {
    capability: "imageGeneration",
    label: "图片生成模型",
    description: "用于文生图。",
    placeholder: "gpt-image-2",
  },
  {
    capability: "imageEdit",
    label: "图片编辑模型",
    description: "用于 P 图、修图和图片编辑。",
    placeholder: "gpt-image-2",
  },
  {
    capability: "tts",
    label: "文字转语音模型",
    description: "用于语音合成。",
    placeholder: "tts-1",
  },
  {
    capability: "stt",
    label: "语音转文字模型",
    description: "用于音频转写。",
    placeholder: "whisper-1",
  },
]

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
  const [modelGroupText, setModelGroupText] = useState(() => modelGroupTextFromDraft(initialDraft))

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
    setModelGroupText(modelGroupTextFromDraft(nextDraft))
    selectConfig(config.id)
    clearTest()
  }

  function startNewConfig() {
    const nextDraft = createEmptyConfigDraft()
    setEditingId("")
    setDraft(nextDraft)
    setModelGroupText(modelGroupTextFromDraft(nextDraft))
    clearTest()
  }

  function buildDraftForSave(): ApiConfigDraft {
    const modelIdGroups = parseModelGroups(modelGroupText)
    const modelIds = flattenGroups(modelIdGroups)
    return {
      ...draft,
      modelIdGroups,
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
    setModelGroupText(modelGroupTextFromDraft(draftFromConfig(saved)))
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

  const currentGroups = parseModelGroups(modelGroupText)
  const allModelIds = flattenGroups(currentGroups)
  const selectedModelId = draft.selectedModelId || allModelIds[0] || ""

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
                    <SelectItem value="gemini-compatible">Gemini generateContent</SelectItem>
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

            <div className="space-y-3">
              <div>
                <Label>模型 ID</Label>
                <p className="mt-1 text-xs leading-5 text-slate-400">每行一个模型 ID；同一个模型可以填写到多个类别。</p>
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                {MODEL_GROUP_FIELDS.map((field) => (
                  <div key={field.capability} className="space-y-2 rounded-2xl border border-slate-200 bg-slate-50 p-4">
                    <Label htmlFor={`models-${field.capability}`}>{field.label}</Label>
                    <p className="text-xs leading-5 text-slate-400">{field.description}</p>
                    <Textarea
                      id={`models-${field.capability}`}
                      value={modelGroupText[field.capability]}
                      onChange={(event) => {
                        clearTest()
                        setModelGroupText((current) => ({ ...current, [field.capability]: event.target.value }))
                      }}
                      placeholder={field.placeholder}
                      className="min-h-24 bg-white font-mono text-sm"
                    />
                  </div>
                ))}
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-[1fr_240px]">
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm leading-6 text-slate-500">
                已填写 <span className="font-semibold text-slate-950">{allModelIds.length}</span> 个模型。
              </div>
              <div className="space-y-2">
                <Label htmlFor="default-model">默认模型</Label>
                <Select value={selectedModelId} onValueChange={(value) => updateDraft({ selectedModelId: value })}>
                  <SelectTrigger id="default-model" className="bg-white">
                    <SelectValue placeholder="选择模型" />
                  </SelectTrigger>
                  <SelectContent>
                    {allModelIds.map((modelId) => (
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

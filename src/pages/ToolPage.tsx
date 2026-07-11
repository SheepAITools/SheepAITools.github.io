import { useState, type ChangeEvent, type DragEvent } from "react"
import { useParams, useNavigate } from "react-router-dom"
import {
  AlertCircle, ArrowLeft, Check, Copy, Download,
  Image, Loader2, Sparkles, Upload, Volume2, X,
} from "lucide-react"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Textarea } from "@/components/ui/textarea"
import { ModelSelector } from "@/components/models/ModelSelector"
import { useApiConfig } from "@/components/config/useApiConfig"
import { getToolById } from "@/data/toolDefinitions"
import { filterModelsForTool } from "@/data/models"
import { normalizeToolImageOutput, resolveConfiguredToolEndpoint, runConfiguredTool } from "@/lib/genericAiClient"
import { maskSecret } from "@/lib/display"
import { downloadImage } from "@/lib/download"
import { cn } from "@/lib/utils"
import type { RunToolResponse } from "@/types/sheepai"

export function ToolPage() {
  const { toolId } = useParams<{ toolId: string }>()
  const navigate = useNavigate()
  const { activeConfig, activeModel, availableModels, hasRunnableConfig } = useApiConfig()
  const tool = toolId ? getToolById(toolId) : undefined

  const [inputText, setInputText] = useState(tool?.defaultInput ?? "")
  const [outputText, setOutputText] = useState("")
  const [imageData, setImageData] = useState<string | null>(null)
  const [imageMime, setImageMime] = useState<string>("image/png")
  const [outputImage, setOutputImage] = useState<string | null>(null)
  const [outputAudio, setOutputAudio] = useState<string | null>(null)
  const [endpoint, setEndpoint] = useState("")
  const [error, setError] = useState("")
  const [isRunning, setIsRunning] = useState(false)
  const [hasCopied, setHasCopied] = useState(false)
  const [dragOver, setDragOver] = useState(false)

  if (!tool) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-4">
        <AlertCircle className="h-12 w-12 text-slate-300" />
        <h2 className="text-xl font-bold">工具未找到</h2>
        <Button onClick={() => navigate("/console")}>返回控制台</Button>
      </div>
    )
  }

  const needsImage = tool.supportsImageInput
  const producesImage = tool.supportsImageOutput
  const isTts = tool.category === "audio"
  const toolModels = filterModelsForTool(availableModels, tool.modelFilter)
  const resolvedModel = toolModels.find((model) => model.id === activeModel?.id) ?? toolModels[0]
  const displayEndpoint = resolvedModel ? resolveConfiguredToolEndpoint(resolvedModel, tool) : ""

  function handleFile(file: File) {
    if (!file.type.startsWith("image/")) { setError("请选择图片文件（PNG、JPG、WebP）"); return }
    if (file.size > 10 * 1024 * 1024) { setError("图片大小不能超过 10MB"); return }
    const reader = new FileReader()
    reader.onload = () => { setImageData(reader.result as string); setImageMime(file.type); setError("") }
    reader.readAsDataURL(file)
  }

  function handleDrop(e: DragEvent<HTMLDivElement>) {
    e.preventDefault(); setDragOver(false)
    const file = e.dataTransfer.files[0]
    if (file) handleFile(file)
  }

  function clearImage() { setImageData(null); setOutputImage(null) }

  async function handleRun() {
    if (!activeConfig || !resolvedModel || !tool) { setError("请先完成 API 配置。"); return }
    setIsRunning(true); setError(""); setOutputText(""); setOutputImage(null); setOutputAudio(null); setEndpoint("")
    try {
      const base64 = imageData ? imageData.split(",")[1] : undefined
      const result: RunToolResponse = await runConfiguredTool({
        apiKey: activeConfig.apiKey, model: resolvedModel, tool,
        inputText: inputText || tool.defaultInput,
        imageBase64: base64, imageMimeType: imageMime,
        timeoutSeconds: activeConfig.timeoutSeconds,
      })
      setOutputText(result.content)
      if (result.imageData) {
        setOutputImage(normalizeToolImageOutput(result.imageData) ?? null)
      }
      setEndpoint(result.endpoint)
    } catch (err: unknown) { setError(err instanceof Error ? err.message : "工具调用失败") }
    finally { setIsRunning(false) }
  }

  async function handleCopy() {
    if (!outputText) return
    try { await navigator.clipboard.writeText(outputText); setHasCopied(true); setTimeout(() => setHasCopied(false), 1800) }
    catch { setError("复制失败") }
  }

  function handleDownload() {
    if (!outputImage) return
    downloadImage(outputImage, tool?.id ?? "output")
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Button variant="outline" size="sm" onClick={() => navigate("/console")}><ArrowLeft className="h-4 w-4" /> 返回</Button>
          <h2 className="text-2xl font-bold">{tool.name}</h2>
          <Badge variant="secondary">{tool.category === "text" ? "文本" : tool.category === "image" ? "图像" : "音频"}</Badge>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline">{activeConfig?.name ?? "未配置 API"}</Badge>
          <ModelSelector toolModelFilter={tool.modelFilter} />
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[320px_1fr]">
        <aside className="space-y-4">
          <Card className="border-white/75 bg-white/90 shadow-xl backdrop-blur-xl">
            <CardHeader>
              <CardTitle className="text-base">{tool.name}</CardTitle>
              <CardDescription className="leading-6">{tool.description}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
                <p className="font-semibold text-slate-950">模型：{resolvedModel?.id ?? "未选择"}</p>
                <p className="mt-2 break-all font-mono text-xs text-slate-500">{displayEndpoint || "未选择"}</p>
                <p className="mt-2 text-xs">API Key：{maskSecret(activeConfig?.apiKey ?? "")}</p>
              </div>
              <Button variant="outline" className="w-full" onClick={() => navigate("/settings")}>配置 API</Button>
            </CardContent>
          </Card>
          {!hasRunnableConfig && (
            <Alert className="border-amber-200 bg-amber-50 text-amber-950">
              <AlertCircle className="h-4 w-4" /><AlertTitle>需要 API 配置</AlertTitle>
              <AlertDescription className="text-amber-800">填写 API 地址、API Key 和模型 ID 后即可运行工具。</AlertDescription>
            </Alert>
          )}
        </aside>

        <div className="grid gap-6 xl:grid-cols-2">
          {/* Input */}
          <Card className="border-white/75 bg-white/90 shadow-xl backdrop-blur-xl">
            <CardHeader>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div><CardTitle>输入内容</CardTitle><CardDescription className="mt-2">{tool.placeholder}</CardDescription></div>
                {tool.defaultInput && (
                  <Button variant="outline" size="sm" onClick={() => { setInputText(tool.defaultInput); setOutputText(""); setError("") }}>使用示例</Button>
                )}
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {needsImage && (
                <div className={cn("rounded-2xl border-2 border-dashed p-6 text-center transition-colors", dragOver ? "border-emerald-400 bg-emerald-50" : "border-slate-200 bg-slate-50")}
                  onDragOver={(e) => { e.preventDefault(); setDragOver(true) }} onDragLeave={() => setDragOver(false)} onDrop={handleDrop}>
                  {imageData ? (
                    <div className="relative">
                      <img src={imageData} alt="预览" className="max-h-48 mx-auto rounded-xl object-contain" />
                      <Button variant="destructive" size="icon" className="absolute top-1 right-1 h-7 w-7" onClick={clearImage}><X className="h-3 w-3" /></Button>
                    </div>
                  ) : (
                    <label className="cursor-pointer flex flex-col items-center gap-2">
                      <Upload className="h-8 w-8 text-slate-400" />
                      <span className="text-sm text-slate-500">拖拽图片或点击选择</span>
                      <span className="text-xs text-slate-400">PNG、JPG、WebP，最大 10MB</span>
                      <input type="file" accept="image/png,image/jpeg,image/webp" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f) }} />
                    </label>
                  )}
                </div>
              )}
              <Textarea value={inputText} onChange={(e: ChangeEvent<HTMLTextAreaElement>) => setInputText(e.target.value)}
                placeholder={tool.placeholder} className="min-h-[150px] resize-y bg-white leading-7" />
              <Button type="button" size="lg" onClick={handleRun}
                disabled={isRunning || !hasRunnableConfig || (needsImage && !imageData)}
                className="h-12 w-full">
                {isRunning ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                {isRunning ? "正在调用..." : `运行${tool.shortName}工具`}
              </Button>
            </CardContent>
          </Card>

          {/* Output */}
          <Card className="border-white/75 bg-white/90 shadow-xl backdrop-blur-xl">
            <CardHeader>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div><CardTitle>{tool.outputLabel}</CardTitle><CardDescription className="mt-2">结果仅展示在当前页面。</CardDescription></div>
                <div className="flex gap-2">
                  {producesImage && outputImage && <Button variant="outline" size="sm" onClick={handleDownload}><Download className="h-4 w-4" /> 下载</Button>}
                  {outputText && <Button variant="outline" size="sm" onClick={handleCopy} disabled={!outputText}>{hasCopied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}{hasCopied ? "已复制" : "复制"}</Button>}
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {error && <Alert variant="destructive"><AlertCircle className="h-4 w-4" /><AlertTitle>调用失败</AlertTitle><AlertDescription>{error}</AlertDescription></Alert>}
              {producesImage && outputImage && (
                <div className="rounded-2xl overflow-hidden border border-slate-200"><img src={outputImage} alt="结果" className="w-full object-contain max-h-[400px]" /></div>
              )}
              {isTts && outputAudio && (
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4"><audio controls className="w-full"><source src={outputAudio} /></audio></div>
              )}
              <div className={cn("min-h-[200px] rounded-3xl border border-slate-200 p-5 text-sm leading-7 shadow-inner", outputText ? "bg-slate-950 text-slate-100" : "bg-slate-50")}>
                {outputText ? (
                  <pre className="whitespace-pre-wrap break-words font-sans">{outputText}</pre>
                ) : (
                  <div className="flex h-full min-h-[180px] flex-col items-center justify-center gap-4 text-center text-slate-400">
                    {producesImage ? <Image className="h-10 w-10" /> : isTts ? <Volume2 className="h-10 w-10" /> : <Sparkles className="h-10 w-10" />}
                    <div><p className="font-medium text-slate-500">AI 结果将在这里展示</p><p className="mt-2 max-w-sm text-sm">确认输入后即可运行。</p></div>
                  </div>
                )}
              </div>
              {endpoint && <p className="break-all rounded-xl bg-slate-50 p-3 font-mono text-xs text-slate-500">Request: {endpoint}</p>}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}

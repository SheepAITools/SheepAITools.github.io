import type { ToolDefinition } from "@/types/sheepai"

export const TOOL_DEFINITIONS: ToolDefinition[] = [
  // ===== 文本工具 =====
  {
    id: "translation",
    name: "AI 翻译",
    shortName: "翻译",
    category: "text",
    icon: "Languages",
    description: "自动识别原文语言，输出自然、准确、保留语气的中文或英文译文。",
    outputLabel: "翻译结果",
    placeholder: "粘贴需要翻译的文本，例如一封英文邮件、一段产品文案或一段技术文档。",
    systemPrompt: "你是专业翻译助手。请准确理解上下文，优先输出自然流畅的译文；保留专有名词、代码、链接和格式；不要添加原文没有的信息。",
    buildUserPrompt: (inputText: string): string => `请翻译以下内容。如果原文不是中文，优先翻译为简体中文；如果原文是中文，翻译为自然英文。\n\n${inputText}`,
    defaultInput: "Please translate this sentence into natural Chinese: SheepAI helps developers connect multiple AI models with one API key.",
    modelFilter: "text",
  },
  {
    id: "polishing",
    name: "文本润色",
    shortName: "润色",
    category: "text",
    icon: "PenLine",
    description: "优化表达、语气和结构，让文字更清晰、有说服力且易读。",
    outputLabel: "润色结果",
    placeholder: "输入需要润色的中文或英文内容，例如公告、邮件、介绍文案。",
    systemPrompt: "你是资深内容编辑。请在不改变事实含义的前提下提升表达质量，保持清晰、专业、友好，并保留原文关键信息。",
    buildUserPrompt: (inputText: string): string => `请润色以下文本，并只输出润色后的版本。\n\n${inputText}`,
    defaultInput: "我们平台可以让用户输入自己的 API key，然后选择模型使用一些 AI 工具，整个过程不经过我们的服务器。",
    modelFilter: "text",
  },
  {
    id: "summary",
    name: "摘要提取",
    shortName: "摘要",
    category: "text",
    icon: "FileText",
    description: "从长文本中提取核心观点、关键行动项和适合转发的短摘要。",
    outputLabel: "摘要结果",
    placeholder: "粘贴会议记录、文章、公告或需求文档，获取结构化摘要。",
    systemPrompt: "你是高效的信息整理助手。请提取重点、去除重复信息，用清晰层级组织答案。",
    buildUserPrompt: (inputText: string): string => `请为以下内容生成结构化摘要，包含：一句话概览、3-5 个要点、可执行行动项。\n\n${inputText}`,
    defaultInput: "SheepAI 工具平台是一个纯前端静态网站。用户在 SheepAI 注册账号后获得 API Key，在浏览器里输入密钥并选择模型，就可以直接调用翻译、摘要、润色等工具。平台不提供后端代理，也不会保存用户内容。",
    modelFilter: "text",
  },
  {
    id: "prompt-optimizer",
    name: "提示词优化",
    shortName: "提示词",
    category: "text",
    icon: "Wand2",
    description: "把粗略需求改写成更稳定、更可执行的高质量提示词。",
    outputLabel: "优化后的提示词",
    placeholder: "描述你想让 AI 完成的任务，例如写营销文案、分析数据、生成代码。",
    systemPrompt: "你是提示词工程专家。请把用户的初始需求改写为目标清晰、上下文充分、输出格式明确、约束具体的提示词。",
    buildUserPrompt: (inputText: string): string => `请优化下面的初始提示词。输出包括：优化版提示词、关键改进点、可选参数建议。\n\n${inputText}`,
    defaultInput: "帮我写一段介绍 SheepAI 工具平台的文案，突出不用后端、浏览器直连、可以选择不同模型。",
    modelFilter: "text",
  },
  {
    id: "code-explain",
    name: "代码解释",
    shortName: "代码",
    category: "text",
    icon: "Code2",
    description: "解释代码用途、执行流程、潜在风险和改进建议，适合快速读代码。",
    outputLabel: "代码解释",
    placeholder: "粘贴一段代码，支持 JavaScript、TypeScript、Python、SQL 等常见语言。",
    systemPrompt: "你是耐心的代码讲解老师。请用准确、简洁的方式解释代码，不臆测不存在的上下文。",
    buildUserPrompt: (inputText: string): string => `请解释以下代码，包含：整体作用、关键步骤、输入输出、潜在问题、安全注意事项、改进建议。\n\n${inputText}`,
    defaultInput: "async function run(apiKey, text) {\n  const response = await fetch('https://www.sheepai.top/v1/chat/completions', {\n    method: 'POST',\n    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },\n    body: JSON.stringify({ model: 'gpt-4o-mini', messages: [{ role: 'user', content: text }] })\n  });\n  return response.json();\n}",
    modelFilter: "text",
  },

  // ===== 图像工具 =====
  {
    id: "image-generate",
    name: "AI 图片生成",
    shortName: "图片生成",
    category: "image",
    icon: "Image",
    description: "根据文字描述生成高质量图片，支持多种风格和尺寸。",
    outputLabel: "生成的图片",
    placeholder: "描述你想生成的图片，例如：一只穿着宇航服的赛博朋克风格羊，在宇宙中漂浮，霓虹灯光，4K高清",
    systemPrompt: "你是专业图像生成助手。根据用户描述生成高质量图片。",
    buildUserPrompt: (inputText: string): string => inputText,
    defaultInput: "A cyberpunk style sheep wearing a spacesuit, floating in space, neon lights, 4K high quality",
    modelFilter: "image-gen",
    supportsImageOutput: true,
  },
  {
    id: "image-bg-remove",
    name: "AI 抠图",
    shortName: "抠图",
    category: "image",
    icon: "Scissors",
    description: "上传图片，自动识别主体并移除背景，输出透明背景图片。",
    outputLabel: "抠图结果",
    placeholder: "上传一张图片，AI 将自动识别主体并移除背景。",
    systemPrompt: "你是专业图像处理助手。请识别图片中的主体，移除背景，只保留主体部分。",
    buildUserPrompt: (): string => "请移除这张图片的背景，只保留主体，输出透明背景的图片。",
    defaultInput: "",
    modelFilter: "image-vision",
    supportsImageInput: true,
    supportsImageOutput: true,
  },
  {
    id: "image-edit",
    name: "AI P图",
    shortName: "P图",
    category: "image",
    icon: "Paintbrush",
    description: "上传图片并描述修改需求，AI 将根据指令编辑图片。",
    outputLabel: "编辑结果",
    placeholder: "上传图片，然后描述你想要的修改，例如：将背景改为海滩日落、给人物加上墨镜、把色调调成暖色",
    systemPrompt: "你是专业图片编辑助手。请根据用户指令修改图片，保持主体不变，精确执行编辑要求。",
    buildUserPrompt: (inputText: string): string => `请根据以下指令编辑图片：${inputText}`,
    defaultInput: "给这张图片添加柔和的暖色滤镜，增强对比度",
    modelFilter: "image-edit",
    supportsImageInput: true,
    supportsImageOutput: true,
  },

  // ===== 音频工具 =====
  {
    id: "text-to-speech",
    name: "文字转语音",
    shortName: "TTS",
    category: "audio",
    icon: "Volume2",
    description: "将文字转换为自然流畅的语音，支持多种音色和语速调节。",
    outputLabel: "生成的语音",
    placeholder: "输入需要转换为语音的文字内容，例如：欢迎使用赛博小羊的AI工具箱，这是一个功能强大的AI工具平台。",
    systemPrompt: "",
    buildUserPrompt: (inputText: string): string => inputText,
    defaultInput: "欢迎使用赛博小羊的AI工具箱，这是一个功能强大的AI工具平台，为您提供翻译、图片生成、语音合成等多种AI能力。",
    modelFilter: "tts",
  },
]

export function getDefaultTool(): ToolDefinition {
  return TOOL_DEFINITIONS[0]
}

export function getToolById(id: string): ToolDefinition | undefined {
  return TOOL_DEFINITIONS.find((t) => t.id === id)
}

export interface ToolCategoryGroup {
  category: string
  label: string
  icon: string
  tools: ToolDefinition[]
}

export function getToolCategories(): ToolCategoryGroup[] {
  const groups: ToolCategoryGroup[] = [
    { category: "text", label: "文本工具", icon: "FileText", tools: [] },
    { category: "image", label: "图像工具", icon: "Image", tools: [] },
    { category: "audio", label: "音频工具", icon: "Volume2", tools: [] },
  ]

  for (const tool of TOOL_DEFINITIONS) {
    const group = groups.find((g) => g.category === tool.category)
    if (group) group.tools.push(tool)
  }

  return groups.filter((g) => g.tools.length > 0)
}

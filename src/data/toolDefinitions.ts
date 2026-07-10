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
    defaultInput: "请输入要翻译的内容",
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
    defaultInput: "请输入要润色的文本",
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
    defaultInput: "请输入要提取摘要的文段",
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
    systemPrompt: "你是提示词工程专家。请把用户的初始需求改写为目标清晰、上下文充分、输出格式明确、约束具体、结构清晰的提示词。",
    buildUserPrompt: (inputText: string): string => `请优化下面的初始提示词。\n\n${inputText}`,
    defaultInput: "请输入需要优化的提示词",
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
    defaultInput: "请输入要解释的代码",
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
    defaultInput: "请描述你想生成的图片",
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
    placeholder: "上传一张图片，AI 将自动识别主体并移除背景。如需补充要求请在文本框中写入，如没有补充要求请将文本框留空",
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
    defaultInput: "请输入修改描述",
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
    defaultInput: "请输入需要转换成语音的文字内容",
    modelFilter: "tts",
  },
  {
    id: "speech-to-text",
    name: "语音转文字",
    shortName: "转文字",
    category: "audio",
    icon: "Mic",
    description: "上传音频文件，自动转为文字。支持中英文等多种语言的语音识别。",
    outputLabel: "识别结果",
    placeholder: "上传音频文件后，AI 将自动识别并将语音转写为文字。",
    systemPrompt: "你是专业语音识别转写助手。请准确转写音频内容，保留停顿、语气。",
    buildUserPrompt: (): string => "请将这段音频转写为文字，保留说话人的自然表达。",
    defaultInput: "",
    modelFilter: "stt",
  },

  // ===== 更多文本工具 =====
  {
    id: "code-generate",
    name: "AI 代码生成",
    shortName: "代码生成",
    category: "text",
    icon: "Code2",
    description: "用自然语言描述需求，AI 自动生成高质量代码。支持多种编程语言和框架。",
    outputLabel: "生成的代码",
    placeholder: "描述你想实现的功能，例如：用 Python 写一个 Flask API，接收 POST JSON 数据并存入 SQLite 数据库",
    systemPrompt: "你是资深软件工程师。请根据需求生成干净、可运行、有注释的代码。优先使用最佳实践和现代语法。",
    buildUserPrompt: (inputText: string): string => `请根据以下需求生成代码。包含：完整代码、运行说明、关键设计决策。\n\n${inputText}`,
    defaultInput: "用 TypeScript 写一个函数，接收一个字符串数组，返回去重并排序后的结果，包含错误处理。",
    modelFilter: "text",
  },
  {
    id: "text-correct",
    name: "文本纠错",
    shortName: "纠错",
    category: "text",
    icon: "FileCheck",
    description: "自动检测并纠正文本中的语法错误、错别字、标点问题，输出修正后的版本。",
    outputLabel: "纠错结果",
    placeholder: "粘贴需要纠错的中文或英文内容，AI 将自动检测并修正问题。",
    systemPrompt: "你是专业校对编辑。请仔细检查并纠正所有语法、拼写、标点和表达问题，输出修正后的版本和修改说明。",
    buildUserPrompt: (inputText: string): string => `请检查并纠正以下文本的所有错误。输出修正版本和问题列表。\n\n${inputText}`,
    defaultInput: "我昨天去了一趟超市买了点东西然后回家做饭吃完了看电视看到很晚才谁觉。",
    modelFilter: "text",
  },
  {
    id: "format-convert",
    name: "格式转换",
    shortName: "格式转换",
    category: "text",
    icon: "ArrowLeftRight",
    description: "在不同数据格式之间转换，如 JSON ↔ YAML ↔ CSV ↔ XML ↔ Markdown 表格。",
    outputLabel: "转换结果",
    placeholder: "粘贴源格式数据，AI 将自动识别并转换为指定格式。例如：将这个 JSON 转为 YAML 格式",
    systemPrompt: "你是数据格式转换专家。请准确地将输入数据转换为目标格式，保持所有字段和值不变。",
    buildUserPrompt: (inputText: string): string => `请将以下数据转换为目标格式。自动识别源格式，转换为更易读的格式。\n\n${inputText}`,
    defaultInput: '{"name":"SheepAI","version":"1.0","features":["translation","images","tts"],"active":true}',
    modelFilter: "text",
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

# 赛博小羊的ai工具箱

一个可静态部署的纯前端 AI 工具箱，面向 SheepAI 用户。用户先使用「用户 ID + 系统令牌」查询账号与 API Key 列表，再选择模型调用令牌与可用模型，在浏览器中直连 SheepAI 使用文本工具。

## 使用流程

### 1. 登录与账号确认

- 登录页输入用户 ID 与系统令牌。
- 用户 ID 获取路径：SheepAI 控制台 -> 个人设置 -> 用户名旁边可复制。
- 系统令牌获取路径：SheepAI 控制台 -> 个人设置 -> 安全设置 -> 生成并复制。
- 系统令牌仅用于查询账号信息与 API Key 列表，不等同于模型调用 API Key。
- 登录时调用 SheepAI 系统 API 查询账号信息；失败时在页面展示错误提示。
- 请通过 `npm run dev`、`npm run preview` 或 HTTPS 静态托管访问页面；不要直接双击 `dist/index.html`，`file://` 页面来源为 `null`，浏览器跨域请求容易被 SheepAI 系统 API 拒绝。

### 2. 选择 API Key 与模型

- 账号确认后展示当前账号下的 API Key 列表。
- 选择一个 API Key 后，工具箱会调用模型列表接口查询该 Key 支持的模型。
- 无令牌、无模型、令牌缺少明文 Key 或接口字段不完整时，页面会展示空态或错误态。
- 可在控制台切换 API Key 或模型。

### 3. 工具调用

- 保留内置工具：AI 翻译、文本润色、摘要提取、提示词优化、代码解释。
- 工具调用使用所选 API Key 与模型，由浏览器直接请求 SheepAI 模型接口。
- 运行结果仅展示在当前浏览器页面，可一键复制。

## 功能与边界

- 默认由浏览器直连 SheepAI；如遇 CORS 限制，可启用本地后端代理。
- `src/lib/systemApiClient.ts` 只负责 SheepAI 系统 API：账号、令牌、模型列表与用量查询。
- `src/lib/sheepaiClient.ts` 只负责模型工具调用。
- 默认只可选记住用户 ID；系统令牌与 API Key 不写入 localStorage。
- 系统 API 响应字段做容错适配，避免强绑定单一返回结构。

## 开发与构建

```bash
npm install
npm run dev
npm run lint
npm run build
npm run preview
```

### 本地代理测试

当浏览器直连 SheepAI 被 CORS 拦截时，可在本地启动最小 Node 代理。代理默认监听 `8787` 端口，只转发固定 SheepAI origin 与白名单路径，不支持任意目标 URL。

```bash
npm run dev:proxy
```

新开一个终端启动前端：

```bash
npm run dev
```

在项目根目录创建 `.env.local`，让系统 API 与模型 API 都走本地代理：

```bash
VITE_SHEEPAI_PROXY_BASE=http://localhost:8787/sheepai
```

健康检查：

```bash
curl http://localhost:8787/health
```

代理支持的路径包括：`/api/user/self`、`/api/token/`、`/api/usage/token/`、`/v1/models`、`/v1/chat/completions`、`/v1/messages`。代理仅透传必要请求头：`Authorization`、`New-Api-User`、`Content-Type`。

### 代理隐私与部署边界

- 本地代理只做请求转发，不写入系统令牌、API Key 或请求体日志。
- 代理日志仅包含 method、path、status 与耗时，不包含 `Authorization`、`New-Api-User` 或模型输入内容。
- 部署到平台后，用户仍需信任该代理运行方，因为凭据会经过代理进程内存。
- 后续可部署到 Cloudflare Workers、Vercel、Render 或自托管 Node 服务；部署时应继续保留固定 origin、路径白名单和脱敏日志策略。

## 静态部署

运行 `npm run build` 后，将 `dist/` 上传到 GitHub Pages、Cloudflare Pages、Vercel 或其他静态托管即可。项目使用 Vite 相对路径 `base: './'`，适合 GitHub Pages 子路径部署。

## 浏览器跨域限制

系统 API 默认由浏览器直接请求 `https://www.sheepai.top/api/...`，GET 请求会携带 `Authorization` 与 `New-Api-User` 头；模型调用 POST 请求 `https://www.sheepai.top/v1/...` 时才携带 `Content-Type: application/json`。这些跨域请求可能触发 CORS 预检或被 SheepAI 服务端按当前站点来源拦截，浏览器会在前端抛出 `Failed to fetch`，此时命令行脚本仍可能正常调用接口。页面会将这类错误提示为浏览器网络/CORS 限制，而不是凭据错误。可通过 `.env.local` 配置 `VITE_SHEEPAI_PROXY_BASE=http://localhost:8787/sheepai` 改走本地代理；最终修复需要 SheepAI 服务端允许静态站点 Origin、响应 OPTIONS 预检，或提供同域/可信代理入口。

## 注意

模型列表与模型调用默认走 `https://www.sheepai.top/v1/...`。当前环境中 `api.sheepai.top` DNS 不可解析，若改回该域名可能导致浏览器或 Node 抛出 `Failed to fetch` / `ENOTFOUND`。具体可用性、路径和鉴权规则请以 SheepAI 文档为准：https://sheepai.apifox.cn/。

/**
 * Backend API 地址配置
 *
 * 系统 API（用户信息、令牌列表、模型列表、用量查询）走此后端代理。
 * 开发环境默认 localhost:3000，部署到云端时修改环境变量：
 *   VITE_API_BASE_URL=https://your-cloud-backend.example.com
 *
 * 模型调用（AI 推理）不经过此代理，直连 SheepAI：
 *   OpenAI 协议 → https://www.sheepai.top/v1
 *   Anthropic 协议 → https://www.sheepai.top
 */

export const API_BASE_URL: string =
  (import.meta.env.VITE_API_BASE_URL as string | undefined)?.trim().replace(/\/+$/, "") ||
  "https://sheepaitools-system-proxy.cybersheep33.workers.dev"

/** 系统 API 请求路径拼接 */
export function systemApiUrl(path: string): string {
  const normalizedPath = path.startsWith("/") ? path : `/${path}`
  return `${API_BASE_URL}${normalizedPath}`
}

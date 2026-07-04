import { createContext, useCallback, useContext, useMemo, useReducer, type ReactNode } from "react"
import type { AccountInfo, ModelDefinition, RawModelInfo, TokenPage, TokenRecord, TokenUsage } from "@/types/sheepai"
import { getSelf, getTokenModels, getTokenUsage, listTokens } from "@/lib/systemApiClient"
import { loadLastModelId, loadLastTokenId, loadUserId, saveLastModelId, saveLastTokenId, saveUserId } from "@/lib/sessionStore"

// ============ State ============

interface AuthState {
  userId: string
  systemToken: string
  rememberUserId: boolean
  account: AccountInfo | null
  tokenPage: TokenPage
  availableModels: ModelDefinition[]
  rawModels: RawModelInfo[]
  selectedTokenId: string
  selectedModelId: string
  tokenUsage: TokenUsage
  isLoadingAccount: boolean
  isLoadingModels: boolean
  errorMessage: string
  loginMessage: string
}

const EMPTY_TOKEN_PAGE: TokenPage = { page: 1, size: 50, total: 0, items: [] }
const EMPTY_USAGE: TokenUsage = { tokenId: "", promptTokens: 0, completionTokens: 0, totalTokens: 0, resetAt: "" }

function initialAuthState(): AuthState {
  return {
    userId: loadUserId(),
    systemToken: "",
    rememberUserId: true,
    account: null,
    tokenPage: EMPTY_TOKEN_PAGE,
    availableModels: [],
    rawModels: [],
    selectedTokenId: "",
    selectedModelId: "",
    tokenUsage: EMPTY_USAGE,
    isLoadingAccount: false,
    isLoadingModels: false,
    errorMessage: "",
    loginMessage: "",
  }
}

// ============ Actions ============

type AuthAction =
  | { type: "SET_CREDENTIALS"; userId: string; systemToken: string; rememberUserId: boolean }
  | { type: "LOGIN_START" }
  | { type: "LOGIN_SUCCESS"; account: AccountInfo; tokens: TokenPage }
  | { type: "LOGIN_FAIL"; message: string }
  | { type: "SELECT_TOKEN_START"; tokenId: string }
  | { type: "SELECT_TOKEN_SUCCESS"; models: ModelDefinition[]; rawModels: RawModelInfo[]; usage: TokenUsage }
  | { type: "SELECT_TOKEN_FAIL"; message: string }
  | { type: "SET_SELECTED_MODEL"; modelId: string }
  | { type: "CLEAR_ERROR" }
  | { type: "LOGOUT" }

function authReducer(state: AuthState, action: AuthAction): AuthState {
  switch (action.type) {
    case "SET_CREDENTIALS":
      return { ...state, userId: action.userId, systemToken: action.systemToken, rememberUserId: action.rememberUserId, loginMessage: "", errorMessage: "" }
    case "LOGIN_START":
      return { ...state, isLoadingAccount: true, loginMessage: "", errorMessage: "", account: null, tokenPage: EMPTY_TOKEN_PAGE, availableModels: [], rawModels: [], selectedTokenId: "" }
    case "LOGIN_SUCCESS":
      return { ...state, isLoadingAccount: false, account: action.account, tokenPage: action.tokens }
    case "LOGIN_FAIL":
      return { ...state, isLoadingAccount: false, loginMessage: action.message }
    case "SELECT_TOKEN_START":
      return { ...state, isLoadingModels: true, errorMessage: "", selectedTokenId: action.tokenId, availableModels: [], rawModels: [], tokenUsage: EMPTY_USAGE }
    case "SELECT_TOKEN_SUCCESS":
      return { ...state, isLoadingModels: false, availableModels: action.models, rawModels: action.rawModels, tokenUsage: action.usage }
    case "SELECT_TOKEN_FAIL":
      return { ...state, isLoadingModels: false, errorMessage: action.message }
    case "SET_SELECTED_MODEL":
      return { ...state, selectedModelId: action.modelId }
    case "CLEAR_ERROR":
      return { ...state, errorMessage: "" }
    case "LOGOUT":
      return initialAuthState()
    default:
      return state
  }
}

// ============ Context ============

interface AuthContextValue {
  state: AuthState
  selectedToken: TokenRecord | undefined
  selectedModel: ModelDefinition | undefined
  setCredentials: (userId: string, systemToken: string, rememberUserId: boolean) => void
  login: (userId: string, systemToken: string, rememberUserId: boolean) => Promise<void>
  guestLogin: (apiKey: string) => Promise<void>
  selectToken: (token: TokenRecord) => Promise<void>
  selectModel: (modelId: string) => void
  clearError: () => void
  logout: () => void
  refreshTokens: () => Promise<void>
  hasCredentials: boolean
  isAuthenticated: boolean
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(authReducer, undefined, initialAuthState)

  const selectedToken = useMemo<TokenRecord | undefined>(() => {
    return state.tokenPage.items.find((t) => t.id === state.selectedTokenId)
  }, [state.tokenPage.items, state.selectedTokenId])

  const selectedModel = useMemo<ModelDefinition | undefined>(() => {
    if (state.selectedModelId && state.availableModels.length > 0) {
      return state.availableModels.find((m) => m.id === state.selectedModelId) ?? state.availableModels[0]
    }
    return state.availableModels[0]
  }, [state.availableModels, state.selectedModelId])

  const hasCredentials = state.userId.trim().length > 0 && state.systemToken.trim().length > 0
  const isAuthenticated = state.account !== null

  const setCredentials = useCallback((userId: string, systemToken: string, rememberUserId: boolean) => {
    dispatch({ type: "SET_CREDENTIALS", userId, systemToken, rememberUserId })
  }, [])

  const login = useCallback(async (userId: string, systemToken: string, rememberUserId: boolean) => {
    const trimmedUserId = userId.trim()
    const trimmedToken = systemToken.trim()

    if (!trimmedUserId || !trimmedToken) {
      dispatch({ type: "LOGIN_FAIL", message: "请同时输入用户 ID 与系统令牌。" })
      return
    }

    dispatch({ type: "LOGIN_START" })

    try {
      const [account, tokens] = await Promise.all([
        getSelf(trimmedUserId, trimmedToken),
        listTokens(trimmedUserId, trimmedToken),
      ])

      dispatch({ type: "LOGIN_SUCCESS", account, tokens })

      if (rememberUserId) {
        saveUserId(trimmedUserId)
      }

      const lastTokenId = loadLastTokenId()
      if (lastTokenId && tokens.items.some((t) => t.id === lastTokenId)) {
        // Token will be auto-selected by the page component
      }
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : "账号校验失败，请检查用户 ID 与系统令牌是否正确。"
      dispatch({ type: "LOGIN_FAIL", message: msg })
    }
  }, [])

  const guestLogin = useCallback(async (apiKey: string) => {
    const trimmedKey = apiKey.trim()
    if (!trimmedKey) {
      dispatch({ type: "LOGIN_FAIL", message: "请输入 API 令牌。" })
      return
    }

    dispatch({ type: "LOGIN_START" })

    const guestAccount: AccountInfo = {
      userId: "guest",
      displayName: "游客",
      email: "",
      status: "游客模式",
      organization: "",
      quota: 0,
      usedQuota: 0,
      requestCount: 0,
    }

    const guestToken: TokenRecord = {
      id: "guest-token",
      name: "游客令牌",
      tokenType: "API Key",
      apiKey: trimmedKey,
      description: "直接使用 API 令牌调用",
      expiresAt: "",
      enabled: true,
      usageCount: null,
      supportedModelIds: [],
      unlimitedQuota: true,
      usedQuota: 0,
      remainQuota: 0,
    }

    const tokenPage: TokenPage = { page: 1, size: 1, total: 1, items: [guestToken] }

    try {
      const models = await getTokenModels({
        userId: "guest",
        systemToken: trimmedKey,
        token: guestToken,
      })

      saveUserId("guest")

      const nextModel = models[0]
      if (nextModel) saveLastModelId(nextModel.id)

      dispatch({ type: "LOGIN_SUCCESS", account: guestAccount, tokens: tokenPage })
      dispatch({ type: "SELECT_TOKEN_START", tokenId: "guest-token" })
      dispatch({ type: "SET_SELECTED_MODEL", modelId: nextModel?.id ?? "" })
      dispatch({ type: "SELECT_TOKEN_SUCCESS", models, rawModels: [], usage: { ...EMPTY_USAGE, tokenId: "guest-token" } })
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : "无法查询模型，请检查 API 令牌是否正确。"
      dispatch({ type: "LOGIN_FAIL", message: msg })
    }
  }, [])

  const selectToken = useCallback(async (token: TokenRecord) => {
    const trimmedUserId = state.userId.trim()
    const trimmedToken = state.systemToken.trim()

    dispatch({ type: "SELECT_TOKEN_START", tokenId: token.id })

    try {
      const modelsResult = await getTokenModels({ userId: trimmedUserId, systemToken: trimmedToken, token })
      const usage = await getTokenUsage({ userId: trimmedUserId, systemToken: trimmedToken, tokenId: token.id }).catch((): TokenUsage => ({ ...EMPTY_USAGE, tokenId: token.id }))

      saveLastTokenId(token.id)

      if (modelsResult.length === 0) {
        dispatch({ type: "SELECT_TOKEN_FAIL", message: "该 API Key 暂未返回可用模型。请切换其他 API Key。" })
        return
      }

      const lastModelId = loadLastModelId()
      const nextModel = modelsResult.find((m) => m.id === lastModelId) ?? modelsResult[0]
      saveLastModelId(nextModel.id)
      dispatch({ type: "SET_SELECTED_MODEL", modelId: nextModel.id })

      dispatch({ type: "SELECT_TOKEN_SUCCESS", models: modelsResult, rawModels: [], usage })
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : "查询模型失败。"
      dispatch({ type: "SELECT_TOKEN_FAIL", message: msg })
    }
  }, [state.userId, state.systemToken])

  const selectModel = useCallback((modelId: string) => {
    dispatch({ type: "SET_SELECTED_MODEL", modelId })
    saveLastModelId(modelId)
  }, [])

  const clearError = useCallback(() => dispatch({ type: "CLEAR_ERROR" }), [])

  const logout = useCallback(() => dispatch({ type: "LOGOUT" }), [])

  const refreshTokens = useCallback(async () => {
    const trimmedUserId = state.userId.trim()
    const trimmedToken = state.systemToken.trim()
    if (!trimmedUserId || !trimmedToken) return

    dispatch({ type: "LOGIN_START" })
    try {
      const [account, tokens] = await Promise.all([
        getSelf(trimmedUserId, trimmedToken),
        listTokens(trimmedUserId, trimmedToken),
      ])
      dispatch({ type: "LOGIN_SUCCESS", account, tokens })
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : "刷新失败。"
      dispatch({ type: "LOGIN_FAIL", message: msg })
    }
  }, [state.userId, state.systemToken])

  const value: AuthContextValue = useMemo(() => ({
    state, selectedToken, selectedModel,
    setCredentials, login, guestLogin, selectToken, selectModel,
    clearError, logout, refreshTokens,
    hasCredentials, isAuthenticated,
  }), [state, selectedToken, selectedModel, setCredentials, login, selectToken, selectModel, clearError, logout, refreshTokens, hasCredentials, isAuthenticated])

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error("useAuth must be used within AuthProvider")
  return ctx
}

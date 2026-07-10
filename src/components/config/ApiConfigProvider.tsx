import { useCallback, useMemo, useReducer, type ReactNode } from "react"
import { ApiConfigContext, type ApiConfigState } from "@/components/config/apiConfigContext"
import {
  buildConfigFromDraft,
  loadActiveConfigId,
  loadApiConfigurations,
  saveActiveConfigId,
  saveApiConfigurations,
  type ApiConfigDraft,
} from "@/lib/configStore"
import { runConnectivityTest } from "@/lib/genericAiClient"
import { buildModelOptions } from "@/data/models"
import type { ApiConfiguration } from "@/types/sheepai"

type ApiConfigAction =
  | { type: "UPSERT_CONFIG"; config: ApiConfiguration }
  | { type: "DELETE_CONFIG"; configId: string }
  | { type: "SET_ACTIVE"; configId: string }
  | { type: "TEST_START" }
  | { type: "TEST_SUCCESS"; message: string }
  | { type: "TEST_ERROR"; message: string }
  | { type: "CLEAR_TEST" }

function initialState(): ApiConfigState {
  const configs = loadApiConfigurations()
  const savedActiveId = loadActiveConfigId()
  const activeConfigId = configs.some((config) => config.id === savedActiveId)
    ? savedActiveId
    : configs[0]?.id ?? ""

  return {
    configs,
    activeConfigId,
    isTesting: false,
    testMessage: "",
    testStatus: "idle",
  }
}

function persist(configs: ApiConfiguration[], activeConfigId: string): void {
  saveApiConfigurations(configs)
  saveActiveConfigId(activeConfigId)
}

function reducer(state: ApiConfigState, action: ApiConfigAction): ApiConfigState {
  switch (action.type) {
    case "UPSERT_CONFIG": {
      const exists = state.configs.some((config) => config.id === action.config.id)
      const configs = exists
        ? state.configs.map((config) => config.id === action.config.id ? action.config : config)
        : [...state.configs, action.config]
      const activeConfigId = state.activeConfigId || action.config.id
      persist(configs, activeConfigId)
      return { ...state, configs, activeConfigId, testMessage: "", testStatus: "idle" }
    }
    case "DELETE_CONFIG": {
      const configs = state.configs.filter((config) => config.id !== action.configId)
      const activeConfigId = state.activeConfigId === action.configId ? configs[0]?.id ?? "" : state.activeConfigId
      persist(configs, activeConfigId)
      return { ...state, configs, activeConfigId, testMessage: "", testStatus: "idle" }
    }
    case "SET_ACTIVE":
      persist(state.configs, action.configId)
      return { ...state, activeConfigId: action.configId, testMessage: "", testStatus: "idle" }
    case "TEST_START":
      return { ...state, isTesting: true, testMessage: "", testStatus: "idle" }
    case "TEST_SUCCESS":
      return { ...state, isTesting: false, testMessage: action.message, testStatus: "success" }
    case "TEST_ERROR":
      return { ...state, isTesting: false, testMessage: action.message, testStatus: "error" }
    case "CLEAR_TEST":
      return { ...state, testMessage: "", testStatus: "idle" }
    default:
      return state
  }
}

export function ApiConfigProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, undefined, initialState)

  const activeConfig = useMemo(() => {
    return state.configs.find((config) => config.id === state.activeConfigId)
  }, [state.configs, state.activeConfigId])

  const availableModels = useMemo(() => {
    if (!activeConfig) return []
    return buildModelOptions(activeConfig.modelIds, {
      apiBaseUrl: activeConfig.apiBaseUrl,
      interfaceFormat: activeConfig.interfaceFormat,
    })
  }, [activeConfig])

  const activeModel = useMemo(() => {
    if (!activeConfig) return undefined
    return availableModels.find((model) => model.id === activeConfig.selectedModelId) ?? availableModels[0]
  }, [activeConfig, availableModels])

  const hasRunnableConfig = Boolean(
    activeConfig?.apiBaseUrl.trim() &&
    activeConfig?.apiKey.trim() &&
    activeModel,
  )

  const upsertConfig = useCallback((draft: ApiConfigDraft, existingId?: string) => {
    const existing = existingId
      ? state.configs.find((config) => config.id === existingId)
      : undefined
    const config = buildConfigFromDraft(draft, existing)
    dispatch({ type: "UPSERT_CONFIG", config })
    return config
  }, [state.configs])

  const deleteConfig = useCallback((configId: string) => {
    dispatch({ type: "DELETE_CONFIG", configId })
  }, [])

  const selectConfig = useCallback((configId: string) => {
    dispatch({ type: "SET_ACTIVE", configId })
  }, [])

  const selectModel = useCallback((modelId: string) => {
    if (!activeConfig || !activeConfig.modelIds.includes(modelId)) return
    dispatch({ type: "UPSERT_CONFIG", config: { ...activeConfig, selectedModelId: modelId, updatedAt: Date.now() } })
  }, [activeConfig])

  const testConfig = useCallback(async (config?: ApiConfiguration) => {
    const targetConfig = config ?? activeConfig
    if (!targetConfig) {
      dispatch({ type: "TEST_ERROR", message: "请先保存 API 配置。" })
      return false
    }

    dispatch({ type: "TEST_START" })
    try {
      await runConnectivityTest(targetConfig)
      dispatch({ type: "TEST_SUCCESS", message: "连通性测试通过。" })
      return true
    } catch (error: unknown) {
      dispatch({ type: "TEST_ERROR", message: error instanceof Error ? error.message : "连通性测试失败。" })
      return false
    }
  }, [activeConfig])

  const clearTest = useCallback(() => dispatch({ type: "CLEAR_TEST" }), [])

  const value = useMemo(() => ({
    state,
    activeConfig,
    activeModel,
    availableModels,
    hasRunnableConfig,
    upsertConfig,
    deleteConfig,
    selectConfig,
    selectModel,
    testConfig,
    clearTest,
  }), [state, activeConfig, activeModel, availableModels, hasRunnableConfig, upsertConfig, deleteConfig, selectConfig, selectModel, testConfig, clearTest])

  return <ApiConfigContext.Provider value={value}>{children}</ApiConfigContext.Provider>
}

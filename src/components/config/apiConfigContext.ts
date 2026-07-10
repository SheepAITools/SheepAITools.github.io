import { createContext } from "react"
import type { ApiConfigDraft } from "@/lib/configStore"
import type { ApiConfiguration, ModelDefinition } from "@/types/sheepai"

export interface ApiConfigState {
  configs: ApiConfiguration[]
  activeConfigId: string
  isTesting: boolean
  testMessage: string
  testStatus: "idle" | "success" | "error"
}

export interface ApiConfigContextValue {
  state: ApiConfigState
  activeConfig: ApiConfiguration | undefined
  activeModel: ModelDefinition | undefined
  availableModels: ModelDefinition[]
  hasRunnableConfig: boolean
  upsertConfig: (draft: ApiConfigDraft, existingId?: string) => ApiConfiguration
  deleteConfig: (configId: string) => void
  selectConfig: (configId: string) => void
  selectModel: (modelId: string) => void
  testConfig: (config?: ApiConfiguration) => Promise<boolean>
  clearTest: () => void
}

export const ApiConfigContext = createContext<ApiConfigContextValue | null>(null)

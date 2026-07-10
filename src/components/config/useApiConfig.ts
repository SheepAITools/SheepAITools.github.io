import { useContext } from "react"
import { ApiConfigContext } from "@/components/config/apiConfigContext"
import type { ApiConfigContextValue } from "@/components/config/apiConfigContext"

export function useApiConfig(): ApiConfigContextValue {
  const ctx = useContext(ApiConfigContext)
  if (!ctx) throw new Error("useApiConfig must be used within ApiConfigProvider")
  return ctx
}

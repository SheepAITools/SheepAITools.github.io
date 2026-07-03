export function formatNullableText(value: string): string {
  return value.trim().length > 0 ? value : "未返回"
}

export function maskSecret(value: string): string {
  const trimmed = value.trim()
  if (trimmed.length === 0) return "未返回明文"
  if (trimmed.length <= 12) return `${trimmed.slice(0, 3)}••••`
  return `${trimmed.slice(0, 6)}••••${trimmed.slice(-4)}`
}

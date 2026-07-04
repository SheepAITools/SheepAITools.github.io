/** SheepAI quota → USD conversion: 500,000 units = $1 */
const QUOTA_UNITS_PER_DOLLAR = 500_000

export function quotaToUsd(quota: number): number {
  return quota / QUOTA_UNITS_PER_DOLLAR
}

export function formatUsd(amount: number): string {
  return `$${amount.toFixed(2)}`
}

export function formatQuotaAsUsd(quota: number): string {
  return formatUsd(quotaToUsd(quota))
}

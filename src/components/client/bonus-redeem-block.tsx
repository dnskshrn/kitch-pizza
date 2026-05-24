'use client'

import { useAuthStore } from '@/lib/store/auth-store'
import { useLanguage } from '@/lib/store/language-store'
import { useEffect, useState } from 'react'

interface Props {
  orderTotalBani: number
  onRedeemChange: (points: number) => void
}

export default function BonusRedeemBlock({ orderTotalBani, onRedeemChange }: Props) {
  const { t } = useLanguage()
  const profileId = useAuthStore((s) => s.profile?.id ?? null)

  const [balance, setBalance] = useState<number | null>(null)
  const [maxRate, setMaxRate] = useState(0.40)
  const [isEnabled, setIsEnabled] = useState(true)
  const [redeemValue, setRedeemValue] = useState(0)
  const [toggled, setToggled] = useState(false)

  useEffect(() => {
    if (!profileId) return

    // Fetch settings
    fetch('/api/bonus/settings', { credentials: 'include' })
      .then(r => r.json())
      .then(d => {
        setIsEnabled(d.isEnabled ?? true)
        setMaxRate(Number(d.maxRedemptionRate) || 0.40)
      })
      .catch(() => {})

    // Fetch balance
    fetch(`/api/bonus/balance?profileId=${profileId}`, { credentials: 'include' })
      .then(r => r.json())
      .then(d => setBalance(Number(d.balance) || 0))
      .catch(() => setBalance(0))
  }, [profileId])

  // Not ready yet
  if (profileId === null || balance === null) return null
  // Program disabled
  if (!isEnabled) return null
  // No balance
  if (balance <= 0) return null

  const maxRedeemable = Math.min(balance, Math.floor((orderTotalBani / 100) * maxRate))

  const handleToggle = () => {
    const next = !toggled
    setToggled(next)
    if (!next) {
      setRedeemValue(0)
      onRedeemChange(0)
    }
  }

  const handleSlider = (v: number) => {
    setRedeemValue(v)
    onRedeemChange(v)
  }

  return (
    <div style={{ marginTop: 16, padding: '12px 0', borderTop: '1px solid var(--color-border)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontSize: 14 }}>
          🎁 {t.bonus.balance}: <strong>{balance}</strong>
        </span>
        <button
          type="button"
          onClick={handleToggle}
          className={
            toggled
              ? 'cursor-pointer rounded-[20px] border border-[var(--color-accent)] bg-[var(--color-accent)] px-3 py-1 text-[13px] text-[var(--color-accent-text)]'
              : 'cursor-pointer rounded-[20px] border-0 bg-[#f2f2f2] px-3 py-1 text-[13px] text-[#242424]'
          }
        >
          {toggled ? t.bonus.cancel : t.bonus.redeem}
        </button>
      </div>

      {toggled && maxRedeemable > 0 && (
        <div style={{ marginTop: 10 }}>
          <input
            type="range"
            min={0}
            max={maxRedeemable}
            step={1}
            value={redeemValue}
            onChange={e => handleSlider(Number(e.target.value))}
            style={{ width: '100%' }}
          />
          <div style={{ fontSize: 12, color: 'var(--color-muted)', marginTop: 4 }}>
            {t.bonus.max}: {maxRedeemable}
          </div>
          <div style={{ fontSize: 13, color: 'var(--color-text)', fontWeight: 600, marginTop: 4 }}>
            {t.bonus.redeemSummary(redeemValue)}
          </div>
        </div>
      )}

      {toggled && maxRedeemable === 0 && (
        <div style={{ fontSize: 12, color: 'var(--color-muted)', marginTop: 6 }}>
          {t.bonus.redeemUnavailable}
        </div>
      )}
    </div>
  )
}

export { BonusRedeemBlock }

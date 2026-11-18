import { useEffect } from 'react'

export default function ConfirmModal({
  open,
  title,
  message,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  tone = 'danger',
  onConfirm,
  onClose,
}) {
  useEffect(() => {
    if (!open) return undefined

    const handleKeyDown = (event) => {
      if (event.key === 'Escape') onClose?.()
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [open, onClose])

  if (!open) return null

  const showCancelButton = cancelText !== null && cancelText !== undefined && cancelText !== ''

  const palette = {
    danger: {
      accent: '#ef4444',
      soft: 'rgba(239, 68, 68, 0.12)',
      border: 'rgba(239, 68, 68, 0.28)',
    },
    warning: {
      accent: '#f97316',
      soft: 'rgba(249, 115, 22, 0.12)',
      border: 'rgba(249, 115, 22, 0.28)',
    },
    info: {
      accent: '#3b82f6',
      soft: 'rgba(59, 130, 246, 0.12)',
      border: 'rgba(59, 130, 246, 0.28)',
    },
  }[tone] || {
    accent: '#f97316',
    soft: 'rgba(249, 115, 22, 0.12)',
    border: 'rgba(249, 115, 22, 0.28)',
  }

  return (
    <div
      role="presentation"
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 999,
        background: 'rgba(2, 6, 23, 0.7)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 20,
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="confirm-modal-title"
        onClick={(e) => e.stopPropagation()}
        style={{
          width: 420,
          maxWidth: '92vw',
          background: '#1f2937',
          border: `1px solid ${palette.border}`,
          borderRadius: 16,
          boxShadow: '0 24px 60px rgba(0, 0, 0, 0.7)',
          padding: 20,
        }}
      >
          <div style={{ marginBottom: 16 }}>
          <div id="confirm-modal-title" style={{ fontSize: 18, fontWeight: 800, color: '#ffffff' }}>{title}</div>
        </div>

        {message && (
          <div style={{ color: '#e5e7eb', fontSize: 14, lineHeight: 1.6, marginBottom: 18 }}>
            {message}
          </div>
        )}

        <div style={{ display: 'flex', justifyContent: showCancelButton ? 'flex-end' : 'center', gap: 10 }}>
          {showCancelButton && (
            <button
              type="button"
              onClick={onClose}
              style={{
                background: 'transparent',
                color: 'var(--text-muted)',
                border: '1px solid var(--border)',
                borderRadius: 8,
                padding: '9px 12px',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              {cancelText}
            </button>
          )}
          <button
            type="button"
            onClick={onConfirm}
            style={{
              background: palette.accent,
              color: '#fff',
              border: 'none',
              borderRadius: 8,
              padding: '9px 14px',
              fontWeight: 700,
              cursor: 'pointer',
              boxShadow: `0 10px 22px ${palette.soft}`,
            }}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  )
}

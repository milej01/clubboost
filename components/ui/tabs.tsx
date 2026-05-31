'use client'

import { createContext, useContext, useState } from 'react'
import { cn } from '@/lib/utils'

// ── Context ────────────────────────────────────────────────

interface TabsCtx {
  active:    string
  setActive: (v: string) => void
}
const Ctx = createContext<TabsCtx | null>(null)
function useTabs() {
  const c = useContext(Ctx)
  if (!c) throw new Error('Tab components must be used inside <Tabs>')
  return c
}

// ── Tabs root ──────────────────────────────────────────────

interface TabsProps {
  defaultValue: string
  children:     React.ReactNode
  className?:   string
}

export function Tabs({ defaultValue, children, className }: TabsProps) {
  const [active, setActive] = useState(defaultValue)
  return (
    <Ctx.Provider value={{ active, setActive }}>
      <div className={cn('space-y-4', className)}>{children}</div>
    </Ctx.Provider>
  )
}

// ── Tab list (navigation strip) ────────────────────────────

interface TabListProps {
  children:   React.ReactNode
  className?: string
  variant?:   'underline' | 'pills' | 'boxed'
}

const listVariant = {
  underline: 'flex gap-1 border-b border-slate-200',
  pills:     'flex gap-2 flex-wrap',
  boxed:     'inline-flex gap-1 rounded-xl bg-slate-100 p-1',
}

export function TabList({ children, className, variant = 'underline' }: TabListProps) {
  return (
    <div
      className={cn(listVariant[variant], className)}
      role="tablist"
    >
      {children}
    </div>
  )
}

// ── Tab trigger ────────────────────────────────────────────

interface TabTriggerProps {
  value:      string
  children:   React.ReactNode
  className?: string
  variant?:   'underline' | 'pills' | 'boxed'
  badge?:     string | number
}

export function TabTrigger({
  value,
  children,
  className,
  variant = 'underline',
  badge,
}: TabTriggerProps) {
  const { active, setActive } = useTabs()
  const isActive = active === value

  const base = 'inline-flex items-center gap-2 text-sm font-medium transition-all cursor-pointer select-none'

  const triggerVariant = {
    underline: cn(
      base, 'px-3 py-2.5 border-b-2 -mb-px',
      isActive
        ? 'border-primary-600 text-primary-700'
        : 'border-transparent text-slate-500 hover:text-slate-800 hover:border-slate-300',
    ),
    pills: cn(
      base, 'rounded-full px-4 py-1.5 border',
      isActive
        ? 'bg-primary-600 text-white border-primary-600'
        : 'bg-white text-slate-600 border-slate-200 hover:border-slate-400',
    ),
    boxed: cn(
      base, 'rounded-lg px-4 py-2',
      isActive
        ? 'bg-white text-slate-900 shadow-sm'
        : 'text-slate-500 hover:text-slate-700',
    ),
  }

  return (
    <button
      role="tab"
      aria-selected={isActive}
      onClick={() => setActive(value)}
      className={cn(triggerVariant[variant], className)}
    >
      {children}
      {badge !== undefined && (
        <span className={cn(
          'rounded-full px-1.5 py-0.5 text-xs tabular-nums',
          isActive ? 'bg-primary-100 text-primary-700' : 'bg-slate-100 text-slate-500',
        )}>
          {badge}
        </span>
      )}
    </button>
  )
}

// ── Tab content ────────────────────────────────────────────

interface TabContentProps {
  value:      string
  children:   React.ReactNode
  className?: string
}

export function TabContent({ value, children, className }: TabContentProps) {
  const { active } = useTabs()
  if (active !== value) return null
  return (
    <div
      role="tabpanel"
      className={cn('animate-fade-in', className)}
    >
      {children}
    </div>
  )
}

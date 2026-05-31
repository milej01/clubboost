'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { LayoutDashboard, Building2, Trophy, CreditCard, Banknote, Zap, Flag, ScrollText, Settings } from 'lucide-react'
import { cn } from '@/lib/utils'

const navItems = [
  { href: '/admin',                label: 'Overview',       icon: LayoutDashboard },
  { href: '/admin/clubs',          label: 'Clubs',          icon: Building2 },
  { href: '/admin/competitions',   label: 'Competitions',   icon: Trophy },
  { href: '/admin/payments',       label: 'Payments',       icon: CreditCard },
  { href: '/admin/payouts',        label: 'Payouts',        icon: Banknote },
  { href: '/admin/weekly-boost',   label: 'Weekly Boost',   icon: Zap },
  { href: '/admin/feature-flags',  label: 'Feature Flags',  icon: Flag },
  { href: '/admin/audit-log',      label: 'Audit Log',      icon: ScrollText },
  { href: '/admin/settings',       label: 'Settings',       icon: Settings },
]

export function AdminNav() {
  const pathname = usePathname()

  return (
    <nav className="space-y-1">
      {navItems.map(({ href, label, icon: Icon }) => {
        const active = href === '/admin' ? pathname === href : pathname.startsWith(href)
        return (
          <Link
            key={href}
            href={href}
            className={cn(
              'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
              active
                ? 'bg-primary-50 text-primary-700'
                : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
            )}
          >
            <Icon className="h-4 w-4 flex-shrink-0" />
            {label}
          </Link>
        )
      })}
    </nav>
  )
}

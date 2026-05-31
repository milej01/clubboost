'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { LayoutDashboard, Trophy, Settings, CreditCard, Link2, Zap } from 'lucide-react'
import { cn } from '@/lib/utils'

const navItems = [
  { href: '/dashboard',               label: 'Overview',      icon: LayoutDashboard },
  { href: '/dashboard/competitions',  label: 'Competitions',  icon: Trophy },
  { href: '/dashboard/payments',      label: 'Payments',      icon: CreditCard },
  { href: '/dashboard/club/settings', label: 'Club Settings', icon: Settings },
  { href: '/dashboard/stripe',        label: 'Stripe Setup',  icon: Link2 },
]

export function DashboardNav({ weeklyBoostEnabled }: { weeklyBoostEnabled?: boolean }) {
  const pathname = usePathname()

  const items = [
    ...navItems,
    ...(weeklyBoostEnabled ? [{ href: '/dashboard/weekly-boost', label: 'Weekly Boost', icon: Zap }] : []),
  ]

  return (
    <nav className="space-y-1">
      {items.map(({ href, label, icon: Icon }) => {
        const active = href === '/dashboard' ? pathname === href : pathname.startsWith(href)
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

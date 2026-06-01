'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Zap } from 'lucide-react'
import { cn } from '@/lib/utils'
import { MobileNav } from './mobile-nav'

interface NavLink {
  href:   string
  label:  string
  badge?: string
}

const navLinks: NavLink[] = [
  { href: '/#how-it-works',  label: 'How it works' },
  { href: '/weekly-boost',   label: 'Weekly Boost', badge: 'New' },
  { href: '/#pricing',       label: 'Pricing' },
  { href: '/help',           label: 'Help' },
]

interface SiteHeaderProps {
  isLoggedIn?: boolean
  /** Override the default CTA */
  cta?: { href: string; label: string }
  /** Transparent over hero sections */
  transparent?: boolean
}

export function SiteHeader({
  isLoggedIn = false,
  cta = { href: '/clubs/signup', label: 'Register your club' },
  transparent = false,
}: SiteHeaderProps) {
  const pathname = usePathname()

  return (
    <header
      className={cn(
        'sticky top-0 z-30 w-full transition-colors duration-300',
        transparent
          ? 'bg-transparent'
          : 'bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/80 border-b border-slate-100 shadow-sm',
      )}
    >
      <div className="mx-auto flex max-w-page items-center justify-between px-4 py-3 sm:px-6">

        {/* Logo */}
        <Link href="/" className="flex items-center gap-2.5 flex-shrink-0 group" aria-label="ClubBoost home">
          <div className="h-8 w-8 rounded-xl bg-primary-600 flex items-center justify-center shadow-sm group-hover:bg-primary-700 transition-colors">
            <Zap className="h-4 w-4 text-white" />
          </div>
          <span className="text-xl font-bold text-slate-900 tracking-tight">
            Club<span className="text-primary-600">Boost</span>
          </span>
        </Link>

        {/* Desktop nav */}
        <nav className="hidden md:flex items-center gap-1" aria-label="Main navigation">
          {navLinks.map(({ href, label, badge }) => {
            const isActive = pathname === href || (href !== '/' && pathname.startsWith(href))
            return (
              <Link
                key={href}
                href={href}
                className={cn(
                  'relative flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors',
                  isActive
                    ? 'text-primary-700 bg-primary-50'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50',
                )}
              >
                {label}
                {badge && (
                  <span className="rounded-full bg-boost-100 px-1.5 py-0.5 text-xs font-semibold text-boost-700 leading-none">
                    {badge}
                  </span>
                )}
              </Link>
            )
          })}
        </nav>

        {/* Desktop actions */}
        <div className="hidden md:flex items-center gap-3">
          {isLoggedIn ? (
            <Link
              href="/dashboard"
              className="rounded-xl bg-primary-600 px-4 py-2 text-sm font-semibold text-white hover:bg-primary-700 transition-colors shadow-sm"
            >
              My dashboard
            </Link>
          ) : (
            <>
              <Link
                href="/login"
                className="text-sm font-medium text-slate-600 hover:text-slate-900 transition-colors"
              >
                Sign in
              </Link>
              <Link
                href={cta.href}
                className="rounded-xl bg-primary-600 px-4 py-2 text-sm font-semibold text-white hover:bg-primary-700 transition-colors shadow-sm"
              >
                {cta.label}
              </Link>
            </>
          )}
        </div>

        {/* Mobile nav trigger */}
        <MobileNav
          items={navLinks}
          cta={cta}
          isLoggedIn={isLoggedIn}
        />

      </div>
    </header>
  )
}

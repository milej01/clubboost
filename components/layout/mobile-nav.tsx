'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Menu, X, Zap } from 'lucide-react'
import { cn } from '@/lib/utils'

interface NavItem {
  href:     string
  label:    string
  badge?:   string
}

interface MobileNavProps {
  items:    NavItem[]
  cta?:     { href: string; label: string }
  isLoggedIn?: boolean
}

export function MobileNav({ items, cta, isLoggedIn }: MobileNavProps) {
  const [open, setOpen] = useState(false)
  const pathname = usePathname()

  // Close on route change
  useEffect(() => { setOpen(false) }, [pathname])

  // Lock body scroll when open
  useEffect(() => {
    if (open) document.body.style.overflow = 'hidden'
    else       document.body.style.overflow = ''
    return () => { document.body.style.overflow = '' }
  }, [open])

  return (
    <>
      {/* Hamburger trigger */}
      <button
        aria-label={open ? 'Close menu' : 'Open menu'}
        aria-expanded={open}
        onClick={() => setOpen(v => !v)}
        className="rounded-lg p-2 text-slate-600 hover:bg-slate-100 transition-colors md:hidden"
      >
        {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
      </button>

      {/* Backdrop */}
      {open && (
        <div
          className="fixed inset-0 z-40 bg-black/20 backdrop-blur-sm md:hidden"
          onClick={() => setOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* Drawer */}
      <div
        className={cn(
          'fixed inset-y-0 right-0 z-50 w-72 max-w-full bg-white shadow-xl transition-transform duration-300 ease-out md:hidden',
          'flex flex-col',
          open ? 'translate-x-0' : 'translate-x-full',
        )}
        aria-label="Mobile navigation"
      >
        {/* Drawer header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <div className="h-7 w-7 rounded-lg bg-primary-600 flex items-center justify-center">
              <Zap className="h-4 w-4 text-white" />
            </div>
            <span className="font-bold text-slate-900">ClubBoost</span>
          </div>
          <button
            onClick={() => setOpen(false)}
            className="rounded-lg p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100"
            aria-label="Close menu"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Nav items */}
        <nav className="flex-1 overflow-y-auto py-4 px-3">
          {items.map(({ href, label, badge }) => {
            const isActive = pathname === href || (href !== '/' && pathname.startsWith(href))
            return (
              <Link
                key={href}
                href={href}
                className={cn(
                  'flex items-center justify-between rounded-xl px-4 py-3 text-sm font-medium transition-colors mb-1',
                  isActive
                    ? 'bg-primary-50 text-primary-700'
                    : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900',
                )}
              >
                {label}
                {badge && (
                  <span className="rounded-full bg-boost-100 px-2 py-0.5 text-xs font-semibold text-boost-700">
                    {badge}
                  </span>
                )}
              </Link>
            )
          })}
        </nav>

        {/* Footer actions */}
        <div className="border-t border-slate-100 p-4 space-y-3">
          {isLoggedIn ? (
            <Link
              href="/dashboard"
              className="block w-full text-center rounded-xl bg-primary-600 py-3 text-sm font-semibold text-white hover:bg-primary-700 transition-colors"
            >
              Go to dashboard
            </Link>
          ) : (
            <>
              <Link
                href="/login"
                className="block w-full text-center rounded-xl border border-slate-200 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors"
              >
                Sign in
              </Link>
              {cta && (
                <Link
                  href={cta.href}
                  className="block w-full text-center rounded-xl bg-primary-600 py-3 text-sm font-semibold text-white hover:bg-primary-700 transition-colors"
                >
                  {cta.label}
                </Link>
              )}
            </>
          )}
        </div>
      </div>
    </>
  )
}

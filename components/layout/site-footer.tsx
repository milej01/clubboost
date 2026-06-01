import Link from 'next/link'
import { Zap, Mail, Twitter, Instagram } from 'lucide-react'

const footerLinks = {
  Product: [
    { href: '/#how-it-works', label: 'How it works' },
    { href: '/weekly-boost',   label: 'Weekly Boost' },
    { href: '/#pricing',       label: 'Pricing & fees' },
    { href: '/clubs/signup',   label: 'Register your club' },
  ],
  Support: [
    { href: '/help',           label: 'Help centre' },
    { href: '/help',           label: 'Getting started' },
    { href: '/help',           label: 'Payments & payouts' },
    { href: 'mailto:hello@clubboost.co.uk', label: 'Contact us' },
  ],
  Legal: [
    { href: '/terms',          label: 'Terms of service' },
    { href: '/privacy',        label: 'Privacy policy' },
    { href: '/cookies',        label: 'Cookie policy' },
  ],
}

const socialLinks = [
  { href: 'https://twitter.com/clubboost', label: 'Twitter', Icon: Twitter },
  { href: 'https://instagram.com/clubboost', label: 'Instagram', Icon: Instagram },
  { href: 'mailto:hello@clubboost.co.uk', label: 'Email', Icon: Mail },
]

export function SiteFooter() {
  return (
    <footer className="border-t border-slate-100 bg-slate-50">
      {/* Main grid */}
      <div className="mx-auto max-w-page px-4 py-12 sm:px-6">
        <div className="grid grid-cols-2 gap-8 sm:grid-cols-3 lg:grid-cols-4">

          {/* Brand column */}
          <div className="col-span-2 sm:col-span-3 lg:col-span-1">
            <Link href="/" className="flex items-center gap-2 mb-4" aria-label="ClubBoost">
              <div className="h-8 w-8 rounded-xl bg-primary-600 flex items-center justify-center">
                <Zap className="h-4 w-4 text-white" />
              </div>
              <span className="text-lg font-bold text-slate-900">
                Club<span className="text-primary-600">Boost</span>
              </span>
            </Link>
            <p className="text-sm text-slate-500 leading-relaxed max-w-xs">
              Helping sports clubs raise more money through simple, fair fundraising competitions.
            </p>
            <div className="flex items-center gap-3 mt-5">
              {socialLinks.map(({ href, label, Icon }) => (
                <a
                  key={label}
                  href={href}
                  aria-label={label}
                  target={href.startsWith('http') ? '_blank' : undefined}
                  rel={href.startsWith('http') ? 'noopener noreferrer' : undefined}
                  className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:text-slate-700 hover:bg-white transition-colors border border-slate-200"
                >
                  <Icon className="h-4 w-4" />
                </a>
              ))}
            </div>
          </div>

          {/* Link columns */}
          {Object.entries(footerLinks).map(([category, links]) => (
            <div key={category}>
              <h3 className="text-xs font-semibold text-slate-900 uppercase tracking-wider mb-3">
                {category}
              </h3>
              <ul className="space-y-2">
                {links.map(({ href, label }) => (
                  <li key={href}>
                    <Link
                      href={href}
                      className="text-sm text-slate-500 hover:text-slate-900 transition-colors"
                    >
                      {label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>

      {/* Bottom bar */}
      <div className="border-t border-slate-200 bg-white">
        <div className="mx-auto max-w-page px-4 py-4 sm:px-6 flex flex-col sm:flex-row items-center justify-between gap-2">
          <p className="text-xs text-slate-400">
            © {new Date().getFullYear()} ClubBoost Ltd. Fundraising for grassroots sport.
          </p>
          <p className="text-xs text-slate-400">
            Payments powered by{' '}
            <a
              href="https://stripe.com"
              target="_blank"
              rel="noopener noreferrer"
              className="underline hover:text-slate-600 transition-colors"
            >
              Stripe
            </a>
          </p>
        </div>
      </div>
    </footer>
  )
}

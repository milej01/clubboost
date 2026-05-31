import Link from 'next/link'

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-50 to-slate-100 flex flex-col items-center justify-center p-4">
      <Link href="/" className="mb-8 flex items-center gap-2">
        <div className="h-8 w-8 rounded-lg bg-primary-600 flex items-center justify-center">
          <span className="text-white font-bold text-sm">CB</span>
        </div>
        <span className="text-xl font-bold text-slate-900">ClubBoost</span>
      </Link>
      <div className="w-full max-w-md">
        {children}
      </div>
      <p className="mt-8 text-xs text-slate-400">
        Grassroots fundraising, done simply.
      </p>
    </div>
  )
}

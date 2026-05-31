import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Register your club',
  description: 'Register your grassroots club on ClubBoost and start fundraising in minutes. Free to set up, no monthly subscription.',
}

export default function SignupLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}

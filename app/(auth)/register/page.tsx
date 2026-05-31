'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { FormField } from '@/components/ui/label'
import { Alert } from '@/components/ui/alert'
import { registerAction } from '@/actions/auth'

export default function RegisterPage() {
  const [error, setError]          = useState<string | null>(null)
  const [success, setSuccess]      = useState(false)
  const [pending, startTransition] = useTransition()
  const router       = useRouter()
  const searchParams = useSearchParams()
  const next         = searchParams.get('next') ?? '/dashboard'

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    const formData = new FormData(e.currentTarget)

    startTransition(async () => {
      const result = await registerAction(formData)
      if (!result.success) { setError(result.error); return }
      setSuccess(true)
    })
  }

  if (success) {
    return (
      <Card>
        <CardContent className="py-10 text-center">
          <p className="text-2xl mb-2">📬</p>
          <h2 className="text-lg font-semibold text-slate-900 mb-2">Check your email</h2>
          <p className="text-sm text-slate-500">
            We&apos;ve sent you a confirmation email. Click the link to activate your account.
          </p>
          <Link href="/login" className="mt-4 inline-block text-sm text-primary-600 hover:underline">
            Back to sign in
          </Link>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Create your account</CardTitle>
        <p className="text-sm text-slate-500 mt-1">Join ClubBoost — free for supporters</p>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <FormField label="Your name" htmlFor="display_name">
            <Input id="display_name" name="display_name" type="text" autoComplete="name" required placeholder="Jane Smith" />
          </FormField>
          <FormField label="Email" htmlFor="email">
            <Input id="email" name="email" type="email" autoComplete="email" required placeholder="you@example.com" />
          </FormField>
          <FormField label="Password" htmlFor="password" hint="At least 8 characters">
            <Input id="password" name="password" type="password" autoComplete="new-password" required placeholder="••••••••" minLength={8} />
          </FormField>

          {error && <Alert variant="error">{error}</Alert>}

          <Button type="submit" loading={pending} className="w-full" size="lg">
            Create account
          </Button>

          <p className="text-xs text-center text-slate-400">
            By registering you agree to ClubBoost&apos;s Terms of Service and Privacy Policy.
          </p>
        </form>

        <p className="mt-4 text-center text-sm text-slate-500">
          Already have an account?{' '}
          <Link href={`/login${next !== '/dashboard' ? `?next=${next}` : ''}`} className="font-medium text-primary-600 hover:underline">
            Sign in
          </Link>
        </p>
      </CardContent>
    </Card>
  )
}

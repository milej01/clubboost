'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { FormField } from '@/components/ui/label'
import { Alert } from '@/components/ui/alert'
import { loginAction } from '@/actions/auth'

export default function LoginPage() {
  const [error, setError]       = useState<string | null>(null)
  const [pending, startTransition] = useTransition()
  const router       = useRouter()
  const searchParams = useSearchParams()
  const next         = searchParams.get('next') ?? '/dashboard'

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    const formData = new FormData(e.currentTarget)

    startTransition(async () => {
      const result = await loginAction(formData)
      if (!result.success) { setError(result.error); return }
      router.push(next)
    })
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Sign in to ClubBoost</CardTitle>
        <p className="text-sm text-slate-500 mt-1">Welcome back</p>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <FormField label="Email" htmlFor="email">
            <Input id="email" name="email" type="email" autoComplete="email" required placeholder="you@example.com" />
          </FormField>
          <FormField label="Password" htmlFor="password">
            <Input id="password" name="password" type="password" autoComplete="current-password" required placeholder="••••••••" />
          </FormField>

          {error && <Alert variant="error">{error}</Alert>}

          <Button type="submit" loading={pending} className="w-full" size="lg">
            Sign in
          </Button>
        </form>

        <p className="mt-4 text-center text-sm text-slate-500">
          Don&apos;t have an account?{' '}
          <Link href="/register" className="font-medium text-primary-600 hover:underline">
            Create one
          </Link>
        </p>
      </CardContent>
    </Card>
  )
}

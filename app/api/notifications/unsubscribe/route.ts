// GET /api/notifications/unsubscribe?token=<token>
//
// One-click unsubscribe for marketing emails.
// Renders a simple confirmation page — no login required.
// Returns HTML so it works directly from email clients.

import { NextRequest, NextResponse } from 'next/server'
import { unsubscribeByToken } from '@/lib/services/notifications'

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://clubboost.co.uk'

function html(content: string): NextResponse {
  return new NextResponse(
    `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>Unsubscribe — ClubBoost</title>
  <style>
    * { box-sizing: border-box; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
           background: #f1f5f9; margin: 0; padding: 32px 16px; }
    .card { background: #fff; border-radius: 16px; border: 1px solid #e2e8f0;
            max-width: 480px; margin: 40px auto; padding: 40px 32px; text-align: center; }
    h1 { font-size: 22px; color: #0f172a; margin: 0 0 12px; }
    p  { font-size: 15px; color: #475569; line-height: 1.6; margin: 0 0 16px; }
    a  { color: #7c3aed; }
    .logo { font-size: 18px; font-weight: 700; color: #7c3aed; margin-bottom: 24px;
            display: block; text-decoration: none; }
  </style>
</head>
<body>
  <div class="card">
    <a href="${BASE_URL}" class="logo">⚡ ClubBoost</a>
    ${content}
  </div>
</body>
</html>`,
    { headers: { 'Content-Type': 'text/html; charset=utf-8' } },
  )
}

export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get('token')

  if (!token) {
    return html(`
      <h1>Invalid link</h1>
      <p>This unsubscribe link is not valid. If you'd like to update your email preferences,
         please <a href="${BASE_URL}/my/dashboard">log in to your account</a>.</p>
    `)
  }

  const { email, category, error } = await unsubscribeByToken(token)

  if (error) {
    return html(`
      <h1>Oops</h1>
      <p>${error}</p>
      <p>If you need help, <a href="mailto:hello@clubboost.co.uk">contact us</a>.</p>
    `)
  }

  return html(`
    <h1>✅ You've been unsubscribed</h1>
    <p>We've removed <strong>${email}</strong> from <strong>${category}</strong> emails.</p>
    <p>You'll still receive important emails about your account (like payment receipts and entry confirmations) — we only unsubscribed you from promotional messages.</p>
    <p style="margin-top:24px;">
      <a href="${BASE_URL}">Back to ClubBoost</a>
    </p>
  `)
}

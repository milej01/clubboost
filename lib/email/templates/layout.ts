// ============================================================
// Email layout & shared component primitives
//
// All emails use table-based HTML with inline styles for
// maximum compatibility across email clients (Outlook, Gmail,
// Apple Mail, etc.).
//
// Design tokens:
//   primary  #7c3aed  purple
//   bg       #f1f5f9  slate-100
//   card     #ffffff
//   border   #e2e8f0
//   text     #0f172a  slate-900
//   muted    #475569  slate-600
//   subtle   #94a3b8  slate-400
//   success  #16a34a  green-600
//   warning  #d97706  amber-600
// ============================================================

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://clubboost.co.uk'

// ── Layout wrapper ────────────────────────────────────────────

export interface LayoutOptions {
  subject:        string
  preheader:      string
  content:        string
  unsubscribeUrl?: string   // if set → marketing footer with unsubscribe link
}

export function layout({ subject, preheader, content, unsubscribeUrl }: LayoutOptions): string {
  const footer = unsubscribeUrl ? marketingFooter(unsubscribeUrl) : transactionalFooter()

  return `<!DOCTYPE html>
<html lang="en" xmlns="http://www.w3.org/1999/xhtml">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <meta name="x-apple-disable-message-reformatting">
  <meta http-equiv="Content-Type" content="text/html; charset=UTF-8">
  <title>${esc(subject)}</title>
  <!--[if mso]>
  <noscript><xml><o:OfficeDocumentSettings>
    <o:PixelsPerInch>96</o:PixelsPerInch>
  </o:OfficeDocumentSettings></xml></noscript>
  <![endif]-->
</head>
<body style="margin:0;padding:0;background-color:#f1f5f9;-webkit-text-size-adjust:100%;">
  <!-- Hidden preheader text -->
  <div style="display:none;max-height:0;overflow:hidden;mso-hide:all;">${esc(preheader)}&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;</div>

  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"
    style="background-color:#f1f5f9;border-collapse:collapse;">
    <tr>
      <td align="center" style="padding:32px 16px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"
          style="max-width:600px;width:100%;border-collapse:collapse;">

          <!-- ── Logo bar ── -->
          <tr>
            <td style="background-color:#7c3aed;border-radius:16px 16px 0 0;padding:20px 32px;">
              <a href="${BASE_URL}" style="text-decoration:none;">
                <span style="color:#ffffff;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;font-size:20px;font-weight:700;letter-spacing:-0.5px;">⚡ ClubBoost</span>
              </a>
            </td>
          </tr>

          <!-- ── Content card ── -->
          <tr>
            <td style="background-color:#ffffff;padding:40px 32px;border-left:1px solid #e2e8f0;border-right:1px solid #e2e8f0;">
              ${content}
            </td>
          </tr>

          <!-- ── Footer ── -->
          <tr>
            <td style="background-color:#f8fafc;border:1px solid #e2e8f0;border-top:none;border-radius:0 0 16px 16px;padding:24px 32px;">
              ${footer}
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`
}

function transactionalFooter(): string {
  return `<p style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;font-size:13px;color:#94a3b8;margin:0 0 8px;">
    ClubBoost — fundraising for grassroots sport
  </p>
  <p style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;font-size:13px;color:#94a3b8;margin:0;">
    This is a transactional email about your account. You cannot unsubscribe from these.
    &nbsp;·&nbsp;
    <a href="${BASE_URL}/privacy" style="color:#94a3b8;text-decoration:underline;">Privacy Policy</a>
  </p>`
}

function marketingFooter(unsubscribeUrl: string): string {
  return `<p style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;font-size:13px;color:#94a3b8;margin:0 0 8px;">
    ClubBoost — fundraising for grassroots sport
  </p>
  <p style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;font-size:13px;color:#94a3b8;margin:0;">
    <a href="${unsubscribeUrl}" style="color:#94a3b8;text-decoration:underline;">Unsubscribe</a>
    &nbsp;·&nbsp;
    <a href="${BASE_URL}/privacy" style="color:#94a3b8;text-decoration:underline;">Privacy Policy</a>
  </p>`
}

// ── Component primitives ──────────────────────────────────────

/** Escape HTML entities to prevent injection. */
export function esc(s: string | null | undefined): string {
  return (s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

export function h1(text: string): string {
  return `<h1 style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;font-size:24px;font-weight:700;color:#0f172a;margin:0 0 12px;letter-spacing:-0.5px;">${esc(text)}</h1>`
}

export function h2(text: string): string {
  return `<h2 style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;font-size:18px;font-weight:600;color:#0f172a;margin:24px 0 8px;">${esc(text)}</h2>`
}

export function p(html: string, opts: { colour?: string; size?: string; mb?: string } = {}): string {
  const colour = opts.colour ?? '#475569'
  const size   = opts.size   ?? '16px'
  const mb     = opts.mb     ?? '16px'
  return `<p style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;font-size:${size};line-height:1.65;color:${colour};margin:0 0 ${mb};">${html}</p>`
}

export function button(text: string, href: string, colour = '#7c3aed'): string {
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:24px 0 8px;">
    <tr>
      <td style="background-color:${colour};border-radius:10px;padding:0;">
        <a href="${href}" style="display:inline-block;padding:14px 28px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;font-size:15px;font-weight:600;color:#ffffff;text-decoration:none;border-radius:10px;">${esc(text)}</a>
      </td>
    </tr>
  </table>`
}

export function divider(): string {
  return `<hr style="border:none;border-top:1px solid #f1f5f9;margin:28px 0;">`
}

export function infoBox(html: string, style: 'default' | 'success' | 'warning' | 'danger' = 'default'): string {
  const styles = {
    default: { bg: '#f5f3ff', border: '#ddd6fe', text: '#475569' },
    success: { bg: '#f0fdf4', border: '#bbf7d0', text: '#166534' },
    warning: { bg: '#fffbeb', border: '#fde68a', text: '#92400e' },
    danger:  { bg: '#fef2f2', border: '#fecaca', text: '#991b1b' },
  }
  const s = styles[style]
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"
    style="background-color:${s.bg};border:1px solid ${s.border};border-radius:12px;margin:16px 0;">
    <tr>
      <td style="padding:16px 20px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;font-size:14px;line-height:1.65;color:${s.text};">
        ${html}
      </td>
    </tr>
  </table>`
}

export function kv(label: string, value: string): string {
  return `<tr>
    <td style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;font-size:14px;color:#94a3b8;padding:6px 0 6px;width:44%;vertical-align:top;">${esc(label)}</td>
    <td style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;font-size:14px;color:#0f172a;font-weight:500;padding:6px 0 6px;">${esc(value)}</td>
  </tr>`
}

export function kvTable(rows: Array<[string, string]>): string {
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"
    style="border-top:1px solid #f1f5f9;border-bottom:1px solid #f1f5f9;margin:16px 0;">
    ${rows.map(([l, v]) => kv(l, v)).join('')}
  </table>`
}

export function badge(text: string, colour = '#7c3aed'): string {
  return `<span style="display:inline-block;background-color:${colour}1a;border:1px solid ${colour}33;border-radius:6px;padding:3px 10px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;font-size:12px;font-weight:600;color:${colour};">${esc(text)}</span>`
}

// ── Plain-text helper ─────────────────────────────────────────

/** Generate a simple plain-text version from a list of paragraphs. */
export function plainText(lines: string[]): string {
  return lines.join('\n\n')
}

// ── URL builder ───────────────────────────────────────────────

export function url(path: string): string {
  return `${BASE_URL}${path}`
}

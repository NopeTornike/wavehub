// Transactional email bodies. Every message goes out as multipart text + HTML: a two-line
// text-only mail with a bare link is a classic spam signal, and Gmail placed the old
// verification mail in spam even with SPF/DKIM/DMARC passing. Georgian first (the site's
// language), English below. Every interpolated value is HTML-escaped — names are user input.

export interface RenderedEmail {
  text: string;
  html: string;
}

const BRAND = '#e5157f';

export function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
}

interface ActionEmail {
  name: string;
  // A one-time code shown above the button (email verification) — works even when the mail client
  // disables links, as Gmail does for anything in Spam.
  code?: { ka: string; en: string; value: string };
  ka: { heading: string; intro: string; button: string; expiry: string; ignore: string };
  en: { heading: string; intro: string; button: string; expiry: string; ignore: string };
  url: string;
}

function actionEmail({ name, ka, en, url, code }: ActionEmail): RenderedEmail {
  const safeName = escapeHtml(name);
  const safeUrl = escapeHtml(url);
  const text = [
    `გამარჯობა ${name},`,
    '',
    ka.intro,
    ...(code ? ['', `${code.ka}: ${code.value}`, ''] : []),
    url,
    '',
    ka.expiry,
    ka.ignore,
    '',
    '---',
    '',
    `Hi ${name},`,
    '',
    en.intro,
    ...(code ? ['', `${code.en}: ${code.value}`, ''] : []),
    url,
    '',
    en.expiry,
    en.ignore,
    '',
    'WaveHub — wavehubx.com',
  ].join('\n');

  const block = (lang: 'ka' | 'en', copy: ActionEmail['ka']) => `
      <tr><td style="padding:0 32px" lang="${lang}">
        <h1 style="margin:0 0 12px;font-size:22px;line-height:1.3;color:#15131f">${escapeHtml(copy.heading)}</h1>
        <p style="margin:0 0 8px;font-size:15px;line-height:1.6;color:#3b3748">${lang === 'ka' ? 'გამარჯობა' : 'Hi'} ${safeName},</p>
        <p style="margin:0 0 20px;font-size:15px;line-height:1.6;color:#3b3748">${escapeHtml(copy.intro)}</p>
        ${
          code
            ? `<p style="margin:0 0 6px;font-size:13px;color:#6b6778">${escapeHtml(lang === 'ka' ? code.ka : code.en)}</p>
        <p style="margin:0 0 20px;font-size:30px;font-weight:800;letter-spacing:8px;color:#15131f;font-family:'Courier New',monospace">${escapeHtml(code.value)}</p>`
            : ''
        }
        <table role="presentation" cellspacing="0" cellpadding="0" border="0"><tr><td style="border-radius:8px;background:${BRAND}">
          <a href="${safeUrl}" style="display:inline-block;padding:12px 24px;font-size:15px;font-weight:700;color:#ffffff;text-decoration:none;border-radius:8px">${escapeHtml(copy.button)}</a>
        </td></tr></table>
        <p style="margin:20px 0 4px;font-size:13px;line-height:1.5;color:#6b6778">${escapeHtml(copy.expiry)}</p>
        <p style="margin:0;font-size:13px;line-height:1.5;color:#6b6778">${escapeHtml(copy.ignore)}</p>
      </td></tr>`;

  const html = `<!DOCTYPE html>
<html lang="ka"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(en.heading)}</title></head>
<body style="margin:0;padding:0;background:#f4f3f7;font-family:Arial,Helvetica,sans-serif">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background:#f4f3f7;padding:24px 12px">
    <tr><td align="center">
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="max-width:560px;background:#ffffff;border-radius:12px;overflow:hidden">
        <tr><td style="padding:24px 32px;background:#0b0a18;font-size:20px;font-weight:800;letter-spacing:2px;color:#ffffff">WAVE<span style="color:${BRAND}">HUB</span>X</td></tr>
        <tr><td style="height:28px"></td></tr>
        ${block('ka', ka)}
        <tr><td style="padding:28px 32px"><hr style="border:0;border-top:1px solid #e6e4ec;margin:0"></td></tr>
        ${block('en', en)}
        <tr><td style="padding:28px 32px 8px;font-size:12px;line-height:1.5;color:#8a8696">
          ${escapeHtml('თუ ღილაკი არ მუშაობს, გახსენით ეს ბმული / If the button doesn\'t work, open this link:')}<br>
          <a href="${safeUrl}" style="color:${BRAND};word-break:break-all">${safeUrl}</a>
        </td></tr>
        <tr><td style="padding:16px 32px 24px;font-size:12px;color:#8a8696">WaveHub · <a href="https://wavehubx.com" style="color:#8a8696">wavehubx.com</a></td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;
  return { text, html };
}

export function verificationEmail(name: string, url: string, code?: string): RenderedEmail {
  return actionEmail({
    name,
    url,
    code: code ? { ka: 'ან შეიყვანეთ ეს კოდი საიტზე', en: 'Or enter this code on the site', value: code } : undefined,
    ka: {
      heading: 'დაადასტურეთ თქვენი ელფოსტა',
      intro: 'მადლობა, რომ დარეგისტრირდით WaveHub-ზე. ანგარიშის გასააქტიურებლად დაადასტურეთ ელფოსტა.',
      button: 'ელფოსტის დადასტურება',
      expiry: 'ბმული მოქმედებს 24 საათის განმავლობაში.',
      ignore: 'თუ ეს ანგარიში თქვენ არ შეგიქმნიათ, უბრალოდ უგულებელყავით ეს წერილი.',
    },
    en: {
      heading: 'Verify your email',
      intro: 'Thanks for signing up for WaveHub. Please confirm your email address to activate your account.',
      button: 'Verify email',
      expiry: 'This link expires in 24 hours.',
      ignore: "If you didn't create this account, you can safely ignore this email.",
    },
  });
}

export function passwordResetEmail(name: string, url: string): RenderedEmail {
  return actionEmail({
    name,
    url,
    ka: {
      heading: 'პაროლის აღდგენა',
      intro: 'მივიღეთ თქვენი WaveHub ანგარიშის პაროლის აღდგენის მოთხოვნა.',
      button: 'ახალი პაროლის დაყენება',
      expiry: 'ბმული მოქმედებს 1 საათის განმავლობაში.',
      ignore: 'თუ ეს თქვენ არ მოგითხოვიათ, უგულებელყავით წერილი — პაროლი არ შეიცვლება.',
    },
    en: {
      heading: 'Reset your password',
      intro: 'We received a request to reset the password for your WaveHub account.',
      button: 'Set a new password',
      expiry: 'This link expires in 1 hour.',
      ignore: "If you didn't request this, ignore this email — your password won't change.",
    },
  });
}

// Plain notification bodies (NotificationsService) get the same shell so every mail is multipart.
export function plainEmail(body: string): RenderedEmail {
  const paragraphs = body
    .split(/\n{2,}/)
    .map((p) => `<p style="margin:0 0 14px;font-size:15px;line-height:1.6;color:#3b3748">${escapeHtml(p).replace(/\n/g, '<br>')}</p>`)
    .join('');
  const html = `<!DOCTYPE html>
<html lang="ka"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f4f3f7;font-family:Arial,Helvetica,sans-serif">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background:#f4f3f7;padding:24px 12px"><tr><td align="center">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="max-width:560px;background:#ffffff;border-radius:12px;overflow:hidden">
      <tr><td style="padding:24px 32px;background:#0b0a18;font-size:20px;font-weight:800;letter-spacing:2px;color:#ffffff">WAVE<span style="color:${BRAND}">HUB</span>X</td></tr>
      <tr><td style="padding:28px 32px 12px">${paragraphs}</td></tr>
      <tr><td style="padding:8px 32px 24px;font-size:12px;color:#8a8696">WaveHub · <a href="https://wavehubx.com" style="color:#8a8696">wavehubx.com</a></td></tr>
    </table>
  </td></tr></table>
</body></html>`;
  return { text: `${body}\n\nWaveHub — wavehubx.com`, html };
}

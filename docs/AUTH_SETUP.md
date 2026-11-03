# Local authentication setup

Status: email/password signup, login, confirmation, resend, logout and protected pages are implemented. Live account tests require your Supabase configuration. No service-role key is required.

## Connect the project

1. In https://supabase.com/dashboard open `outfyt` and click **Connect**. Find the project URL. You can also find the URL under Project Settings > Data API, depending on dashboard layout.
2. In Project Settings > API Keys, copy the **Publishable key** (`sb_publishable_...`). Do not use a secret or service-role key.
3. In PowerShell in `C:\Users\sarahhuynh\Outfyt`, run `Copy-Item .env.example .env.local` only if `.env.local` does not already exist. Open `.env.local` in your editor and replace the URL and publishable-key placeholders. Set `NEXT_PUBLIC_APP_URL=http://localhost:3000`. Leave OpenAI and Pinterest settings empty for now. All three values used here are public configuration. Future OpenAI/Pinterest secrets stay server-only.
4. Stop the development server using Ctrl+C and restart with `npm run dev`.

## Supabase authentication settings

- Authentication > Sign In / Providers: enable Email, allow new signups and enable Confirm Email.
- Authentication > URL Configuration: Site URL `http://localhost:3000`; Redirect URLs `http://localhost:3000/auth/confirm` and `http://localhost:3000/auth/callback`.
- Authentication > Email Templates (or Email > Templates) > Confirm signup: set the confirmation link's `href` to `{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=email` and save. Example:

```html
<h2>Confirm your Outfyt account</h2>
<p><a href="{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&amp;type=email">Confirm email address</a></p>
```

This follows Supabase's SSR token-hash confirmation flow. The app also supports the default PKCE callback at `/auth/callback`, but that flow requires the signup browser's verifier cookie. The token-hash template supports opening email in another browser. The server accepts only email-confirmation tokens here and redirects to a fixed dashboard path.

Supabase's default email sender is restricted to organization team addresses and has a small rate limit. Use the email associated with your Supabase account for the initial test. Custom SMTP for other users can be configured in a separate setup stage. Do not disable confirmation to bypass a delivery issue.

## Manual tests

1. Open `/login`: no missing-configuration message; account forms are enabled.
2. Open `/dashboard`, `/closet`, `/stylist`, `/style-dna`, `/lookbook` and `/settings` in a signed-out private window: each redirects to `/login`.
3. Create an account with mismatched passwords: inline error, no account submitted.
4. Create an account with matching passwords (at least eight characters): confirmation instructions appear. In Supabase Authentication > Users, the new user exists. In Table Editor > profiles, its matching profile and display name exist.
5. Sign in before confirming: an email-confirmation message appears and the dashboard remains protected.
6. Click the confirmation email link while the app is running: dashboard opens. With the custom token-hash template, opening in another browser also works.
7. Refresh the dashboard and open a new tab in the same browser: the session persists.
8. Click Log out: login opens. Refresh or revisit a protected page: login remains required.
9. Sign in using an incorrect password: a clear error appears; no session is created. Sign in with the correct password: dashboard opens.
10. Open `/auth/confirm?token_hash=invalid&type=email`: login opens with an invalid/expired-link message. No redirect loop or crash occurs.

The dashboard uses empty foundation data; wardrobe operations, AI chat, style preferences and profile editing are not implemented in this authentication phase.

## Troubleshooting

- Missing configuration: check the `.env.local` filename and spelling, then restart Next.js. Never paste credentials into chat.
- Incorrect API key/project URL: ensure both come from the same project and that the key is publishable. The database password is not an API key.
- Email not authorized: use an organization team email for this test; other users need custom SMTP.
- Rate limit: wait before requesting another confirmation; repeated resends consume the project's email allowance.
- Invalid/expired confirmation link: use the most recently requested email, or sign in if already confirmed. Use the resend form if still unconfirmed.
- Database error saving new user: report the error text. The profile-creation trigger must have been created by the migration; inspect Supabase Auth logs without sharing tokens or passwords.

## Automated checks

Use Node.js 22.14+ for the test runner. Run `npm test`, `npm run typecheck`, and `npm run build`. Tests cover validation and sanitized error messages. They do not send real email or establish a Supabase session; the manual tests above cover those operations.

Official references:
- https://supabase.com/docs/guides/getting-started/api-keys
- https://supabase.com/docs/guides/getting-started/tutorials/with-nextjs
- https://supabase.com/docs/guides/auth/server-side/nextjs
- https://supabase.com/docs/guides/auth/auth-smtp

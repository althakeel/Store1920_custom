---
name: return-policy
description: Maintains the Store1920 public Return Policy page at /return-policy using the bilingual PAGE_COPY + PolicyPageLayout pattern. Use when editing return policy content, refunds, exchanges, return windows, or when the user mentions /return-policy, return policy page, or return/refund policy copy.
---

# Return Policy Page (`/return-policy`)

## Route & file

| Item | Value |
|------|--------|
| URL | `/return-policy` |
| Page | `app/(public)/return-policy/page.jsx` |
| Layout | `components/PolicyPageLayout.jsx` |
| Reference pattern | `app/(public)/shipping-policy/page.jsx` |

## Required structure

1. `'use client'` page component
2. `PAGE_COPY` object with **both** `en` and `ar` keys
3. `useStorefrontI18n()` → `isArabic` → pick `PAGE_COPY.ar` or `PAGE_COPY.en`
4. `PolicyPageLayout` with `dir={isArabic ? 'rtl' : undefined}`
5. Title (`text-3xl font-bold`), intro (`text-gray-600 mb-8`), sections in bordered card (`border border-gray-200 rounded-xl p-6`)

Each section in `PAGE_COPY`:

```javascript
{
  title: '1. Section title',
  paragraphs: ['Paragraph one', 'Paragraph two with support@Store1920.com'],
  bullets: ['Optional bullet'], // omit if none
}
```

Render sections by mapping `copy.sections` — same markup as shipping-policy.

## Content rules

- Keep legal/policy wording accurate; update **English and Arabic together**
- Contact emails used on this page: `Store192065@gmail.com`, `support@Store1920.com`
- Do **not** change return windows or eligibility unless the user explicitly requests it
- Other pages mention returns differently (FAQ/chatbot may say 7 days; this page says 3 days for damaged/incomplete) — align only when the user asks to sync copy site-wide

## Do not

- Remove bilingual support or hardcode English-only JSX in the page body
- Use a different layout width than `PolicyPageLayout` (`max-w-[1450px]`)
- Move return policy into the store dashboard (`/store/**`) — this is a public storefront page
- Add unrelated policy sections or redesign the card layout

## When editing

- [ ] `PAGE_COPY.en` and `PAGE_COPY.ar` updated in the same change
- [ ] Section numbering stays sequential
- [ ] Page still uses `PolicyPageLayout`
- [ ] Navbar/sitemap already link to `/return-policy` — no route rename unless requested

## Related references

- `app/(public)/refund-policy/page.jsx` — separate refund-focused page
- `app/(public)/faq/page.jsx` — FAQ return answers
- `app/api/chatbot/route.js` — chatbot return policy text
- `lib/sitemapData.js` — sitemap entry for `/return-policy`

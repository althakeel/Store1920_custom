---
name: store
description: Enforces English-only, LTR layout for the Store1920 seller dashboard under /store. Use when editing app/store pages, components/store, /api/store routes, or when the user mentions store dashboard language, RTL, Arabic, or seller admin UI.
---

# Store Dashboard (`/store`)

The seller dashboard is **always English LTR only**.

Storefront pages may be bilingual (English/Arabic) and RTL. The dashboard is a separate admin surface and must not follow storefront language settings.

## Rules

1. **Dashboard chrome = English only**
   - Sidebar, navbar, buttons, labels, toasts, empty states, errors, modals
   - Do not use `translateStaticText`, `storefrontLanguage`, or `readPersistedStorefrontLanguage` in `/store` UI

2. **Dashboard layout = LTR only**
   - Root wrapper: `lang="en"` and `dir="ltr"`
   - Do not inherit `<html lang="ar" dir="rtl">` from the public storefront
   - Prefer logical CSS (`ms-`, `me-`, `ps-`, `pe-`, `start`, `end`) over physical `ml-`/`mr-`/`pl-`/`pr-` when adding new styles

3. **Arabic product/content fields are allowed**
   - Fields like `nameAr`, `descriptionAr`, `brandAr` are **stored content**, not dashboard UI
   - Keep `dir="rtl"` only on those specific inputs/editors
   - Do not make the whole page or layout RTL for Arabic product fields

4. **API responses for dashboard**
   - Prefer English labels/messages in `/api/store/**` responses shown in the dashboard
   - Product/category Arabic fields may still be returned for editing; the dashboard UI around them stays English LTR

## Required implementation

`app/store/layout.jsx` must mount `StoreLanguageScope` so every `/store` route forces English LTR:

```jsx
import StoreLanguageScope from '@/components/store/StoreLanguageScope';

export default function RootAdminLayout({ children }) {
  return (
    <StoreLanguageScope>
      {/* existing auth / StoreLayout logic */}
    </StoreLanguageScope>
  );
}
```

`components/store/StoreLanguageScope.jsx`:
- On mount: set `document.documentElement` to `lang="en"` and `dir="ltr"`
- On unmount: restore previous `lang`/`dir` for the public storefront
- Wrap children in `<div lang="en" dir="ltr" className="min-h-screen">`

## When adding new `/store` pages

- [ ] All visible UI copy is English
- [ ] Page is rendered inside `StoreLanguageScope` (via `app/store/layout.jsx`)
- [ ] No `dir="rtl"` on page/layout wrappers
- [ ] No imports from storefront i18n helpers for dashboard labels
- [ ] Arabic inputs only use local `dir="rtl"` on the field itself

## Do not

- Add a language switcher to the store dashboard
- Reuse TopBar/Navbar storefront language state in `/store`
- Set `dir="rtl"` on `StoreLayout`, `StoreSidebar`, or `StoreNavbar`
- Localize dashboard permission labels to Arabic unless explicitly requested

## Scope

| Path | Language / direction |
|------|----------------------|
| `/store/**` | English, LTR |
| `/admin/**` | Follow existing admin conventions |
| Public storefront | Bilingual, may be RTL |

---
name: blogs
description: Maintains Store1920 blogs — public /blogs pages, seller dashboard /store/blogs, TipTap rich description (h1/h2/p, fonts, S3 images with drag-reorder), and blog APIs. Use when editing blogs, /blogs, /store/blogs, Blog model, or blog rich-text editor.
---

# Blogs (`/blogs` + `/store/blogs`)

## Surfaces

| Surface | Path | Language |
|---------|------|----------|
| Public list | `/blogs` | Bilingual storefront (en/ar) |
| Public post | `/blogs/[slug]` | Bilingual storefront |
| Seller list | `/store/blogs` | English LTR only (store skill) |
| Seller editor | `/store/blogs/new`, `/store/blogs/[blogId]` | English LTR only |

## Data & APIs

| Piece | Path |
|-------|------|
| Model | `models/Blog.js` |
| Helpers | `lib/blogHelpers.js` |
| Rich editor | `components/store/BlogRichTextEditor.jsx` |
| Seller API | `GET/POST /api/store/blogs`, `GET/PUT/DELETE /api/store/blogs/[blogId]` |
| Public API | `GET /api/public/blogs`, `GET /api/public/blogs/[slug]` |
| Image upload | `POST /api/store/upload-image` with `type=blog` → S3 folder `blogs` |

## Content rules

1. Cover + inline description images upload to **S3** (`type=blog`).
2. TipTap description: H1–H3, fonts, color, lists, links; images support **Full / ½ / ⅓** width and drag reorder (`data-width`).
3. Store dashboard English LTR; Arabic fields use local `dir="rtl"`.
4. Public list/detail: sidebar with recent posts; detail has **Previous / Next**; list has **search + sort** (`newest` default by `publishedAt`).
5. Editor has **publish date & time**; future dates stay hidden on the storefront until due.
6. Permission id: `blogs`.

## When editing blogs

- [ ] Public GETs stay allowlisted / under `/api/public/*` (no store Bearer)
- [ ] Seller mutations require seller Bearer
- [ ] Slug unique per store; regenerate carefully on title change only when slug was auto
- [ ] Sanitize HTML on save (`lib/blogHelpers.js`) — keep safe tags used by TipTap
- [ ] Do not break store LTR / English chrome

## Do not

- Put blog admin under public pages
- Convert transparent logo-style assets via JPEG in blog flow (reuse upload optimize that preserves alpha)
- Drop TipTap image drag / heading toolbar when “simplifying” the editor

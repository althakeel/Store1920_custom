'use client'

import Link from 'next/link'

export default function BlogSidebar({
  recentBlogs = [],
  currentSlug = '',
  isArabic = false,
  title,
}) {
  const heading = title
    || (isArabic ? 'أحدث المقالات' : 'Recent posts')

  return (
    <aside className="space-y-4 rounded-xl border border-gray-200 bg-white p-4">
      <h2 className="text-sm font-bold uppercase tracking-wide text-gray-900">
        {heading}
      </h2>
      {recentBlogs.length === 0 ? (
        <p className="text-xs text-gray-500">
          {isArabic ? 'لا توجد مقالات بعد.' : 'No posts yet.'}
        </p>
      ) : (
        <ul className="space-y-3">
          {recentBlogs.map((blog) => {
            const active = blog.slug === currentSlug
            return (
              <li key={blog.id || blog.slug}>
                <Link
                  href={`/blogs/${blog.slug}`}
                  className={`flex gap-3 rounded-lg p-2 transition ${
                    active ? 'bg-sky-50 ring-1 ring-sky-200' : 'hover:bg-slate-50'
                  }`}
                >
                  {blog.coverImage ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={blog.coverImage}
                      alt=""
                      className="h-14 w-16 shrink-0 rounded-md object-cover"
                    />
                  ) : (
                    <div className="flex h-14 w-16 shrink-0 items-center justify-center rounded-md bg-slate-100 text-[9px] text-slate-400">
                      Blog
                    </div>
                  )}
                  <div className="min-w-0">
                    <p className={`line-clamp-2 text-sm font-semibold ${active ? 'text-sky-800' : 'text-gray-900'}`}>
                      {blog.title}
                    </p>
                    {blog.publishedAt ? (
                      <p className="mt-1 text-[11px] text-gray-400">
                        {new Date(blog.publishedAt).toLocaleDateString(isArabic ? 'ar-AE' : 'en-AE')}
                      </p>
                    ) : null}
                  </div>
                </Link>
              </li>
            )
          })}
        </ul>
      )}
      <Link
        href="/blogs"
        className="inline-block text-xs font-semibold text-sky-700 hover:underline"
      >
        {isArabic ? 'عرض كل المقالات' : 'View all posts'}
      </Link>
    </aside>
  )
}

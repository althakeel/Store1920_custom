'use client';

import Link from 'next/link';

/** Routes too heavy for reliable Turbopack soft navigation — use full page load. */
const HARD_NAV_PREFIXES = [
  '/store/orders',
  '/store/manage-product',
  '/store/add-product',
  '/store/bulk-import',
];

export function shouldUseHardStoreNav(href) {
  const path = String(href || '').split('?')[0];
  return HARD_NAV_PREFIXES.some(
    (prefix) => path === prefix || path.startsWith(`${prefix}/`),
  );
}

export default function StoreNavLink({ href, children, prefetch = false, ...rest }) {
  if (shouldUseHardStoreNav(href)) {
    return (
      <a href={href} {...rest}>
        {children}
      </a>
    );
  }

  return (
    <Link href={href} prefetch={prefetch} {...rest}>
      {children}
    </Link>
  );
}

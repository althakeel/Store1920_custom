'use client';

import Link from 'next/link';

export default function ShipXpressBadge({
  href = '/fast-delivery',
  interactive = true,
}) {
  const button = (
    <span className="shipxpress-link">
      <span className="shipxpress-brand">ShipXpress</span>
    </span>
  );

  if (interactive) {
    return (
      <Link href={href} className="shipxpress-wrap shipxpress-link-anchor group shrink-0" aria-label="ShipXpress fast delivery">
        {button}
      </Link>
    );
  }

  return (
    <span className="shipxpress-wrap shipxpress-link-anchor pointer-events-none shrink-0">
      {button}
    </span>
  );
}

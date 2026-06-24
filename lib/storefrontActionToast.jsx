'use client';

import toast from 'react-hot-toast';
import StorefrontActionToast from '@/components/StorefrontActionToast';

export function showStorefrontActionToast({
  variant = 'cart',
  title,
  subtitle = '',
  actionLabel,
  actionHref,
  duration = 4500,
}) {
  toast.custom(
    (t) => (
      <StorefrontActionToast
        visible={t.visible}
        variant={variant}
        title={title}
        subtitle={subtitle}
        actionLabel={actionLabel}
        actionHref={actionHref}
        onDismiss={() => toast.dismiss(t.id)}
        duration={duration}
      />
    ),
    {
      duration,
      position: 'top-center',
    },
  );
}

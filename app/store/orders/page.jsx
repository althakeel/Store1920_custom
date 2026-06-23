'use client';

import dynamic from 'next/dynamic';
import PageSkeleton from '@/components/PageSkeleton';

const StoreOrdersClient = dynamic(
  () => import('@/components/store/StoreOrdersClient'),
  {
    ssr: false,
    loading: () => <PageSkeleton />,
  },
);

export default function StoreOrdersPage() {
  return <StoreOrdersClient />;
}

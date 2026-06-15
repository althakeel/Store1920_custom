'use client';

import BannerSlider from '@/components/BannerSlider';

export default function BannerSlider2({ config = null }) {
  return (
    <section className="w-full">
      <BannerSlider className="mt-6 mb-8" variant="secondary" config={config} />
    </section>
  );
}

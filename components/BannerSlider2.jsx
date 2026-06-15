'use client';

import BannerSlider from '@/components/BannerSlider';

export default function BannerSlider2({ config = null }) {
  return (
    <section className="w-full">
      <BannerSlider variant="secondary" config={config} />
    </section>
  );
}

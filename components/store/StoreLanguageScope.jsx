'use client';

import { useEffect } from 'react';

export default function StoreLanguageScope({ children }) {
  useEffect(() => {
    const root = document.documentElement;
    const previousLang = root.getAttribute('lang');
    const previousDir = root.getAttribute('dir');

    root.setAttribute('lang', 'en');
    root.setAttribute('dir', 'ltr');

    return () => {
      if (previousLang) {
        root.setAttribute('lang', previousLang);
      } else {
        root.removeAttribute('lang');
      }

      if (previousDir) {
        root.setAttribute('dir', previousDir);
      } else {
        root.removeAttribute('dir');
      }
    };
  }, []);

  return (
    <div lang="en" dir="ltr" className="min-h-screen">
      {children}
    </div>
  );
}

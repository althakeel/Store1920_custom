'use client'

import { useServerInsertedHTML } from 'next/navigation'
import { getStorefrontLanguageInitScript } from '@/lib/storefrontLanguage'

export default function StorefrontLanguageInitScript() {
  useServerInsertedHTML(() => (
    <script
      id="document-direction-init"
      dangerouslySetInnerHTML={{ __html: getStorefrontLanguageInitScript() }}
    />
  ))

  return null
}

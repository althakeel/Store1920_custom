import {
  STORE1920_CUSTOMER_SUPPORT_PHONE,
  STORE1920_CUSTOMER_SUPPORT_TEL,
  STORE1920_SUPPORT_EMAIL,
} from '@/lib/storeContact';

export default function PolicyContactBlock({ isArabic = false }) {
  if (isArabic) {
    return (
      <section className="border-t border-gray-200 pt-4">
        <h2 className="font-semibold text-gray-900 mb-2">معلومات التواصل</h2>
        <p className="text-gray-700 mb-1">
          <strong>البريد الإلكتروني:</strong>{' '}
          <a href={`mailto:${STORE1920_SUPPORT_EMAIL}`} className="text-orange-600 underline">
            {STORE1920_SUPPORT_EMAIL}
          </a>
        </p>
        <p className="text-gray-700">
          <strong>دعم العملاء:</strong>{' '}
          <a href={STORE1920_CUSTOMER_SUPPORT_TEL} className="text-orange-600 underline">
            {STORE1920_CUSTOMER_SUPPORT_PHONE}
          </a>
        </p>
      </section>
    );
  }

  return (
    <section className="border-t border-gray-200 pt-4">
      <h2 className="font-semibold text-gray-900 mb-2">Contact Information</h2>
      <p className="text-gray-700 mb-1">
        <strong>Email:</strong>{' '}
        <a href={`mailto:${STORE1920_SUPPORT_EMAIL}`} className="text-orange-600 underline">
          {STORE1920_SUPPORT_EMAIL}
        </a>
      </p>
      <p className="text-gray-700">
        <strong>Customer Support:</strong>{' '}
        <a href={STORE1920_CUSTOMER_SUPPORT_TEL} className="text-orange-600 underline">
          {STORE1920_CUSTOMER_SUPPORT_PHONE}
        </a>
      </p>
    </section>
  );
}

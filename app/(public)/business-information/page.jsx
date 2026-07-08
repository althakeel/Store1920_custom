'use client';

import Link from 'next/link';
import PolicyPageLayout from '@/components/PolicyPageLayout';
import { useStorefrontI18n } from '@/lib/useStorefrontI18n';
import { STORE1920_SUPPORT_EMAIL } from '@/lib/storeContact';

const PAGE_COPY = {
  en: {
    title: 'Business Information',
    intro:
      'Store1920.com is operated by a licensed UAE company. This page provides our official trade license and business identity details for customer transparency and Google Merchant Center compliance.',
    identityTitle: 'Business identity',
    identityText:
      'The online store Store1920 is owned and operated by ALTHAKEEL GENERAL TRADING L.L.C, a Limited Liability Company licensed by the Department of Economic Development in the United Arab Emirates.',
    licenseTitle: 'Trade license details',
    fields: [
      { label: 'Company Name', value: 'ALTHAKEEL GENERAL TRADING L.L.C' },
      { label: 'Company Name (Arabic)', value: 'الثقيل للتجارة العامة ش.ذ.م.م' },
      { label: 'Business Name', value: 'ALTHAKEEL GENERAL TRADING L.L.C' },
      { label: 'Business Name (Arabic)', value: 'الثقيل للتجارة العامة ش.ذ.م.م' },
      { label: 'Legal Type', value: 'Limited Liability Company (LLC)' },
      { label: 'License No.', value: '641210' },
      { label: 'Main License No.', value: '641210' },
      { label: 'Commercial Register No.', value: '1994147' },
      { label: 'DCCI Membership No.', value: '183989' },
      { label: 'License Category / Issuing Authority', value: 'Department of Economic Development (Dep. of Economic Development)' },
      { label: 'Issue Date', value: '21/06/2010' },
      { label: 'Expiry Date', value: '20/06/2027' },
    ],
    modelTitle: 'Business model',
    modelText:
      'We sell consumer products online through Store1920.com and deliver to customers across the UAE. Prices, policies, and contact details are published clearly on our website before purchase.',
    policiesTitle: 'Policies & customer support',
    policiesIntro: 'Please review our store policies and contact details:',
    policyLinks: [
      { text: 'Terms and Conditions', path: '/terms-and-conditions' },
      { text: 'Terms of Sale', path: '/terms-of-sale' },
      { text: 'Shipping Policy', path: '/shipping-policy' },
      { text: 'Return Policy', path: '/return-policy' },
      { text: 'Privacy Policy', path: '/privacy-policy' },
      { text: 'Contact Us', path: '/contact-us' },
      { text: 'About Us', path: '/about-us' },
    ],
    contactTitle: 'Contact',
    contactText: `For business verification or customer support, email ${STORE1920_SUPPORT_EMAIL}.`,
  },
  ar: {
    title: 'معلومات الأعمال',
    intro:
      'يتم تشغيل موقع Store1920.com من قبل شركة مرخصة في دولة الإمارات العربية المتحدة. تعرض هذه الصفحة تفاصيل الرخصة التجارية وهوية الشركة بشفافية للعملاء ولمتطلبات Google Merchant Center.',
    identityTitle: 'هوية النشاط التجاري',
    identityText:
      'المتجر الإلكتروني Store1920 مملوك ويُدار من قبل الثقيل للتجارة العامة ش.ذ.م.م، وهي شركة ذات مسؤولية محدودة مرخصة من دائرة التنمية الاقتصادية في دولة الإمارات العربية المتحدة.',
    licenseTitle: 'تفاصيل الرخصة التجارية',
    fields: [
      { label: 'اسم الشركة', value: 'ALTHAKEEL GENERAL TRADING L.L.C' },
      { label: 'اسم الشركة (عربي)', value: 'الثقيل للتجارة العامة ش.ذ.م.م' },
      { label: 'الاسم التجاري', value: 'ALTHAKEEL GENERAL TRADING L.L.C' },
      { label: 'الاسم التجاري (عربي)', value: 'الثقيل للتجارة العامة ش.ذ.م.م' },
      { label: 'الشكل القانوني', value: 'ذات مسؤولية محدودة (ش.ذ.م.م)' },
      { label: 'رقم الرخصة', value: '641210' },
      { label: 'رقم الرخصة الأم', value: '641210' },
      { label: 'رقم السجل التجاري', value: '1994147' },
      { label: 'عضوية الغرفة (DCCI)', value: '183989' },
      { label: 'فئة الرخصة / جهة الإصدار', value: 'دائرة التنمية الاقتصادية' },
      { label: 'تاريخ الإصدار', value: '21/06/2010' },
      { label: 'تاريخ الانتهاء', value: '20/06/2027' },
    ],
    modelTitle: 'نموذج العمل',
    modelText:
      'نبيع منتجات استهلاكية عبر الإنترنت من خلال Store1920.com ونقوم بالتوصيل داخل دولة الإمارات. الأسعار والسياسات وبيانات التواصل منشورة بوضوح على الموقع قبل الشراء.',
    policiesTitle: 'السياسات ودعم العملاء',
    policiesIntro: 'يرجى الاطلاع على سياسات المتجر وبيانات التواصل:',
    policyLinks: [
      { text: 'الشروط والأحكام', path: '/terms-and-conditions' },
      { text: 'شروط البيع', path: '/terms-of-sale' },
      { text: 'سياسة الشحن', path: '/shipping-policy' },
      { text: 'سياسة الإرجاع', path: '/return-policy' },
      { text: 'سياسة الخصوصية', path: '/privacy-policy' },
      { text: 'اتصل بنا', path: '/contact-us' },
      { text: 'من نحن', path: '/about-us' },
    ],
    contactTitle: 'التواصل',
    contactText: `للتحقق من بيانات الشركة أو لدعم العملاء، راسلنا على ${STORE1920_SUPPORT_EMAIL}.`,
  },
};

export default function BusinessInformationPage() {
  const { isArabic } = useStorefrontI18n();
  const copy = isArabic ? PAGE_COPY.ar : PAGE_COPY.en;

  return (
    <PolicyPageLayout dir={isArabic ? 'rtl' : undefined}>
      <h1 className="text-3xl font-bold text-gray-900 mb-2">{copy.title}</h1>
      <p className="text-gray-600 mb-8">{copy.intro}</p>

      <div className="space-y-6 border border-gray-200 rounded-xl p-6">
        <section>
          <h2 className="font-semibold text-gray-900 mb-2">{copy.identityTitle}</h2>
          <p className="text-gray-700">{copy.identityText}</p>
        </section>

        <section>
          <h2 className="font-semibold text-gray-900 mb-3">{copy.licenseTitle}</h2>
          <dl className="divide-y divide-gray-100 rounded-lg border border-gray-100 overflow-hidden">
            {copy.fields.map((field) => (
              <div
                key={field.label}
                className="grid gap-1 px-4 py-3 sm:grid-cols-[minmax(0,220px)_1fr] sm:gap-4 bg-white even:bg-slate-50/70"
              >
                <dt className="text-sm font-medium text-gray-500">{field.label}</dt>
                <dd
                  className="text-sm font-semibold text-gray-900"
                  dir={/[\u0600-\u06FF]/.test(field.value) ? 'rtl' : undefined}
                >
                  {field.value}
                </dd>
              </div>
            ))}
          </dl>
        </section>

        <section>
          <h2 className="font-semibold text-gray-900 mb-2">{copy.modelTitle}</h2>
          <p className="text-gray-700">{copy.modelText}</p>
        </section>

        <section>
          <h2 className="font-semibold text-gray-900 mb-2">{copy.policiesTitle}</h2>
          <p className="text-gray-700 mb-3">{copy.policiesIntro}</p>
          <ul className="list-disc ps-5 space-y-1 text-gray-700">
            {copy.policyLinks.map((link) => (
              <li key={link.path}>
                <Link href={link.path} className="text-[#E52721] font-medium hover:underline">
                  {link.text}
                </Link>
              </li>
            ))}
          </ul>
        </section>

        <section>
          <h2 className="font-semibold text-gray-900 mb-2">{copy.contactTitle}</h2>
          <p className="text-gray-700">{copy.contactText}</p>
        </section>
      </div>
    </PolicyPageLayout>
  );
}

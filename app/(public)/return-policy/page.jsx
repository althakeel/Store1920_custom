'use client';

import Link from 'next/link';
import PolicyPageLayout from '@/components/PolicyPageLayout';
import { useStorefrontI18n } from '@/lib/useStorefrontI18n';
import {
  STORE1920_CUSTOMER_SUPPORT_PHONE,
  STORE1920_CUSTOMER_SUPPORT_TEL,
  STORE1920_SUPPORT_EMAIL,
} from '@/lib/storeContact';
import PolicyContactBlock from '@/components/PolicyContactBlock';

const EMAIL_SPLIT_PATTERN = /([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/g;
const EMAIL_MATCH_PATTERN = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
const PHONE_SPLIT_PATTERN = /(\b8007861920\b)/g;

function PolicyText({ children, className = 'text-gray-700 mt-2 first:mt-0' }) {
  if (typeof children !== 'string') {
    return <p className={className}>{children}</p>;
  }

  const withPhoneParts = children.split(PHONE_SPLIT_PATTERN);

  return (
    <p className={className}>
      {withPhoneParts.map((segment, segmentIndex) => {
        if (segment === STORE1920_CUSTOMER_SUPPORT_PHONE) {
          return (
            <a
              key={`phone-${segmentIndex}`}
              href={STORE1920_CUSTOMER_SUPPORT_TEL}
              className="text-orange-600 underline"
            >
              {segment}
            </a>
          );
        }

        const parts = segment.split(EMAIL_SPLIT_PATTERN);
        return parts.map((part, index) => (
          EMAIL_MATCH_PATTERN.test(part) ? (
            <a key={`${part}-${segmentIndex}-${index}`} href={`mailto:${part}`} className="text-orange-600 underline">
              {part}
            </a>
          ) : (
            <span key={`${part}-${segmentIndex}-${index}`}>{part}</span>
          )
        ));
      })}
    </p>
  );
}

function buildPageCopy() {
  const supportLineEn = `Need help? Email ${STORE1920_SUPPORT_EMAIL} or call our toll-free number ${STORE1920_CUSTOMER_SUPPORT_PHONE}.`;
  const supportLineAr = `للمساعدة، راسلنا على ${STORE1920_SUPPORT_EMAIL} أو اتصل على الرقم المجاني ${STORE1920_CUSTOMER_SUPPORT_PHONE}.`;

  return {
  en: {
    title: 'Return, Refund & Exchange Policy',
    intro:
      'At Store1920, your satisfaction is our priority. Please read the policy below before requesting a return or refund.',
    sections: [
      {
        title: '1. Return Window & Eligible Cases',
        paragraphs: [
          'Items can be returned after notifying us within 3 days from the date of delivery in either of these cases:',
          'All returns must be in original packaging and in the same condition in which they were received.',
          'You can request a return directly on our website — sign in, go to My Orders, open your delivered order, and submit a Return Request.',
        ],
        bullets: [
          'Products that are damaged',
          'Orders that arrive incomplete (not total order)',
          'Fastest option: use the online Return Request form from your order page',
        ],
      },
      {
        title: '2. Return Conditions',
        paragraphs: [
          'To be eligible for a return, your item must be unused, in the same condition you received it, and in original packaging.',
          'Mobile phones, smartphones, tablets, laptops, and similar personal electronic devices must be completely unused and unactivated. Once such a device has been set up, configured, powered on for normal use, or shows any signs of use (including removed seals, screen activation, or logged-in accounts), it cannot be returned.',
        ],
      },
      {
        title: '3. Non-Returnable Items',
        paragraphs: [
          'Several types of goods are exempt from being returned:',
          'Mobile phones, smartphones, tablets, laptops, and similar personal electronic devices cannot be returned if they have been used, activated, set up, or show any signs of use — including removed factory seals, screen activation, logged-in accounts, or any configuration.',
        ],
        bullets: [
          'Used, activated, or configured mobile phones, smartphones, tablets, laptops, and similar devices',
          'Non-brand electronics, cosmetics, and similar items (contact us to confirm eligibility)',
          'Intimate or sanitary goods',
          'Hazardous materials, flammable liquids, or gases',
          'Gift cards',
          'Downloadable software products',
          'Some health and personal care items',
        ],
      },
      {
        title: '4. Orders Above AED 2,000',
        paragraphs: [
          'Orders with a total value above AED 2,000 are not eligible for return. No return option is available for such orders, as long as subject to company policy.',
        ],
      },
      {
        title: '5. Return Requirements',
        bullets: [
          'A receipt or proof of purchase is required to complete your return.',
          'Please do not send your purchase back to the manufacturer.',
        ],
      },
      {
        title: '6. Photo or Video Proof & Verification',
        paragraphs: [
          'For any return or replacement request, a photo or video of the product must be submitted together with your request.',
          'Returns and replacements will only be processed after the original condition of the item has been verified by our management.',
        ],
      },
      {
        title: '7. Partial Refund Cases (if applicable)',
        paragraphs: ['Only partial refunds may be granted in certain situations, including:'],
        bullets: [
          'Book with obvious signs of use',
          'Opened CD, DVD, VHS tape, software, video game, cassette tape, or vinyl record',
          'Any item not in original condition, damaged, or missing parts for reasons not due to our error',
        ],
      },
      {
        title: '8. Refunds (if applicable)',
        paragraphs: [
          'Once your return is received and inspected, we will notify you by email about approval or rejection of your refund.',
          'If approved, your refund will be processed and credited to your original payment method within a certain number of days.',
          'For returns, we can arrange return collection. Courier charges must be paid by the customer, or the customer can return directly to our partner store in Deira.',
        ],
      },
      {
        title: '9. Late or Missing Refunds',
        paragraphs: ['If you still have not received your refund, contact our support team:', supportLineEn],
        bullets: [
          'Check your bank account again.',
          'Contact your credit card company; posting can take time.',
          'Contact your bank; processing times can vary.',
        ],
      },
      {
        title: '10. Sale Items',
        paragraphs: ['Only regular-priced items may be refunded. Sale items are non-refundable.'],
      },
      {
        title: '11. Exchanges',
        paragraphs: ['We currently do not offer exchanges.'],
      },
      {
        title: '12. Gifts',
        paragraphs: ['We currently do not offer refunds if your item was a gift.'],
      },
      {
        title: '13. Shipping for Returns',
        paragraphs: [
          `To return your product, submit a Return Request from My Orders or contact customer service at ${STORE1920_SUPPORT_EMAIL}.`,
          'You are responsible for paying return shipping costs. Shipping costs are non-refundable. If a refund is issued, return shipping cost will be deducted from your refund.',
          'Delivery times for returned/replaced products may vary depending on your location.',
        ],
      },
    ],
  },
  ar: {
    title: 'سياسة الإرجاع والاسترداد والاستبدال',
    intro:
      'في Store1920، رضاك أولويتنا. يرجى قراءة السياسة أدناه قبل طلب الإرجاع أو الاسترداد.',
    sections: [
      {
        title: '1. مدة الإرجاع والحالات المؤهلة',
        paragraphs: [
          'يمكن إرجاع المنتجات بعد إخطارنا خلال 3 أيام من تاريخ التسليم في إحدى الحالتين التاليتين:',
          'يجب أن تكون جميع المرتجعات في عبوتها الأصلية وبنفس الحالة التي استلمتها بها.',
          'يمكنك طلب الإرجاع مباشرة من موقعنا — سجّل الدخول، ثم اذهب إلى طلباتي، وافتح الطلب المُسلّم، وقدّم طلب إرجاع.',
        ],
        bullets: [
          'المنتجات التالفة',
          'الطلبات التي تصل ناقصة (وليس الطلب بالكامل)',
          'الخيار الأسرع: استخدم نموذج طلب الإرجاع من صفحة الطلب',
        ],
      },
      {
        title: '2. شروط الإرجاع',
        paragraphs: [
          'لتكون مؤهلاً للإرجاع، يجب أن يكون المنتج غير مستخدم، وبنفس الحالة التي استلمته بها، وفي عبوته الأصلية.',
          'يجب أن تكون الهواتف المحمولة والهواتف الذكية والأجهزة اللوحية وأجهزة الكمبيوتر المحمولة والأجهزة الإلكترونية الشخصية المماثلة غير مستخدمة وغير مفعّلة بالكامل. بمجرد تفعيل أو إعداد أو استخدام أي من هذه الأجهزة، أو ظهور أي علامات استخدام (بما في ذلك كسر الأختام أو تفعيل الشاشة أو تسجيل الدخول إلى حساب)، لا يمكن إرجاعها.',
        ],
      },
      {
        title: '3. المنتجات غير القابلة للإرجاع',
        paragraphs: [
          'هناك عدة أنواع من السلع مستثناة من الإرجاع:',
          'لا يمكن إرجاع الهواتف المحمولة والهواتف الذكية والأجهزة اللوحية وأجهزة الكمبيوتر المحمولة والأجهزة الإلكترونية الشخصية المماثلة إذا تم استخدامها أو تفعيلها أو إعدادها أو ظهرت عليها أي علامات استخدام — بما في ذلك كسر الأختام الأصلية أو تفعيل الشاشة أو تسجيل الدخول إلى حساب أو أي إعداد للجهاز.',
        ],
        bullets: [
          'الهواتف المحمولة والهواتف الذكية والأجهزة اللوحية وأجهزة الكمبيوتر المحمولة والأجهزة المماثلة المستخدمة أو المفعّلة أو المُعدّة',
          'الإلكترونيات غير العلامة التجارية ومستحضرات التجميل وما شابه (تواصل معنا للتأكد من الأهلية)',
          'السلع الحميمة أو الصحية',
          'المواد الخطرة أو السوائل أو الغازات القابلة للاشتعال',
          'بطاقات الهدايا',
          'منتجات البرمجيات القابلة للتنزيل',
          'بعض منتجات الصحة والعناية الشخصية',
        ],
      },
      {
        title: '4. الطلبات التي تتجاوز 2000 درهم',
        paragraphs: [
          'الطلبات التي تتجاوز قيمتها الإجمالية 2000 درهم إماراتي غير مؤهلة للإرجاع. لا يتوفر خيار الإرجاع لهذه الطلبات، وذلك وفقًا لسياسة الشركة.',
        ],
      },
      {
        title: '5. متطلبات الإرجاع',
        bullets: [
          'مطلوب إيصال أو إثبات شراء لإتمام الإرجاع.',
          'يرجى عدم إرسال مشترياتك مباشرة إلى الشركة المصنعة.',
        ],
      },
      {
        title: '6. إرفاق صورة أو فيديو والتحقق',
        paragraphs: [
          'لأي طلب إرجاع أو استبدال، يجب إرفاق صورة أو فيديو للمنتج مع طلبك.',
          'لن تتم معالجة عمليات الإرجاع والاستبدال إلا بعد التحقق من الحالة الأصلية للمنتج من قبل إدارتنا.',
        ],
      },
      {
        title: '7. حالات الاسترداد الجزئي (إن وجدت)',
        paragraphs: ['قد يُمنح استرداد جزئي فقط في حالات معينة، بما في ذلك:'],
        bullets: [
          'كتاب بعلامات استخدام واضحة',
          'قرص مضغوط أو DVD أو شريط VHS أو برنامج أو لعبة فيديو أو شريط كاسيت أو أسطوانة فينيل مفتوح',
          'أي منتج ليس في حالته الأصلية أو تالف أو تنقصه أجزاء لأسباب لا تعود إلى خطأ من جانبنا',
        ],
      },
      {
        title: '8. الاسترداد (إن وجد)',
        paragraphs: [
          'بمجرد استلام مرتجعك وفحصه، سنخطرك عبر البريد الإلكتروني بالموافقة على الاسترداد أو رفضه.',
          'إذا تمت الموافقة، سيتم معالجة الاسترداد وإضافته إلى طريقة الدفع الأصلية خلال عدد معين من الأيام.',
          'للإرجاع، يمكننا ترتيب استلام المرتجع. يتحمل العميل رسوم شركة الشحن، أو يمكن للعميل الإرجاع مباشرة إلى متجر شريكنا في ديرة.',
        ],
      },
      {
        title: '9. تأخر الاسترداد أو فقده',
        paragraphs: ['إذا لم تستلم الاسترداد بعد، تواصل مع فريق الدعم:', supportLineAr],
        bullets: [
          'تحقق من حسابك البنكي مرة أخرى.',
          'تواصل مع شركة بطاقتك الائتمانية؛ قد يستغرق الإيداع وقتًا.',
          'تواصل مع بنكك؛ قد تختلف أوقات المعالجة.',
        ],
      },
      {
        title: '10. منتجات التخفيضات',
        paragraphs: ['يمكن استرداد المنتجات بسعرها العادي فقط. منتجات التخفيضات غير قابلة للاسترداد.'],
      },
      {
        title: '11. الاستبدال',
        paragraphs: ['لا نقدم حاليًا خدمة الاستبدال.'],
      },
      {
        title: '12. الهدايا',
        paragraphs: ['لا نقدم حاليًا استردادًا إذا كان المنتج هدية.'],
      },
      {
        title: '13. شحن المرتجعات',
        paragraphs: [
          `لإرجاع منتجك، قدّم طلب إرجاع من صفحة طلباتي أو تواصل مع خدمة العملاء عبر ${STORE1920_SUPPORT_EMAIL}.`,
          'أنت مسؤول عن دفع تكاليف شحن الإرجاع. تكاليف الشحن غير قابلة للاسترداد. إذا تم إصدار استرداد، سيتم خصم تكلفة شحن الإرجاع من مبلغ الاسترداد.',
          'قد تختلف مواعيد تسليم المنتجات المرتجعة أو المستبدلة حسب موقعك.',
        ],
      },
    ],
  },
  };
}

export default function ReturnPolicyPage() {
  const { isArabic } = useStorefrontI18n();
  const pageCopy = buildPageCopy();
  const copy = isArabic ? pageCopy.ar : pageCopy.en;

  return (
    <PolicyPageLayout dir={isArabic ? 'rtl' : undefined}>
      <h1 className="text-3xl font-bold text-gray-900 mb-2">{copy.title}</h1>
      <p className="text-gray-600 mb-4">{copy.intro}</p>
      <div className="mb-8 rounded-xl border border-orange-200 bg-orange-50 px-4 py-3 text-sm text-gray-800">
        {isArabic ? (
          <>
            اطلب الإرجاع من الموقع مباشرة من{' '}
            <Link href="/orders" className="font-semibold text-orange-700 underline">طلباتي</Link>
            {' '}أو صفحة{' '}
            <Link href="/return-request" className="font-semibold text-orange-700 underline">طلب الإرجاع</Link>.
          </>
        ) : (
          <>
            Request a return on the website from{' '}
            <Link href="/orders" className="font-semibold text-orange-700 underline">My Orders</Link>
            {' '}or the{' '}
            <Link href="/return-request" className="font-semibold text-orange-700 underline">Return Request</Link>
            {' '}page.
          </>
        )}
      </div>

      <div className="space-y-6 border border-gray-200 rounded-xl p-6">
        {copy.sections.map((section) => (
          <section key={section.title}>
            <h2 className="font-semibold text-gray-900 mb-2">{section.title}</h2>
            {section.paragraphs?.map((paragraph) => (
              <PolicyText key={paragraph}>{paragraph}</PolicyText>
            ))}
            {section.bullets?.length ? (
              <ul className="list-disc ml-6 text-gray-700 mt-2 space-y-1">
                {section.bullets.map((bullet) => (
                  <li key={bullet}>{bullet}</li>
                ))}
              </ul>
            ) : null}
          </section>
        ))}
      </div>
      <div className="mt-6 border border-gray-200 rounded-xl p-6">
        <PolicyContactBlock isArabic={isArabic} />
      </div>
    </PolicyPageLayout>
  );
}

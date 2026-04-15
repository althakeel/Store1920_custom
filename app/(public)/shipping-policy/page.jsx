'use client';

import { useStorefrontI18n } from '@/lib/useStorefrontI18n';

const PAGE_COPY = {
  en: {
    title: 'Shipping & Delivery Policy',
    intro:
      'This Shipping & Delivery Policy explains how orders placed on Store1920.com, owned and operated by Store1920, are processed, shipped, and delivered.',
    sections: [
      {
        title: '1. Order Processing Time',
        paragraphs: [
          'Most orders are processed within 1-2 business days after confirmation. During peak seasons, promotions, or high-volume periods, processing times may be slightly longer. Orders placed on Sundays or public holidays will be processed on the next business day.',
        ],
      },
      {
        title: '2. Shipping Methods & Delivery Timeline',
        paragraphs: [
          'Store1920 currently delivers products across all Emirates in the UAE. Delivery timelines depend on your location, product availability, and courier partner.',
          'Delivery timelines shown at checkout are estimates and not guaranteed.',
        ],
        bullets: [
          'Standard Delivery: 2-5 business days',
          'Express Delivery: 1-3 business days (available for select locations/products)',
        ],
      },
      {
        title: '3. Shipping Charges',
        paragraphs: [
          'Shipping charges vary based on product weight, category, and delivery location. All applicable shipping fees are clearly displayed at checkout before payment is completed.',
        ],
      },
      {
        title: '4. Order Tracking',
        paragraphs: [
          'Once your order is shipped, tracking details will be shared via SMS or email. You can also track your order anytime from the My Orders section on Store1920.com.',
        ],
      },
      {
        title: '5. Delivery Attempts',
        paragraphs: [
          'Courier partners will attempt delivery up to two times. If delivery fails due to customer unavailability or incorrect address details, the order may be returned to our warehouse. Re-delivery may incur additional charges.',
        ],
      },
      {
        title: '6. Damaged, Missing, or Incorrect Items',
        paragraphs: [
          'If you receive a damaged, defective, missing, or incorrect item, please contact us within 48 hours of delivery with your Order ID and clear photos or videos.',
          'Email: support@Store1920.com',
        ],
      },
      {
        title: '7. Address & Contact Accuracy',
        paragraphs: [
          'Customers are responsible for providing accurate shipping address and contact details during checkout. Store1920 is not responsible for delivery failures caused by incorrect information.',
        ],
      },
      {
        title: '8. Delivery Restrictions',
        paragraphs: [
          'Certain products may have delivery restrictions due to size, weight, or courier limitations. If delivery is not possible, our team will contact you to arrange an alternative solution or refund.',
        ],
      },
      {
        title: '9. Delays Beyond Our Control',
        paragraphs: [
          'Delivery delays may occur due to weather conditions, courier issues, regional restrictions, or unforeseen circumstances. Store1920 shall not be held responsible for delays caused by external factors beyond our control.',
        ],
      },
      {
        title: '10. International Shipping',
        paragraphs: [
          'Currently, Store1920 delivers products only within the UAE. International shipping is not available at this time.',
        ],
      },
    ],
  },
  ar: {
    title: 'سياسة الشحن والتوصيل',
    intro:
      'توضح سياسة الشحن والتوصيل هذه كيفية معالجة الطلبات المقدمة على Store1920.com وشحنها وتسليمها من قبل Store1920.',
    sections: [
      {
        title: '1. وقت معالجة الطلب',
        paragraphs: [
          'تتم معالجة معظم الطلبات خلال 1-2 يوم عمل بعد التأكيد. خلال المواسم المزدحمة أو العروض أو فترات ارتفاع الطلب قد تستغرق المعالجة وقتًا أطول قليلًا. الطلبات المقدمة يوم الأحد أو في العطلات الرسمية تتم معالجتها في يوم العمل التالي.',
        ],
      },
      {
        title: '2. طرق الشحن ومدة التوصيل',
        paragraphs: [
          'يقوم Store1920 حاليًا بتوصيل المنتجات إلى جميع إمارات دولة الإمارات العربية المتحدة. تعتمد مدة التوصيل على موقعك وتوفر المنتج وشريك الشحن.',
          'مواعيد التوصيل الظاهرة عند الدفع تقديرية وليست مضمونة.',
        ],
        bullets: [
          'التوصيل العادي: من 2 إلى 5 أيام عمل',
          'التوصيل السريع: من 1 إلى 3 أيام عمل (متاح لمناطق أو منتجات محددة)',
        ],
      },
      {
        title: '3. رسوم الشحن',
        paragraphs: [
          'تختلف رسوم الشحن حسب وزن المنتج وفئته وموقع التوصيل. يتم عرض جميع رسوم الشحن المطبقة بوضوح عند الدفع قبل إتمام السداد.',
        ],
      },
      {
        title: '4. تتبع الطلب',
        paragraphs: [
          'بمجرد شحن طلبك، ستتم مشاركة تفاصيل التتبع عبر الرسائل النصية أو البريد الإلكتروني. ويمكنك أيضًا تتبع طلبك في أي وقت من قسم طلباتي على Store1920.com.',
        ],
      },
      {
        title: '5. محاولات التسليم',
        paragraphs: [
          'سيقوم شركاء الشحن بمحاولة التسليم حتى مرتين. إذا فشل التسليم بسبب عدم توفر العميل أو وجود عنوان غير صحيح فقد تتم إعادة الطلب إلى مستودعنا. وقد يترتب على إعادة التسليم رسوم إضافية.',
        ],
      },
      {
        title: '6. المنتجات التالفة أو الناقصة أو غير الصحيحة',
        paragraphs: [
          'إذا استلمت منتجًا تالفًا أو معيبًا أو ناقصًا أو غير صحيح، يرجى التواصل معنا خلال 48 ساعة من التسليم مع رقم الطلب وصور أو فيديوهات واضحة.',
          'البريد الإلكتروني: support@Store1920.com',
        ],
      },
      {
        title: '7. دقة العنوان وبيانات التواصل',
        paragraphs: [
          'يتحمل العملاء مسؤولية إدخال عنوان الشحن وبيانات التواصل الصحيحة أثناء الدفع. ولا يتحمل Store1920 مسؤولية فشل التسليم الناتج عن معلومات غير صحيحة.',
        ],
      },
      {
        title: '8. قيود التوصيل',
        paragraphs: [
          'قد تخضع بعض المنتجات لقيود في التوصيل بسبب الحجم أو الوزن أو حدود شركة الشحن. وإذا تعذر التوصيل فسيتواصل فريقنا معك لترتيب حل بديل أو استرداد المبلغ.',
        ],
      },
      {
        title: '9. التأخير الخارج عن إرادتنا',
        paragraphs: [
          'قد تحدث تأخيرات في التوصيل بسبب الأحوال الجوية أو مشكلات شركات الشحن أو القيود الإقليمية أو ظروف غير متوقعة. ولا يتحمل Store1920 مسؤولية التأخيرات الناتجة عن عوامل خارجية خارجة عن سيطرته.',
        ],
      },
      {
        title: '10. الشحن الدولي',
        paragraphs: [
          'حاليًا يقوم Store1920 بتوصيل المنتجات داخل دولة الإمارات العربية المتحدة فقط. الشحن الدولي غير متاح في الوقت الحالي.',
        ],
      },
    ],
  },
};

export default function ShippingPolicyPage() {
  const { isArabic } = useStorefrontI18n();
  const copy = isArabic ? PAGE_COPY.ar : PAGE_COPY.en;

  return (
    <div className="bg-gray-50 max-w-[1450px] mx-auto">
      <div className="max-w-3xl mx-auto px-4 py-10 min-h-[60vh]">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">{copy.title}</h1>
        <p className="text-gray-600 mb-8">{copy.intro}</p>

        <div className="space-y-6 bg-white border border-gray-200 rounded-xl p-6">
          {copy.sections.map((section) => (
            <section key={section.title}>
              <h2 className="font-semibold text-gray-900 mb-2">{section.title}</h2>
              {section.paragraphs.map((paragraph) => (
                <p key={paragraph} className="text-gray-700 mt-2 first:mt-0">
                  {paragraph}
                </p>
              ))}
              {section.bullets?.length ? (
                <ul className="list-disc ml-6 text-gray-700 mt-2">
                  {section.bullets.map((bullet) => (
                    <li key={bullet}>{bullet}</li>
                  ))}
                </ul>
              ) : null}
            </section>
          ))}
        </div>
      </div>
    </div>
  );
}

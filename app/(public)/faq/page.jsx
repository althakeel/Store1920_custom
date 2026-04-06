'use client'

export default function FAQPage() {
  const faqs = [
    {
      q: 'What is Store1920.com?',
      a: 'Store1920.com is an online marketplace where you can discover and shop top-selling and new products across multiple categories.'
    },
    {
      q: 'How do I track my order?',
      a: 'Go to My Orders from your profile menu. You can view real-time updates for each order placed on Store1920.com.'
    },
    {
      q: 'What is the return and replacement policy?',
      a: 'Most items are eligible for return within 7 days of delivery and replacement within 15 days (subject to product eligibility). Check the Return Policy page for full details.'
    },
    {
      q: 'How do I contact support?',
      a: 'Visit the Support page to find contact options. You can raise a ticket or email us at support@Store1920.com.'
    }
  ];

  return (
    <div className="bg-gray-50">
      <div className="max-w-3xl mx-auto px-4 py-10 min-h-[60vh]">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Frequently Asked Questions</h1>
        <p className="text-gray-600 mb-8">Answers to common questions about shopping on Store1920.com.</p>

        <div className="space-y-4">
          {faqs.map((item, i) => (
            <details key={i} className="group bg-white border border-gray-200 rounded-xl p-4 open:shadow-md">
              <summary className="font-medium text-gray-900 cursor-pointer list-none flex items-center justify-between">
                {item.q}
                <span className="text-gray-400 group-open:rotate-180 transition">▾</span>
              </summary>
              <p className="text-gray-700 mt-2 leading-relaxed">{item.a}</p>
            </details>
          ))}
        </div>
      </div>
    </div>
  );
}

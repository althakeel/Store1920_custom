'use client'

export default function RefundPolicyPage() {
  return (
    <div className="bg-gray-50 max-w-[1450px] mx-auto">
      <div className="max-w-3xl mx-auto px-4 py-10 min-h-[60vh]">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Refund Policy</h1>
        <p className="text-gray-600 mb-8">Learn how refunds are handled for returns and order issues.</p>

        <div className="space-y-6 bg-white border border-gray-200 rounded-xl p-6">
          <section>
            <h2 className="font-semibold text-gray-900 mb-2">1. Eligibility</h2>
            <p className="text-gray-700">Refunds are available for eligible returns per our Return Policy timelines (e.g., 7-day returns or 15-day replacements where applicable).</p>
          </section>
          <section>
            <h2 className="font-semibold text-gray-900 mb-2">2. Refund Method</h2>
            <p className="text-gray-700">Approved refunds are issued to your original payment method. Processing may take 5–10 business days depending on your bank/payment provider.</p>
          </section>
          <section>
            <h2 className="font-semibold text-gray-900 mb-2">3. Deductions</h2>
            <p className="text-gray-700">Shipping or service fees may be non-refundable unless the return is due to our error or a defective product.</p>
          </section>
          <section>
            <h2 className="font-semibold text-gray-900 mb-2">4. Non-Refundable Items</h2>
            <p className="text-gray-700">Certain items may be ineligible for refunds once opened or used (e.g., hygiene products, software with activated licenses), subject to local law.</p>
          </section>
          <section>
            <h2 className="font-semibold text-gray-900 mb-2">5. How to Request</h2>
            <p className="text-gray-700">Submit a return request from your Orders page or contact support@Store1920.com with your order ID and reason. We’ll guide you through the steps.</p>
          </section>
        </div>
      </div>
    </div>
  );
}

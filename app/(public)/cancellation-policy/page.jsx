'use client'

export default function CancellationPolicyPage() {
  return (
    <div className="bg-gray-50">
      <div className="max-w-3xl mx-auto px-4 py-10 min-h-[60vh]">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Order Cancellation Policy</h1>
        <p className="text-gray-600 mb-8">Options and timelines for cancelling an order on Store1920.com.</p>

        <div className="space-y-6 bg-white border border-gray-200 rounded-xl p-6">
          <section>
            <h2 className="font-semibold text-gray-900 mb-2">1. Before Shipment</h2>
            <p className="text-gray-700">You can request cancellation before the order ships. Go to My Orders and choose Cancel, or email support@Store1920.com with your order ID.</p>
          </section>
          <section>
            <h2 className="font-semibold text-gray-900 mb-2">2. After Shipment</h2>
            <p className="text-gray-700">Once shipped, cancellation may not be possible. You can refuse delivery or start a return after receiving the package, per the Return Policy.</p>
          </section>
          <section>
            <h2 className="font-semibold text-gray-900 mb-2">3. Refunds on Cancellations</h2>
            <p className="text-gray-700">If payment was captured and your cancellation is approved, a refund is issued to your original payment method. See Refund Policy timelines.</p>
          </section>
        </div>
      </div>
    </div>
  );
}

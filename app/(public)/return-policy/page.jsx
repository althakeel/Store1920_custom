'use client'

export default function ReturnPolicyPage() {
  return (
    <div className="bg-gray-50 max-w-[1450px] mx-auto">
      <div className="max-w-3xl mx-auto px-4 py-10 min-h-[60vh]">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Return, Refund & Exchange Policy</h1>
        <p className="text-gray-600 mb-8">At Store1920, your satisfaction is our priority. Please read the policy below before requesting a return or refund.</p>

        <div className="space-y-6 bg-white border border-gray-200 rounded-xl p-6">
          <section>
            <h2 className="font-semibold text-gray-900 mb-2">1. Return Window & Eligible Cases</h2>
            <p className="text-gray-700 mb-2">Items can be returned after notifying us within <span className="font-medium">3 days</span> from the date of delivery in either of these cases:</p>
            <ul className="list-disc pl-6 text-gray-700 space-y-1">
              <li>Products that are damaged</li>
              <li>Orders that arrive incomplete (not total order)</li>
            </ul>
            <p className="text-gray-700 mt-3">All returns must be in original packaging and in the same condition in which they were received.</p>
            <p className="text-gray-700 mt-2">For returns, contact: <a href="mailto:Store192065@gmail.com" className="text-orange-600 underline">Store192065@gmail.com</a></p>
          </section>

          <section>
            <h2 className="font-semibold text-gray-900 mb-2">2. Return Conditions</h2>
            <p className="text-gray-700">To be eligible for a return, your item must be unused, in the same condition you received it, and in original packaging.</p>
          </section>

          <section>
            <h2 className="font-semibold text-gray-900 mb-2">3. Non-Returnable Items</h2>
            <p className="text-gray-700 mb-2">Several types of goods are exempt from being returned:</p>
            <ul className="list-disc pl-6 text-gray-700 space-y-1">
              <li>Non-brand electronics, cosmetics, and similar items (contact us to confirm eligibility)</li>
              <li>Intimate or sanitary goods</li>
              <li>Hazardous materials, flammable liquids, or gases</li>
              <li>Gift cards</li>
              <li>Downloadable software products</li>
              <li>Some health and personal care items</li>
            </ul>
          </section>

          <section>
            <h2 className="font-semibold text-gray-900 mb-2">4. Return Requirements</h2>
            <ul className="list-disc pl-6 text-gray-700 space-y-1">
              <li>A receipt or proof of purchase is required to complete your return.</li>
              <li>Please do not send your purchase back to the manufacturer.</li>
            </ul>
          </section>

          <section>
            <h2 className="font-semibold text-gray-900 mb-2">5. Partial Refund Cases (if applicable)</h2>
            <p className="text-gray-700 mb-2">Only partial refunds may be granted in certain situations, including:</p>
            <ul className="list-disc pl-6 text-gray-700 space-y-1">
              <li>Book with obvious signs of use</li>
              <li>Opened CD, DVD, VHS tape, software, video game, cassette tape, or vinyl record</li>
              <li>Any item not in original condition, damaged, or missing parts for reasons not due to our error</li>
            </ul>
          </section>

          <section>
            <h2 className="font-semibold text-gray-900 mb-2">6. Refunds (if applicable)</h2>
            <p className="text-gray-700">Once your return is received and inspected, we will notify you by email about approval or rejection of your refund.</p>
            <p className="text-gray-700 mt-2">If approved, your refund will be processed and credited to your original payment method within a certain number of days.</p>
            <p className="text-gray-700 mt-2">For returns, we can arrange return collection. Courier charges must be paid by the customer, or the customer can return directly to our partner store in Deira.</p>
          </section>

          <section>
            <h2 className="font-semibold text-gray-900 mb-2">7. Late or Missing Refunds</h2>
            <ul className="list-disc pl-6 text-gray-700 space-y-1">
              <li>Check your bank account again.</li>
              <li>Contact your credit card company; posting can take time.</li>
              <li>Contact your bank; processing times can vary.</li>
            </ul>
            <p className="text-gray-700 mt-2">If you still have not received your refund, contact: <a href="mailto:Store192065@gmail.com" className="text-orange-600 underline">Store192065@gmail.com</a></p>
          </section>

          <section>
            <h2 className="font-semibold text-gray-900 mb-2">8. Sale Items</h2>
            <p className="text-gray-700">Only regular-priced items may be refunded. Sale items are non-refundable.</p>
          </section>

          <section>
            <h2 className="font-semibold text-gray-900 mb-2">9. Exchanges</h2>
            <p className="text-gray-700">We currently do not offer exchanges.</p>
          </section>

          <section>
            <h2 className="font-semibold text-gray-900 mb-2">10. Gifts</h2>
            <p className="text-gray-700">We currently do not offer refunds if your item was a gift.</p>
          </section>

          <section>
            <h2 className="font-semibold text-gray-900 mb-2">11. Shipping for Returns</h2>
            <p className="text-gray-700">To return your product, contact customer service at <a href="mailto:support@Store1920.com" className="text-orange-600 underline">support@Store1920.com</a>.</p>
            <p className="text-gray-700 mt-2">You are responsible for paying return shipping costs. Shipping costs are non-refundable. If a refund is issued, return shipping cost will be deducted from your refund.</p>
            <p className="text-gray-700 mt-2">Delivery times for returned/replaced products may vary depending on your location.</p>
          </section>
        </div>
      </div>
    </div>
  );
}

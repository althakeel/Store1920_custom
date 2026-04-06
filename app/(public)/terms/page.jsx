'use client'

export default function TermsPage() {
  return (
    <div className="bg-gray-50">
      <div className="max-w-3xl mx-auto px-4 py-10 min-h-[60vh]">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Terms & Conditions</h1>
        <p className="text-gray-600 mb-8">These Terms & Conditions govern your use of Store1920.com. By accessing or using our website, you agree to these terms.</p>

        <div className="space-y-6 bg-white border border-gray-200 rounded-xl p-6">
          <section>
            <h2 className="font-semibold text-gray-900 mb-2">1. Account</h2>
            <p className="text-gray-700">You are responsible for maintaining the confidentiality of your account and for all activities under it. Please keep your credentials secure and notify us of any unauthorized use.</p>
          </section>
          <section>
            <h2 className="font-semibold text-gray-900 mb-2">2. Orders & Pricing</h2>
            <p className="text-gray-700">All prices are shown in local currency and may change without notice. Orders are accepted subject to stock availability and payment authorization. We may cancel or refuse orders at our discretion.</p>
          </section>
          <section>
            <h2 className="font-semibold text-gray-900 mb-2">3. Delivery</h2>
            <p className="text-gray-700">Estimated delivery times are provided for convenience and are not guaranteed. Risk passes to you upon delivery to the address provided.</p>
          </section>
          <section>
            <h2 className="font-semibold text-gray-900 mb-2">4. Returns & Replacements</h2>
            <p className="text-gray-700">Returns are generally accepted within 7 days, and replacements within 15 days of delivery, subject to product eligibility and condition. See the Return Policy for full details.</p>
          </section>
          <section>
            <h2 className="font-semibold text-gray-900 mb-2">5. Acceptable Use</h2>
            <p className="text-gray-700">Do not misuse the website, attempt to interfere with its operation, or violate laws while using our services.</p>
          </section>
          <section>
            <h2 className="font-semibold text-gray-900 mb-2">6. Intellectual Property</h2>
            <p className="text-gray-700">All content, trademarks, and materials on Store1920.com are owned by or licensed to us and are protected by applicable laws.</p>
          </section>
          <section>
            <h2 className="font-semibold text-gray-900 mb-2">7. Liability</h2>
            <p className="text-gray-700">To the maximum extent permitted by law, Store1920.com is not liable for indirect or consequential losses arising from your use of our website or services.</p>
          </section>
          <section>
            <h2 className="font-semibold text-gray-900 mb-2">8. Changes</h2>
            <p className="text-gray-700">We may update these terms from time to time. Continued use of the website after changes means you accept the updated terms.</p>
          </section>
          <section>
            <h2 className="font-semibold text-gray-900 mb-2">9. Contact</h2>
            <p className="text-gray-700">Questions? Email <a href="mailto:support@Store1920.com" className="text-orange-600 underline">support@Store1920.com</a>.</p>
          </section>
        </div>
      </div>
    </div>
  );
}

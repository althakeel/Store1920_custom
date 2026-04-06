'use client'

export default function PaymentAndPricingPolicyPage() {
  return (
    <div className="bg-gray-50">
      <div className="max-w-3xl mx-auto px-4 py-10 min-h-[60vh]">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Payment & Pricing Policy</h1>
        <p className="text-gray-600 mb-8">
          Details about accepted payment methods, pricing, taxes, billing, and security for purchases made on
          store1920.com in the UAE.
        </p>

        <div className="space-y-6 bg-white border border-gray-200 rounded-xl p-6">
          
          {/* 1. Accepted Methods */}
          <section>
            <h2 className="font-semibold text-gray-900 mb-2">1. Accepted Payment Methods</h2>
            <p className="text-gray-700 mb-3">
              store1920 supports multiple secure payment options to ensure a smooth checkout experience.
            </p>
            <ul className="list-disc pl-6 text-gray-700 space-y-1">
              <li>Credit & Debit Cards (Visa, MasterCard, and supported cards)</li>
              <li>Secure online card checkout</li>
              <li>Wallet Payments (where supported)</li>
              <li>Cash on Delivery (COD) – Selected locations in UAE</li>
            </ul>
            <p className="text-gray-700 mt-3">All online payments are processed securely through trusted payment gateways.</p>
          </section>

          {/* 2. Pricing & Promotions */}
          <section>
            <h2 className="font-semibold text-gray-900 mb-2">2. Pricing & Promotions</h2>
            <p className="text-gray-700 mb-3">
              All prices on store1920.com are displayed in AED. Product prices may vary based on availability,
              location, offers, or stock conditions.
            </p>
            <ul className="list-disc pl-6 text-gray-700 space-y-1">
              <li>Final price (including delivery charges) is shown at checkout.</li>
              <li>Promotional or discounted prices are valid only during the offer period.</li>
              <li>store1920 reserves the right to update prices at any time based on market conditions.</li>
            </ul>
          </section>

          {/* 3. Taxes & Duties */}
          <section>
            <h2 className="font-semibold text-gray-900 mb-2">3. Taxes & Applicable Charges</h2>
            <p className="text-gray-700">
              All applicable taxes and statutory charges are included or shown as applicable during checkout unless stated otherwise.
              Additional charges (if any) will be displayed clearly before payment.
            </p>
          </section>

          {/* 4. Payment Verification */}
          <section>
            <h2 className="font-semibold text-gray-900 mb-2">4. Payment Verification & Security</h2>
            <p className="text-gray-700 mb-3">
              To protect customers and prevent fraudulent transactions, certain orders may undergo verification.
            </p>
            <ul className="list-disc pl-6 text-gray-700 space-y-1">
              <li>Verification may include OTP/email confirmation or payment gateway validation.</li>
              <li>If verification fails, the order may be cancelled and refunded.</li>
              <li>Your payment information is encrypted and never stored on our servers.</li>
            </ul>
          </section>

          {/* 5. Billing Issues */}
          <section>
            <h2 className="font-semibold text-gray-900 mb-2">5. Billing Issues & Incorrect Charges</h2>
            <p className="text-gray-700 mb-3">
              If you notice any incorrect or duplicate charges, please contact our support team immediately.
            </p>
            <p className="text-gray-700">
              Email: <strong>support@store1920.com</strong> <br />
              Please include your order ID, payment reference number, and issue details.
            </p>
            <p className="text-gray-700 mt-3">
              We will investigate and resolve billing issues within 2–5 business days.
            </p>
          </section>

          {/* 6. Refunds for Payments */}
          <section>
            <h2 className="font-semibold text-gray-900 mb-2">6. Refunds for Canceled / Returned Orders</h2>
            <p className="text-gray-700 mb-3">
              Refunds are always processed using the same payment method used during the original purchase.
            </p>
            <ul className="list-disc pl-6 text-gray-700 space-y-1">
              <li>Wallet Refund: 1–3 business days</li>
              <li>Credit/Debit Card Refund: 3–7 business days</li>
              <li>COD Refund: To customer's bank account</li>
            </ul>
          </section>

        </div>
      </div>
    </div>
  );
}

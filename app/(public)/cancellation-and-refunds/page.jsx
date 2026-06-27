import PolicyPageLayout from '@/components/PolicyPageLayout';

export default function CancellationAndRefunds() {
  return (
    <PolicyPageLayout>
      <h1 className="text-3xl font-bold text-gray-900 mb-2">Cancellation & Refund Policy</h1>
      <p className="text-gray-600 mb-8">
        This policy applies to all purchases made on store1920.com across the United Arab Emirates.
      </p>

      <div className="space-y-6 border border-gray-200 rounded-xl p-6 text-gray-800">
        <section>
          <p>
            This Cancellation & Refund Policy applies to all purchases made on
            <strong> store1920.com</strong>, which is owned and operated by
            <strong> store1920</strong>. store1920 is a UAE-based e-commerce
            platform delivering products across the United Arab Emirates.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold mb-2">1. Order Cancellation</h2>
          <p className="mb-3">
            <strong>Before Shipment:</strong> Orders can be cancelled within
            <strong> 1–2 hours</strong> of placing the order or before the order is
            shipped. A full refund will be issued for all prepaid orders.
          </p>
          <p>
            <strong>After Shipment:</strong> Once the order has been shipped,
            cancellation is not possible. Customers may request a return after
            delivery, subject to eligibility conditions.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold mb-2">2. Return Eligibility</h2>
          <p className="mb-3">Returns are accepted only if the product received is:</p>
          <ul className="list-disc pl-6 mb-4">
            <li>Incorrect item delivered</li>
            <li>Damaged or defective product</li>
            <li>Product not matching the description shown on the website</li>
          </ul>
          <p>
            Customers must provide clear photos or videos as proof within
            <strong> 24–48 hours</strong> of delivery.
          </p>

          <h3 className="text-lg font-semibold mt-4 mb-2">Non-Returnable Items</h3>
          <ul className="list-disc pl-6">
            <li>Mobile phones, smartphones, tablets, laptops, and similar personal electronic devices that have been used, activated, or configured in any way</li>
            <li>Personal care products</li>
            <li>Food and perishable items</li>
            <li>Innerwear and hygiene-sensitive products</li>
            <li>Customized or personalized items</li>
            <li>Products clearly marked as “Non-Returnable”</li>
          </ul>
        </section>

        <section>
          <h2 className="text-xl font-semibold mb-2">3. Return Process</h2>
          <ol className="list-decimal pl-6">
            <li>Contact our support team with order details and issue description.</li>
            <li>Submit required photos or videos for verification.</li>
            <li>Once approved, return pickup will be arranged (where available).</li>
            <li>The product must be unused, unwashed, and returned in original packaging.</li>
            <li>Mobile phones, tablets, laptops, and similar devices are not eligible for return once activated or used.</li>
          </ol>
        </section>

        <section>
          <h2 className="text-xl font-semibold mb-2">4. Refund Policy</h2>
          <p className="mb-3">
            Refunds will be processed using the same payment method used during checkout.
          </p>
          <ul className="list-disc pl-6 mb-4">
            <li>Card payments</li>
            <li>Wallet / Bank transfer</li>
            <li>Credit / Debit Cards</li>
            <li>COD refunds will be transferred to the customer’s bank account</li>
          </ul>
          <p>
            Refunds are generally processed within
            <strong> 3–5 business days</strong> after successful inspection of the
            returned product.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold mb-2">5. Exchange Policy</h2>
          <p>
            Exchanges are allowed in cases of damaged products, incorrect items
            delivered, or size-related issues, subject to product availability.
          </p>
        </section>

        <section className="border-t border-gray-200 pt-4">
          <h2 className="text-xl font-semibold mb-2">6. Contact Information</h2>
          <p className="mb-2">For any cancellation, return, or refund-related queries, please contact us:</p>
          <p className="mb-1"><strong>Business Name:</strong> store1920</p>
          <p className="mb-1"><strong>Email:</strong> support@store1920.com</p>
          <p className="mb-1"><strong>Website:</strong> https://www.store1920.com</p>
          <p className="text-sm text-gray-600 mt-4">
            store1920 reserves the right to modify or update this policy at any
            time in accordance with operational or regulatory requirements in the UAE.
          </p>
        </section>
      </div>
    </PolicyPageLayout>
  );
}

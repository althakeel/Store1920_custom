'use client';

export default function ShippingPolicyPage() {
  return (
    <div className="bg-gray-50 max-w-[1450px] mx-auto">
      <div className="max-w-3xl mx-auto px-4 py-10 min-h-[60vh]">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">
          Shipping & Delivery Policy
        </h1>
        <p className="text-gray-600 mb-8">
          This Shipping & Delivery Policy explains how orders placed on{" "}
          <strong>Store1920.com</strong>, owned and operated by{" "}
          <strong>Store1920</strong>, are processed, shipped, and delivered.
        </p>

        <div className="space-y-6 bg-white border border-gray-200 rounded-xl p-6">

          {/* 1 */}
          <section>
            <h2 className="font-semibold text-gray-900 mb-2">
              1. Order Processing Time
            </h2>
            <p className="text-gray-700">
              Most orders are processed within{" "}
              <strong>1–2 business days</strong> after confirmation. During peak
              seasons, promotions, or high-volume periods, processing times may
              be slightly longer. Orders placed on Sundays or public holidays
              will be processed on the next business day.
            </p>
          </section>

          {/* 2 */}
          <section>
            <h2 className="font-semibold text-gray-900 mb-2">
              2. Shipping Methods & Delivery Timeline
            </h2>
            <p className="text-gray-700">
              Store1920 currently delivers products{" "}
              <strong>across all Emirates in the UAE</strong>. Delivery timelines depend on
              your location, product availability, and courier partner.
            </p>
            <ul className="list-disc ml-6 text-gray-700 mt-2">
              <li>
                <strong>Standard Delivery:</strong> 2–5 business days
              </li>
              <li>
                <strong>Express Delivery:</strong> 1–3 business days (available
                for select locations/products)
              </li>
            </ul>
            <p className="text-gray-700 mt-2">
              Delivery timelines shown at checkout are estimates and not
              guaranteed.
            </p>
          </section>

          {/* 3 */}
          <section>
            <h2 className="font-semibold text-gray-900 mb-2">
              3. Shipping Charges
            </h2>
            <p className="text-gray-700">
              Shipping charges vary based on product weight, category, and
              delivery location. All applicable shipping fees are{" "}
              <strong>clearly displayed at checkout</strong> before payment is
              completed.
            </p>
          </section>

          {/* 4 */}
          <section>
            <h2 className="font-semibold text-gray-900 mb-2">
              4. Order Tracking
            </h2>
            <p className="text-gray-700">
              Once your order is shipped, tracking details will be shared via{" "}
              <strong>SMS or email</strong>. You can also track your order anytime
              from the <strong>My Orders</strong> section on Store1920.com.
            </p>
          </section>

          {/* 5 */}
          <section>
            <h2 className="font-semibold text-gray-900 mb-2">
              5. Delivery Attempts
            </h2>
            <p className="text-gray-700">
              Courier partners will attempt delivery up to{" "}
              <strong>two times</strong>. If delivery fails due to customer
              unavailability or incorrect address details, the order may be
              returned to our warehouse. Re-delivery may incur additional
              charges.
            </p>
          </section>

          {/* 6 */}
          <section>
            <h2 className="font-semibold text-gray-900 mb-2">
              6. Damaged, Missing, or Incorrect Items
            </h2>
            <p className="text-gray-700">
              If you receive a damaged, defective, missing, or incorrect item,
              please contact us within <strong>48 hours</strong> of delivery with
              your <strong>Order ID</strong> and clear{" "}
              <strong>photos or videos</strong>.
            </p>
            <p className="text-gray-700 mt-1">
              📧 Email: <strong>support@Store1920.com</strong>
            </p>
          </section>

          {/* 7 */}
          <section>
            <h2 className="font-semibold text-gray-900 mb-2">
              7. Address & Contact Accuracy
            </h2>
            <p className="text-gray-700">
              Customers are responsible for providing accurate shipping address
              and contact details during checkout. Store1920 is not responsible
              for delivery failures caused by incorrect information.
            </p>
          </section>

          {/* 8 */}
          <section>
            <h2 className="font-semibold text-gray-900 mb-2">
              8. Delivery Restrictions
            </h2>
            <p className="text-gray-700">
              Certain products may have delivery restrictions due to size,
              weight, or courier limitations. If delivery is not possible, our
              team will contact you to arrange an alternative solution or refund.
            </p>
          </section>

          {/* 9 */}
          <section>
            <h2 className="font-semibold text-gray-900 mb-2">
              9. Delays Beyond Our Control
            </h2>
            <p className="text-gray-700">
              Delivery delays may occur due to weather conditions, courier
              issues, regional restrictions, or unforeseen circumstances.
              Store1920 shall not be held responsible for delays caused by
              external factors beyond our control.
            </p>
          </section>

          {/* 10 */}
          <section>
            <h2 className="font-semibold text-gray-900 mb-2">
              10. International Shipping
            </h2>
            <p className="text-gray-700">
              Currently, Store1920 delivers products{" "}
              <strong>only within the UAE</strong>. International shipping
              is not available at this time.
            </p>
          </section>

          {/* 11 */}
          <section className="border-t pt-4">
            <h2 className="font-semibold text-gray-900 mb-2">
              11. Contact Information
            </h2>
            <p className="text-gray-700">
              <strong>Business Name:</strong> Store1920
            </p>
            <p className="text-gray-700">
              <strong>Website:</strong> https://www.Store1920.com
            </p>
            <p className="text-gray-700">
              <strong>Email:</strong> support@Store1920.com
            </p>
            <p className="text-gray-700">
              <strong>Customer Support:</strong> support@Store1920.com
            </p>
          </section>

        </div>
      </div>
    </div>
  );
}

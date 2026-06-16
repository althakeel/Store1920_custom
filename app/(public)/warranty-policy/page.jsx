'use client';

import PolicyPageLayout from '@/components/PolicyPageLayout';

export default function WarrantyPolicyPage() {
  return (
    <PolicyPageLayout>
      <h1 className="text-3xl font-bold text-gray-900 mb-2">Warranty Policy</h1>
      <p className="text-gray-600 mb-8">Coverage and support for manufacturer and seller warranties.</p>

      <div className="space-y-6 border border-gray-200 rounded-xl p-6">
        <section>
          <h2 className="font-semibold text-gray-900 mb-2">1. Warranty Coverage</h2>
          <p className="text-gray-700">Many products include a manufacturer warranty. Coverage varies by brand and product category. Warranty terms are provided by the manufacturer or seller.</p>
        </section>
        <section>
          <h2 className="font-semibold text-gray-900 mb-2">2. Claim Process</h2>
          <p className="text-gray-700">To file a warranty claim, contact support@Store1920.com with your order ID, product serial (if applicable), and issue details. We’ll guide you to the authorized service center or process.</p>
        </section>
        <section>
          <h2 className="font-semibold text-gray-900 mb-2">3. Exclusions</h2>
          <p className="text-gray-700">Warranty generally excludes accidental damage, misuse, unauthorized repairs, and normal wear-and-tear. Specific exclusions depend on the brand’s policy.</p>
        </section>
      </div>
    </PolicyPageLayout>
  );
}

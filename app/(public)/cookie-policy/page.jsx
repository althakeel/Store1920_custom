'use client'

export default function CookiePolicyPage() {
  return (
    <div className="bg-gray-50">
      <div className="max-w-3xl mx-auto px-4 py-10 min-h-[60vh]">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Cookie Policy</h1>
        <p className="text-gray-600 mb-8">Information about the cookies and similar technologies we use on Store1920.com.</p>

        <div className="space-y-6 bg-white border border-gray-200 rounded-xl p-6">
          <section>
            <h2 className="font-semibold text-gray-900 mb-2">1. What Are Cookies?</h2>
            <p className="text-gray-700">Cookies are small text files stored on your device to help websites function, remember preferences, and analyze usage.</p>
          </section>
          <section>
            <h2 className="font-semibold text-gray-900 mb-2">2. Types of Cookies We Use</h2>
            <ul className="list-disc pl-5 text-gray-700 space-y-1">
              <li>Essential cookies for core site functions</li>
              <li>Preference cookies to remember choices</li>
              <li>Analytics cookies to understand usage and improve services</li>
              <li>Marketing cookies where applicable, to show relevant content</li>
            </ul>
          </section>
          <section>
            <h2 className="font-semibold text-gray-900 mb-2">3. Managing Cookies</h2>
            <p className="text-gray-700">You can manage cookies via your browser settings. Disabling certain cookies may affect site functionality.</p>
          </section>
          <section>
            <h2 className="font-semibold text-gray-900 mb-2">4. Updates</h2>
            <p className="text-gray-700">We may update this policy to reflect changes in technology or regulations.</p>
          </section>
        </div>
      </div>
    </div>
  );
}

'use client';

export default function PrivacyPolicyPage() {
  return (
    <div className="bg-gray-50">
      <div className="max-w-[1250px] mx-auto px-4 py-10 min-h-[60vh]">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">
          Privacy Policy
        </h1>
        <p className="text-gray-600 mb-8">
          This Privacy Policy explains how <strong>Store1920.com</strong>, owned
          and operated by <strong>Nilaas</strong>, collects, uses, stores, and
          protects your personal information when you use our website and
          services.
        </p>

        <div className="space-y-6 bg-white border border-gray-200 rounded-xl p-6">

          {/* 1 */}
          <section>
            <h2 className="font-semibold text-gray-900 mb-2">
              1. Information We Collect
            </h2>
            <p className="text-gray-700">
              We collect personal information you provide, such as your name,
              mobile number, email address, and delivery address. We also collect
              technical information including IP address, device type, browser
              details, and usage analytics. Payment details are securely handled
              by authorized third-party payment processors, and we do not store
              sensitive payment information on our servers.
            </p>
          </section>

          {/* 2 */}
          <section>
            <h2 className="font-semibold text-gray-900 mb-2">
              2. How We Use Your Information
            </h2>
            <p className="text-gray-700">
              Your information is used to process orders, authenticate users,
              send OTPs, provide customer support, personalize your experience,
              improve our platform, prevent fraud, and comply with legal or
              regulatory requirements.
            </p>
          </section>

          {/* 3 */}
          <section>
            <h2 className="font-semibold text-gray-900 mb-2">
              3. Sharing of Information
            </h2>
            <p className="text-gray-700">
              We share personal data only with trusted third-party service
              providers such as payment gateways, logistics partners, analytics
              services, and customer support tools, strictly for operational and
              legal purposes. We do not sell, rent, or trade your personal
              information.
            </p>
          </section>

          {/* 4 */}
          <section>
            <h2 className="font-semibold text-gray-900 mb-2">
              4. Cookies & Tracking Technologies
            </h2>
            <p className="text-gray-700">
              Cookies and similar technologies help us improve site
              functionality, remember user preferences, analyze traffic, and
              enhance overall user experience. You may disable cookies through
              your browser settings, but certain features of the website may not
              function properly.
            </p>
          </section>

          {/* 5 */}
          <section>
            <h2 className="font-semibold text-gray-900 mb-2">
              5. Data Security
            </h2>
            <p className="text-gray-700">
              We use industry-standard security measures including encrypted
              connections, secure servers, and access controls to protect your
              data. However, no method of transmission over the internet is
              completely secure.
            </p>
          </section>

          {/* 6 */}
          <section>
            <h2 className="font-semibold text-gray-900 mb-2">
              6. Your Rights
            </h2>
            <p className="text-gray-700">
              Subject to applicable laws, you may request access to, correction
              of, or deletion of your personal information. To make such a
              request, please contact us at{' '}
              <strong>support@Store1920.com</strong>.
            </p>
          </section>

          {/* 7 */}
          <section>
            <h2 className="font-semibold text-gray-900 mb-2">
              7. Data Retention
            </h2>
            <p className="text-gray-700">
              We retain your personal data only for as long as necessary to
              fulfill the purposes outlined in this policy, comply with legal
              obligations, resolve disputes, or enforce agreements.
            </p>
          </section>

          {/* 8 */}
          <section>
            <h2 className="font-semibold text-gray-900 mb-2">
              8. Children’s Privacy
            </h2>
            <p className="text-gray-700">
              Our services are not intended for individuals under the age of 18.
              We do not knowingly collect personal information from minors. If
              such data is identified, it will be deleted promptly.
            </p>
          </section>

          {/* 9 */}
          <section>
            <h2 className="font-semibold text-gray-900 mb-2">
              9. International Data Transfers
            </h2>
            <p className="text-gray-700">
              Some service providers may be located outside India or the UAE. In
              such cases, we ensure appropriate safeguards are in place to
              protect your data in accordance with applicable laws.
            </p>
          </section>

          {/* 10 */}
          <section>
            <h2 className="font-semibold text-gray-900 mb-2">
              10. Third-Party Links & Services
            </h2>
            <p className="text-gray-700">
              Our website may contain links to third-party websites or services.
              We are not responsible for their privacy practices and encourage
              you to review their policies before sharing any personal data.
            </p>
          </section>

          {/* 11 */}
          <section>
            <h2 className="font-semibold text-gray-900 mb-2">
              11. Changes to This Policy
            </h2>
            <p className="text-gray-700">
              Nilaas reserves the right to update this Privacy Policy at any time.
              Any changes will be posted on this page along with an updated
              &ldquo;Last Updated&rdquo; date.
            </p>
          </section>

          {/* Contact */}
          <section className="border-t pt-4">
            <h2 className="font-semibold text-gray-900 mb-2">
              12. Contact Information
            </h2>
            <p className="text-gray-700 mb-1">
              <strong>Business Name:</strong> Nilaas
            </p>
            <p className="text-gray-700 mb-1">
              <strong>Website:</strong> https://www.Store1920.com
            </p>
            <p className="text-gray-700 mb-1">
              <strong>Email:</strong> support@Store1920.com
            </p>
            <p className="text-gray-700">
              <strong>Customer Support:</strong> +91 7592875212
            </p>
          </section>

        </div>
      </div>
    </div>
  );
}

'use client';

import { useState } from 'react';
import { Send, Loader2, CheckCircle, AlertCircle } from 'lucide-react';

export default function SendTestEmailPage() {
  const [email, setEmail] = useState('');
  const [templateId, setTemplateId] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);

  const templates = [
    { id: 'buy-now-pay-later', name: 'Buy Now, Pay Later', emoji: '💳' },
    { id: 'price-dropped', name: 'Price Dropped', emoji: '⏬' },
    { id: 'limited-time-deals', name: 'Limited-Time Deals', emoji: '⚡' },
    { id: 'trending-now', name: 'Trending Now', emoji: '🔥' },
    { id: 'wishlist-cheaper', name: 'Your Wishlist Got Cheaper', emoji: '💝' },
    { id: 'selling-fast', name: 'Selling Fast!', emoji: '⚠️' },
    { id: 'best-finds', name: 'Today\'s Best Finds', emoji: '✨' },
    { id: 'flash-deals', name: 'Flash Deals Ending Soon', emoji: '⏰' },
    { id: 'smart-buys', name: 'Smart Buys at Better Prices', emoji: '🎯' },
    { id: 'popular-value', name: 'Popular Products, Better Value', emoji: '🌟' },
  ];

  const handleSendTest = async () => {
    if (!email) {
      setResult({ success: false, message: 'Please enter an email address' });
      return;
    }

    setLoading(true);
    setResult(null);

    try {
      const body = {
        customerEmails: [email],
        limit: 1
      };

      if (templateId) {
        body.templateId = templateId;
      }

      const response = await fetch('/api/promotional-emails', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      });

      const data = await response.json();

      if (response.ok) {
        setResult({
          success: true,
          message: `Test email sent successfully to ${email}!`,
          details: data,
        });
        setEmail('');
        setTemplateId('');
      } else {
        setResult({
          success: false,
          message: data.error || 'Failed to send test email',
        });
      }
    } catch (error) {
      setResult({
        success: false,
        message: 'Error sending test email: ' + error.message,
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-3xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            📨 Send Test Email
          </h1>
          <p className="text-gray-600">
            Test your promotional email templates by sending to your own email address
          </p>
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-8">
          {/* Email Input */}
          <div className="mb-6">
            <label className="block text-sm font-semibold text-gray-900 mb-2">
              Test Email Address *
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="your.email@example.com"
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
              disabled={loading}
            />
            <p className="mt-1 text-xs text-gray-500">
              Enter your email address to receive the test promotional email
            </p>
          </div>

          {/* Template Selection */}
          <div className="mb-6">
            <label className="block text-sm font-semibold text-gray-900 mb-2">
              Template (Optional)
            </label>
            <select
              value={templateId}
              onChange={(e) => setTemplateId(e.target.value)}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
              disabled={loading}
            >
              <option value="">Random Template</option>
              {templates.map((template) => (
                <option key={template.id} value={template.id}>
                  {template.emoji} {template.name}
                </option>
              ))}
            </select>
            <p className="mt-1 text-xs text-gray-500">
              Leave blank to send a random template, or select a specific one
            </p>
          </div>

          {/* Send Button */}
          <button
            onClick={handleSendTest}
            disabled={loading || !email}
            className={`w-full py-3 rounded-lg font-semibold text-white transition-all flex items-center justify-center gap-2 ${
              loading || !email
                ? 'bg-gray-400 cursor-not-allowed'
                : 'bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 shadow-lg hover:shadow-xl'
            }`}
          >
            {loading ? (
              <>
                <Loader2 className="animate-spin" size={20} />
                Sending...
              </>
            ) : (
              <>
                <Send size={20} />
                Send Test Email
              </>
            )}
          </button>

          {/* Result Message */}
          {result && (
            <div
              className={`mt-6 p-4 rounded-lg border ${
                result.success
                  ? 'bg-green-50 border-green-200'
                  : 'bg-red-50 border-red-200'
              }`}
            >
              <div className="flex items-start gap-3">
                {result.success ? (
                  <CheckCircle className="text-green-600 flex-shrink-0 mt-0.5" size={20} />
                ) : (
                  <AlertCircle className="text-red-600 flex-shrink-0 mt-0.5" size={20} />
                )}
                <div>
                  <p
                    className={`font-semibold ${
                      result.success ? 'text-green-900' : 'text-red-900'
                    }`}
                  >
                    {result.message}
                  </p>
                  {result.details && (
                    <div className="mt-2 text-sm text-gray-700">
                      <p>Emails sent: {result.details.sent || 0}</p>
                      {result.details.template && (
                        <p>Template used: {result.details.template}</p>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Info Cards */}
        <div className="mt-8 grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
            <h3 className="text-lg font-semibold text-blue-900 mb-3">
              ℹ️ What Gets Sent?
            </h3>
            <ul className="space-y-2 text-sm text-blue-800">
              <li>✅ Beautifully designed email template</li>
              <li>✅ Top 4 best-selling products from your store</li>
              <li>✅ Clickable product cards with images</li>
              <li>✅ Direct links to product pages</li>
              <li>✅ Professional Brandstored branding</li>
              <li>✅ Unsubscribe link (required for compliance)</li>
            </ul>
          </div>

          <div className="bg-amber-50 border border-amber-200 rounded-lg p-6">
            <h3 className="text-lg font-semibold text-amber-900 mb-3">
              ⚠️ Important Notes
            </h3>
            <ul className="space-y-2 text-sm text-amber-800">
              <li>• Check your spam/junk folder if email doesn't arrive</li>
              <li>• Test emails may take 1-2 minutes to deliver</li>
              <li>• Emails are sent from marketing@brandstored.com</li>
              <li>• Make sure your store has published products</li>
              <li>• Click product cards to verify links work</li>
              <li>• Test on both desktop and mobile</li>
            </ul>
          </div>
        </div>

        {/* Quick Links */}
        <div className="mt-8 flex gap-4">
          <a
            href="/store/email-templates"
            className="flex-1 text-center px-6 py-3 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 font-medium text-gray-700 transition"
          >
            Preview All Templates
          </a>
          <a
            href="/store"
            className="flex-1 text-center px-6 py-3 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 font-medium text-gray-700 transition"
          >
            Back to Dashboard
          </a>
        </div>

        {/* Additional Info */}
        <div className="mt-8 bg-gradient-to-r from-green-50 to-emerald-50 border border-green-200 rounded-lg p-6">
          <h3 className="text-lg font-semibold text-green-900 mb-3">
            🚀 Ready to Send to Customers?
          </h3>
          <p className="text-sm text-green-800 mb-4">
            Once you've tested and verified the emails look perfect, they will automatically 
            be sent to all your customers daily at 4:30 PM. You can also manually send 
            promotional emails through the API.
          </p>
          <div className="flex gap-3">
            <a
              href="/api/promotional-emails"
              target="_blank"
              className="text-sm text-green-700 underline hover:text-green-900"
            >
              API Documentation
            </a>
            <span className="text-gray-400">•</span>
            <a
              href="/PROMOTIONAL_EMAIL_TEMPLATES_GUIDE.md"
              target="_blank"
              className="text-sm text-green-700 underline hover:text-green-900"
            >
              Complete Guide
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}

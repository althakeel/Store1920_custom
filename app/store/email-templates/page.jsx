'use client';

import { useState, useEffect } from 'react';
import { promotionalTemplates } from '@/lib/promotionalEmailTemplates';

export default function EmailTemplatesPreview() {
  const [selectedTemplate, setSelectedTemplate] = useState(promotionalTemplates[0]);
  const [previewHtml, setPreviewHtml] = useState('');
  const [realProducts, setRealProducts] = useState([]);
  const [loading, setLoading] = useState(true);

  // Fetch real products from the backend
  useEffect(() => {
    const fetchProducts = async () => {
      try {
        const response = await fetch('/api/products?limit=4');
        const data = await response.json();
        if (data.products && Array.isArray(data.products)) {
          setRealProducts(data.products);
        }
      } catch (error) {
        console.error('Failed to fetch products:', error);
        setRealProducts([]);
      } finally {
        setLoading(false);
      }
    };
    
    fetchProducts();
  }, []);

  useEffect(() => {
    if (selectedTemplate && realProducts.length > 0) {
      // Map real products to the format expected by templates
      const mappedProducts = realProducts.map(p => ({
        id: p._id?.toString() || p.id,
        slug: p.slug,
        name: p.name,
        description: p.description || '',
        category: p.category || 'Product',
        price: p.salePrice || p.price,
        originalPrice: p.salePrice ? p.price : null,
        image: p.images?.[0] || p.image,
        images: p.images || [],
        stock: p.stock || 0,
        sold: p.sold || 0,
        rating: p.rating || 0,
        reviews: p.reviews || 0
      }));
      
      const html = selectedTemplate.template(mappedProducts, 'customer@example.com');
      setPreviewHtml(html);
    }
  }, [selectedTemplate, realProducts]);

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-7xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            📧 Email Templates Preview
          </h1>
          <p className="text-gray-600">
            Preview your promotional email templates with actual products from your store
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Template Selection Sidebar */}
          <div className="lg:col-span-1">
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
              <h2 className="text-lg font-semibold mb-4 text-gray-900">Templates</h2>
              <div className="space-y-2">
                {promotionalTemplates.map((template) => (
                  <button
                    key={template.id}
                    onClick={() => setSelectedTemplate(template)}
                    className={`w-full text-left p-3 rounded-lg transition-all ${
                      selectedTemplate.id === template.id
                        ? 'bg-green-50 border-2 border-green-500 shadow-sm'
                        : 'bg-gray-50 border border-gray-200 hover:bg-gray-100'
                    }`}
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-2xl">{template.emoji}</span>
                      <span className="font-semibold text-sm text-gray-900">
                        {template.title}
                      </span>
                    </div>
                    <p className="text-xs text-gray-600 line-clamp-2">
                      {template.content}
                    </p>
                  </button>
                ))}
              </div>
            </div>

            {/* Template Info */}
            {selectedTemplate && (
              <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 mt-4">
                <h3 className="font-semibold mb-3 text-gray-900">Template Details</h3>
                <div className="space-y-2 text-sm">
                  <div>
                    <span className="text-gray-600">Subject:</span>
                    <p className="font-medium text-gray-900">{selectedTemplate.subject}</p>
                  </div>
                  <div>
                    <span className="text-gray-600">Theme Color:</span>
                    <div className="flex items-center gap-2 mt-1">
                      <div
                        className="w-8 h-8 rounded border"
                        style={{ backgroundColor: selectedTemplate.color }}
                      />
                      <span className="font-mono text-xs">{selectedTemplate.color}</span>
                    </div>
                  </div>
                  <div>
                    <span className="text-gray-600">CTA:</span>
                    <p className="font-medium text-gray-900">{selectedTemplate.cta}</p>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Email Preview */}
          <div className="lg:col-span-3">
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
              <div className="bg-gradient-to-r from-green-500 to-emerald-600 px-6 py-4">
                <h2 className="text-xl font-semibold text-white flex items-center gap-2">
                  <span>📱</span> Email Preview
                </h2>
                <p className="text-green-50 text-sm mt-1">
                  This is how your email will look in customers' inboxes
                </p>
              </div>
              
              {/* Email Client Mockup */}
              <div className="p-6 bg-gray-50">
                <div className="bg-white rounded-t-lg border border-gray-200 overflow-hidden">
                  <div className="bg-gray-100 border-b border-gray-200 p-4">
                    <div className="flex items-center gap-3 mb-2">
                      <div className="w-10 h-10 rounded-full bg-green-500 flex items-center justify-center text-white font-bold">
                        Q
                      </div>
                      <div>
                        <p className="font-semibold text-gray-900">Brandstored</p>
                        <p className="text-xs text-gray-600">marketing@brandstored.com</p>
                      </div>
                    </div>
                    <h3 className="font-semibold text-gray-900">
                      {selectedTemplate?.subject}
                    </h3>
                  </div>
                  
                  {/* Email Content Preview */}
                  <div className="overflow-auto" style={{ maxHeight: 'calc(100vh - 400px)' }}>
                    <iframe
                      srcDoc={previewHtml}
                      title="Email Preview"
                      className="w-full"
                      style={{ minHeight: '800px', border: 'none' }}
                    />
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="bg-gray-50 px-6 py-4 border-t border-gray-200">
                <div className="flex gap-3">
                  <button
                    onClick={() => {
                      const blob = new Blob([previewHtml], { type: 'text/html' });
                      const url = URL.createObjectURL(blob);
                      const a = document.createElement('a');
                      a.href = url;
                      a.download = `${selectedTemplate.id}-template.html`;
                      a.click();
                    }}
                    className="px-4 py-2 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 text-sm font-medium text-gray-700"
                  >
                    📥 Download HTML
                  </button>
                  <button
                    onClick={() => {
                      const newWindow = window.open('', '_blank');
                      newWindow.document.write(previewHtml);
                      newWindow.document.close();
                    }}
                    className="px-4 py-2 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 text-sm font-medium text-gray-700"
                  >
                    🔍 Open in New Tab
                  </button>
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(previewHtml);
                      alert('HTML copied to clipboard!');
                    }}
                    className="px-4 py-2 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 text-sm font-medium text-gray-700"
                  >
                    📋 Copy HTML
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Sample Products Display */}
        <div className="mt-8 bg-blue-50 border border-blue-200 rounded-lg p-6">
          <h3 className="text-lg font-semibold text-blue-900 mb-3">ℹ️ How It Works</h3>
          <ul className="space-y-2 text-sm text-blue-800">
            <li>✅ <strong>Clickable Product Cards:</strong> Each product in the email is fully clickable and links to the product page</li>
            <li>✅ <strong>Responsive Design:</strong> Templates look great on desktop, tablet, and mobile devices</li>
            <li>✅ <strong>Dynamic Content:</strong> Products are fetched automatically from your store based on sales performance</li>
            <li>✅ <strong>Discount Badges:</strong> Sale prices automatically show discount percentages</li>
            <li>✅ <strong>Brand Consistency:</strong> All emails maintain Brandstored branding with consistent colors and style</li>
            <li>✅ <strong>Unsubscribe Link:</strong> Every email includes an unsubscribe option for compliance</li>
          </ul>
        </div>
      </div>
    </div>
  );
}

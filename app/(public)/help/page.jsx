'use client'

import { useState } from 'react'
import Link from 'next/link'

export default function HelpPage() {
  const [activeCategory, setActiveCategory] = useState('getting-started')
  const [expandedItem, setExpandedItem] = useState(null)

  const helpCategories = [
    { id: 'getting-started', title: '🚀 Getting Started', icon: '🚀' },
    { id: 'shopping', title: '🛍️ Shopping', icon: '🛍️' },
    { id: 'orders', title: '📦 Orders & Delivery', icon: '📦' },
    { id: 'payments', title: '💳 Payments', icon: '💳' },
    { id: 'returns', title: '↩️ Returns & Refunds', icon: '↩️' },
    { id: 'account', title: '👤 Account', icon: '👤' },
  ]

  const helpContent = {
    'getting-started': [
      {
        question: 'How do I create an account?',
        answer: 'Click on "Sign Up" at the top right, enter your email and create a password. You can also sign up using your Google account for faster registration.'
      },
      {
        question: 'How do I reset my password?',
        answer: 'Go to the login page and click "Forgot Password?". Enter your email, and we\'ll send you a link to reset your password within minutes.'
      },
      {
        question: 'Can I use store1920 without an account?',
        answer: 'You can browse products without an account, but you need to create one to make a purchase or track orders.'
      }
    ],
    'shopping': [
      {
        question: 'How do I search for products?',
        answer: 'Use the search bar at the top, enter keywords, or browse by categories. You can also filter by price, ratings, and delivery speed.'
      },
      {
        question: 'How do I add items to my wishlist?',
        answer: 'Click the heart icon on any product page. You can manage your wishlist from your account dashboard anytime.'
      },
      {
        question: 'Can I save items for later?',
        answer: 'Yes! Add items to your wishlist or cart. Your cart items are saved for 30 days if you don\'t check out.'
      },
      {
        question: 'How do I apply a coupon code?',
        answer: 'During checkout, click "Apply Coupon" and enter your code. The discount will be applied instantly if the code is valid.'
      }
    ],
    'orders': [
      {
        question: 'How can I track my order?',
        answer: 'Go to "My Orders" in your account or click the "Track" button on the order confirmation email. You\'ll see real-time updates.'
      },
      {
        question: 'What are the delivery timeframes?',
        answer: 'Standard delivery: 3-5 business days. Fast delivery: 1-2 business days. Delivery times are estimated at checkout.'
      },
      {
        question: 'Can I change my delivery address?',
        answer: 'You can change your address within 1 hour of placing the order. After that, contact our support team.'
      },
      {
        question: 'Do you deliver on weekends?',
        answer: 'Yes! We deliver 7 days a week. Weekend deliveries may take an extra day depending on your location.'
      }
    ],
    'payments': [
      {
        question: 'What payment methods do you accept?',
        answer: 'We accept credit/debit cards, UPI, net banking, digital wallets, and cash on delivery (where available).'
      },
      {
        question: 'Is my payment information secure?',
        answer: 'Absolutely! We use industry-standard SSL encryption and PCI-DSS compliance to protect your data.'
      },
      {
        question: 'Why was my payment declined?',
        answer: 'This could be due to insufficient funds, incorrect details, or bank restrictions. Try another payment method or contact your bank.'
      },
      {
        question: 'Can I pay using cryptocurrencies?',
        answer: 'Currently, we don\'t accept cryptocurrencies, but we\'re exploring this option for future updates.'
      }
    ],
    'returns': [
      {
        question: 'What is your return policy?',
        answer: 'You can return most items within 30 days of delivery for a full refund or exchange.'
      },
      {
        question: 'How do I initiate a return?',
        answer: 'Go to "My Orders", find the item, and click "Return". Follow the steps and arrange a pickup.'
      },
      {
        question: 'When will I get my refund?',
        answer: 'Refunds are processed within 5-7 business days after we receive and inspect the returned item.'
      },
      {
        question: 'Can I return items without opening them?',
        answer: 'Yes, unopened items in original packaging are eligible for return. Some items have restrictions; check our return policy.'
      }
    ],
    'account': [
      {
        question: 'How do I update my profile information?',
        answer: 'Go to "My Profile", click "Edit", make your changes, and save. Updates take effect immediately.'
      },
      {
        question: 'Can I delete my account?',
        answer: 'Yes, you can request account deletion from Settings. Your data will be deleted within 30 days.'
      },
      {
        question: 'How do I view my address book?',
        answer: 'Go to "My Profile" > "Addresses" to view, add, edit, or delete saved addresses.'
      },
      {
        question: 'How can I become a seller?',
        answer: 'Click "Create Your Store" to start the seller registration. You\'ll need business documents and bank details.'
      }
    ]
  }

  const currentCategory = helpContent[activeCategory] || []

  return (
    <div className="bg-gradient-to-b from-slate-50 to-white">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-600 to-blue-700 text-white py-12 px-4">
        <div className="max-w-6xl mx-auto">
          <h1 className="text-4xl font-bold mb-3">Help Center</h1>
          <p className="text-blue-100 text-lg">Find answers to your questions and get support</p>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 py-12">
        {/* Search Bar */}
        <div className="mb-12">
          <div className="relative max-w-2xl">
            <input
              type="text"
              placeholder="Search help articles..."
              className="w-full px-6 py-3 rounded-lg border-2 border-slate-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none transition"
            />
            <button className="absolute right-3 top-3 bg-blue-600 hover:bg-blue-700 text-white px-4 py-1 rounded transition">
              Search
            </button>
          </div>
        </div>

        <div className="grid lg:grid-cols-4 gap-8">
          {/* Sidebar Categories */}
          <div className="lg:col-span-1">
            <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm sticky top-20">
              <h3 className="font-bold text-slate-800 mb-4">Categories</h3>
              <div className="space-y-2">
                {helpCategories.map((cat) => (
                  <button
                    key={cat.id}
                    onClick={() => setActiveCategory(cat.id)}
                    className={`w-full text-left px-4 py-3 rounded-lg transition ${
                      activeCategory === cat.id
                        ? 'bg-blue-100 text-blue-700 font-semibold'
                        : 'text-slate-700 hover:bg-slate-100'
                    }`}
                  >
                    {cat.icon} {cat.title.split(' ')[1]}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Main Content */}
          <div className="lg:col-span-3">
            <div className="space-y-4">
              <h2 className="text-3xl font-bold text-slate-800 mb-8">
                {helpCategories.find(c => c.id === activeCategory)?.title}
              </h2>

              {currentCategory.map((item, idx) => (
                <div
                  key={idx}
                  className="bg-white rounded-xl border border-slate-200 shadow-sm hover:shadow-md transition"
                >
                  <button
                    onClick={() => setExpandedItem(expandedItem === idx ? null : idx)}
                    className="w-full px-6 py-4 flex justify-between items-center text-left hover:bg-slate-50 transition"
                  >
                    <h3 className="font-semibold text-slate-800 text-lg">{item.question}</h3>
                    <span
                      className={`text-2xl transition-transform ${
                        expandedItem === idx ? 'rotate-180' : ''
                      }`}
                    >
                      ▼
                    </span>
                  </button>

                  {expandedItem === idx && (
                    <div className="px-6 pb-4 pt-2 border-t border-slate-200 text-slate-700 bg-slate-50">
                      {item.answer}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Contact Support Section */}
        <div className="mt-16 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-2xl border border-blue-200 p-8">
          <div className="grid md:grid-cols-3 gap-8 text-center">
            <div>
              <div className="text-4xl mb-3">📧</div>
              <h3 className="font-bold text-slate-800 mb-2">Email Support</h3>
              <p className="text-slate-600 mb-4">Get help within 24 hours</p>
              <a href="mailto:support@store1920.com" className="text-blue-600 hover:underline font-medium">
                support@store1920.com
              </a>
            </div>
            <div>
              <div className="text-4xl mb-3">💬</div>
              <h3 className="font-bold text-slate-800 mb-2">Live Chat</h3>
              <p className="text-slate-600 mb-4">Chat with us in real-time</p>
              <a href="/support" className="text-blue-600 hover:underline font-medium">
                Start Chat
              </a>
            </div>
            <div>
              <div className="text-4xl mb-3">☎️</div>
              <h3 className="font-bold text-slate-800 mb-2">Call Us</h3>
              <p className="text-slate-600 mb-4">Monday-Friday, 9am-6pm</p>
              <p className="text-blue-600 font-medium">+1-800-QUICK-FYND</p>
            </div>
          </div>
        </div>

        {/* Navigation Links */}
        <div className="mt-12 text-center">
          <p className="text-slate-600 mb-4">Can't find what you're looking for?</p>
          <div className="flex flex-wrap justify-center gap-4">
            <Link href="/faq" className="px-6 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-lg transition font-medium">
              FAQ
            </Link>
            <Link href="/support" className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition font-medium">
              Contact Support
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

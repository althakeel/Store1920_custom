"use client";

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { getAuth } from 'firebase/auth';
import toast from 'react-hot-toast';
import PageTitle from '@/components/PageTitle';

export default function SettingsPage() {
  const [settings, setSettings] = useState({
    emailNotifications: true,
    smsNotifications: false,
    orderUpdates: true,
    promotionalEmails: false,
    newsletter: true,
    language: 'en',
    currency: 'AED'
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const router = useRouter();
  const auth = getAuth();

  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged((user) => {
      if (!user) {
        router.push('/sign-in');
      } else {
        fetchSettings(user.uid);
      }
    });
    return () => unsubscribe();
  }, [auth, router]);

  const fetchSettings = async (userId) => {
    try {
      setLoading(true);
      const response = await fetch(`/api/user-settings?userId=${userId}`);
      if (response.ok) {
        const data = await response.json();
        setSettings(prev => ({ ...prev, ...data.settings }));
      }
    } catch (error) {
      console.error('Error fetching settings:', error);
      toast.error('Failed to load settings');
    } finally {
      setLoading(false);
    }
  };

  const handleToggle = (key) => {
    setSettings(prev => ({
      ...prev,
      [key]: !prev[key]
    }));
  };

  const handleSelectChange = (key, value) => {
    setSettings(prev => ({
      ...prev,
      [key]: value
    }));
  };

  const handleSave = async () => {
    const user = auth.currentUser;
    
    if (!user) {
      toast.error('Please sign in first');
      return;
    }

    try {
      setSaving(true);
      const response = await fetch('/api/user-settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user.uid,
          settings
        })
      });

      if (response.ok) {
        toast.success('Settings saved successfully');
      } else {
        toast.error('Failed to save settings');
      }
    } catch (error) {
      console.error('Error saving settings:', error);
      toast.error('Error saving settings');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 py-8 px-4 flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-600">Loading settings...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4">
      <PageTitle title="Account Settings" />
      
      <div className="max-w-2xl mx-auto">
        <h1 className="text-3xl font-bold text-gray-900 mb-8">Account Settings</h1>

        {/* Notification Preferences */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <h2 className="text-xl font-bold text-gray-900 mb-4">Notification Preferences</h2>
          
          <div className="space-y-4">
            <div className="flex items-center justify-between py-3 border-b border-gray-200">
              <div>
                <p className="font-medium text-gray-900">Email Notifications</p>
                <p className="text-sm text-gray-600">Receive updates via email</p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={settings.emailNotifications}
                  onChange={() => handleToggle('emailNotifications')}
                  className="sr-only peer"
                />
                <div className={`w-11 h-6 rounded-full transition ${
                  settings.emailNotifications ? 'bg-blue-600' : 'bg-gray-300'
                }`} />
                <span className={`absolute left-1 w-4 h-4 bg-white rounded-full transition ${
                  settings.emailNotifications ? 'translate-x-5' : ''
                }`} />
              </label>
            </div>

            <div className="flex items-center justify-between py-3 border-b border-gray-200">
              <div>
                <p className="font-medium text-gray-900">SMS Notifications</p>
                <p className="text-sm text-gray-600">Receive updates via SMS</p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={settings.smsNotifications}
                  onChange={() => handleToggle('smsNotifications')}
                  className="sr-only peer"
                />
                <div className={`w-11 h-6 rounded-full transition ${
                  settings.smsNotifications ? 'bg-blue-600' : 'bg-gray-300'
                }`} />
                <span className={`absolute left-1 w-4 h-4 bg-white rounded-full transition ${
                  settings.smsNotifications ? 'translate-x-5' : ''
                }`} />
              </label>
            </div>

            <div className="flex items-center justify-between py-3 border-b border-gray-200">
              <div>
                <p className="font-medium text-gray-900">Order Updates</p>
                <p className="text-sm text-gray-600">Get notified about your order status</p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={settings.orderUpdates}
                  onChange={() => handleToggle('orderUpdates')}
                  className="sr-only peer"
                />
                <div className={`w-11 h-6 rounded-full transition ${
                  settings.orderUpdates ? 'bg-blue-600' : 'bg-gray-300'
                }`} />
                <span className={`absolute left-1 w-4 h-4 bg-white rounded-full transition ${
                  settings.orderUpdates ? 'translate-x-5' : ''
                }`} />
              </label>
            </div>

            <div className="flex items-center justify-between py-3 border-b border-gray-200">
              <div>
                <p className="font-medium text-gray-900">Promotional Emails</p>
                <p className="text-sm text-gray-600">Receive special offers and deals</p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={settings.promotionalEmails}
                  onChange={() => handleToggle('promotionalEmails')}
                  className="sr-only peer"
                />
                <div className={`w-11 h-6 rounded-full transition ${
                  settings.promotionalEmails ? 'bg-blue-600' : 'bg-gray-300'
                }`} />
                <span className={`absolute left-1 w-4 h-4 bg-white rounded-full transition ${
                  settings.promotionalEmails ? 'translate-x-5' : ''
                }`} />
              </label>
            </div>

            <div className="flex items-center justify-between py-3">
              <div>
                <p className="font-medium text-gray-900">Newsletter</p>
                <p className="text-sm text-gray-600">Subscribe to our weekly newsletter</p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={settings.newsletter}
                  onChange={() => handleToggle('newsletter')}
                  className="sr-only peer"
                />
                <div className={`w-11 h-6 rounded-full transition ${
                  settings.newsletter ? 'bg-blue-600' : 'bg-gray-300'
                }`} />
                <span className={`absolute left-1 w-4 h-4 bg-white rounded-full transition ${
                  settings.newsletter ? 'translate-x-5' : ''
                }`} />
              </label>
            </div>
          </div>
        </div>

        {/* Preferences */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <h2 className="text-xl font-bold text-gray-900 mb-4">Preferences</h2>
          
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-900 mb-2">
                Language
              </label>
              <select
                value={settings.language}
                onChange={(e) => handleSelectChange('language', e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-blue-500"
              >
                <option value="en">English</option>
                <option value="hi">Hindi</option>
                <option value="es">Spanish</option>
                <option value="fr">French</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-900 mb-2">
                Currency
              </label>
              <select
                value={settings.currency}
                onChange={(e) => handleSelectChange('currency', e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-blue-500"
              >
                <option value="AED">UAE Dirhams (AED)</option>
                <option value="USD">US Dollars ($)</option>
                <option value="EUR">Euro (€)</option>
                <option value="GBP">British Pounds (£)</option>
              </select>
            </div>
          </div>
        </div>

        {/* Save Button */}
        <div className="flex gap-4">
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex-1 bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition font-medium disabled:opacity-50"
          >
            {saving ? 'Saving...' : 'Save Settings'}
          </button>
          <button
            onClick={() => router.back()}
            className="flex-1 bg-gray-300 text-gray-800 px-6 py-3 rounded-lg hover:bg-gray-400 transition font-medium"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

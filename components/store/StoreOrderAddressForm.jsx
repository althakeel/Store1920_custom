'use client';

import { useMemo } from 'react';
import { countryCodes } from '@/assets/countryCodes';
import { indiaStatesAndDistricts } from '@/assets/indiaStatesAndDistricts';
import SearchableSelect from '@/components/SearchableSelect';
import PhoneNumberField from '@/components/PhoneNumberField';
import {
  UAE_EMIRATES,
  getUaeAreaOptionsForEmirate,
  isUaeCountry,
} from '@/lib/uaeEmirateAreas';

const fieldClass =
  'w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100';

const selectClass =
  'w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-left text-sm text-slate-900 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100';

function getCountryOptions() {
  return countryCodes.map((entry) => entry.label.replace(/ \(.*\)/, ''));
}

function getCountryCode(countryName) {
  const match = countryCodes.find((entry) => entry.label.replace(/ \(.*\)/, '') === countryName);
  return match?.code || '+971';
}

export default function StoreOrderAddressForm({
  form,
  onChange,
  invalidFieldIds = new Set(),
}) {
  const districts = useMemo(() => {
    if (form.country !== 'India' || !form.state) return [];
    const stateData = indiaStatesAndDistricts.find((entry) => entry.state === form.state);
    return stateData?.districts || [];
  }, [form.country, form.state]);

  const hasError = (id) => invalidFieldIds.has(id);
  const errorClass = (id) => (hasError(id) ? 'border-red-400 ring-2 ring-red-100' : '');

  const updateField = (name, value) => {
    onChange((current) => ({ ...current, [name]: value }));
  };

  const handleCountryChange = (country) => {
    onChange((current) => ({
      ...current,
      country,
      phoneCode: getCountryCode(country),
      state: isUaeCountry(country) ? 'Dubai' : country === 'India' ? '' : current.state,
      district: '',
      pincode: '',
    }));
  };

  const handleStateChange = (state) => {
    onChange((current) => ({
      ...current,
      state,
      district: '',
      city: '',
    }));
  };

  return (
    <div className="space-y-5">
      <div>
        <h3 className="text-sm font-semibold text-slate-900">Contact details</h3>
        <p className="mt-0.5 text-xs text-slate-500">Same fields customers fill at checkout.</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div id="store-order-name">
          <label className="mb-1 block text-xs font-medium text-slate-600">Full name</label>
          <input
            className={`${fieldClass} ${errorClass('guest-name')}`}
            value={form.name || ''}
            onChange={(e) => updateField('name', e.target.value)}
            placeholder="Customer name"
            required
          />
        </div>
        <div id="store-order-email">
          <label className="mb-1 block text-xs font-medium text-slate-600">Email</label>
          <input
            type="email"
            className={`${fieldClass} ${errorClass('guest-email')}`}
            value={form.email || ''}
            onChange={(e) => updateField('email', e.target.value)}
            placeholder="customer@email.com"
            required
          />
        </div>
      </div>

      <div id="store-order-phone">
        <PhoneNumberField
          label="Phone number"
          phone={form.phone}
          phoneCode={form.phoneCode}
          onPhoneChange={(value) => updateField('phone', value)}
          onPhoneCodeChange={(e) => updateField('phoneCode', e.target.value)}
          countryOptions={countryCodes.map((entry) => ({ code: entry.code }))}
          inputClassName={`flex-1 ${fieldClass} ${errorClass('guest-phone')}`}
          selectClassName="rounded-lg border border-slate-200 bg-white px-2 py-2.5 text-sm"
        />
      </div>

      <div>
        <h3 className="text-sm font-semibold text-slate-900">Delivery address</h3>
        <p className="mt-0.5 text-xs text-slate-500">Emirate and area first, then street — same order as checkout.</p>
      </div>

      <div className={`grid gap-4 ${isUaeCountry(form.country) && form.state ? 'sm:grid-cols-2' : ''}`}>
        <div id="store-order-state">
          <label className="mb-1 block text-xs font-medium text-slate-600">
            {isUaeCountry(form.country) ? 'Emirate' : 'State / Emirate'}
          </label>
          {form.country === 'India' ? (
            <SearchableSelect
              value={form.state}
              onChange={handleStateChange}
              options={indiaStatesAndDistricts.map((entry) => entry.state)}
              placeholder="Select state"
              searchPlaceholder="Search state..."
              hasError={hasError('guest-state')}
              triggerClassName={`${selectClass} ${errorClass('guest-state')}`}
            />
          ) : isUaeCountry(form.country) ? (
            <SearchableSelect
              value={form.state}
              onChange={handleStateChange}
              options={UAE_EMIRATES}
              placeholder="Select emirate"
              searchPlaceholder="Search emirate..."
              hasError={hasError('guest-state')}
              triggerClassName={`${selectClass} ${errorClass('guest-state')}`}
            />
          ) : (
            <input
              className={`${fieldClass} ${errorClass('guest-state')}`}
              value={form.state || ''}
              onChange={(e) => updateField('state', e.target.value)}
              placeholder="State / emirate"
              required
            />
          )}
        </div>

        {isUaeCountry(form.country) && form.state ? (
          <div id="store-order-area">
            <label className="mb-1 block text-xs font-medium text-slate-600">Area</label>
            <SearchableSelect
              value={form.district}
              onChange={(value) => updateField('district', value)}
              options={getUaeAreaOptionsForEmirate(form.state, form.district)}
              placeholder="Select area"
              searchPlaceholder="Search area..."
              emptyMessage="No areas found"
              allowCustomValue
              formatCustomOption={(area) => `Use "${area}"`}
              hasError={hasError('guest-area')}
              triggerClassName={`${selectClass} ${errorClass('guest-area')}`}
            />
            <p className="mt-1 text-xs text-slate-500">Building, villa, or street number goes in the field below.</p>
          </div>
        ) : null}
      </div>

      <div id="store-order-street">
        <label className="mb-1 block text-xs font-medium text-slate-600">Full address line</label>
        <input
          className={`${fieldClass} ${errorClass('guest-street')}`}
          value={form.street || ''}
          onChange={(e) => updateField('street', e.target.value)}
          placeholder="Building, villa, street number"
          required
        />
        <p className="mt-1 text-xs text-slate-500">Do not put the area name here — select it above.</p>
      </div>

      {form.country === 'India' && form.state ? (
        <div id="store-order-district">
          <label className="mb-1 block text-xs font-medium text-slate-600">District</label>
          <select
            className={`${fieldClass} ${errorClass('guest-district')}`}
            value={form.district || ''}
            onChange={(e) => updateField('district', e.target.value)}
            required
          >
            <option value="">Select district</option>
            {districts.map((district) => (
              <option key={district} value={district}>{district}</option>
            ))}
          </select>
        </div>
      ) : null}

      {form.country === 'India' ? (
        <div id="store-order-pincode" className="sm:max-w-xs">
          <label className="mb-1 block text-xs font-medium text-slate-600">Pincode</label>
          <input
            className={`${fieldClass} ${errorClass('guest-pincode')}`}
            value={form.pincode || ''}
            onChange={(e) => updateField('pincode', e.target.value)}
            inputMode="numeric"
            maxLength={6}
            placeholder="6-digit pincode"
          />
        </div>
      ) : null}

      <div id="store-order-country">
        <label className="mb-1 block text-xs font-medium text-slate-600">Country</label>
        <SearchableSelect
          value={form.country}
          onChange={handleCountryChange}
          options={getCountryOptions()}
          placeholder="Select country"
          searchPlaceholder="Search country..."
          hasError={hasError('guest-country')}
          triggerClassName={`${selectClass} ${errorClass('guest-country')}`}
        />
      </div>
    </div>
  );
}

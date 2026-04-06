"use client";

import { useState } from "react";

export default function CareersForm() {
  const [form, setForm] = useState({ name: "", email: "", message: "" });
  const [submitted, setSubmitted] = useState(false);

  const handleChange = (event) => {
    const { name, value } = event.target;
    setForm((currentForm) => ({
      ...currentForm,
      [name]: value,
    }));
  };

  const handleSubmit = (event) => {
    event.preventDefault();
    setSubmitted(true);
  };

  if (submitted) {
    return (
      <div className="bg-green-100 border border-green-300 text-green-800 rounded-lg p-6 text-center">
        Thank you for your interest! We have received your application.
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5 bg-white shadow rounded-lg p-8">
      <div>
        <label className="block text-sm font-medium mb-1" htmlFor="name">Full Name</label>
        <input type="text" id="name" name="name" required className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:border-orange-500 focus:ring-1 focus:ring-orange-500" value={form.name} onChange={handleChange} />
      </div>
      <div>
        <label className="block text-sm font-medium mb-1" htmlFor="email">Email Address (optional)</label>
        <input type="email" id="email" name="email" className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:border-orange-500 focus:ring-1 focus:ring-orange-500" value={form.email} onChange={handleChange} />
      </div>
      <div>
        <label className="block text-sm font-medium mb-1" htmlFor="message">Cover Letter / Message</label>
        <textarea id="message" name="message" rows={5} required className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:border-orange-500 focus:ring-1 focus:ring-orange-500" value={form.message} onChange={handleChange} />
      </div>
      <button type="submit" className="w-full bg-orange-500 hover:bg-orange-600 text-white font-bold py-3 rounded-lg transition">Submit Application</button>
    </form>
  );
}
import CareersForm from "./CareersForm";

export default function CareersPage() {
  return (
    <div className="max-w-2xl mx-auto py-16 px-4">
      <h1 className="text-3xl font-bold mb-6">Careers at Store1920.com</h1>
      <p className="mb-8 text-lg text-gray-700">We're always looking for passionate, talented, and driven individuals. Submit your details and we'll get in touch if there's a fit!</p>
      <CareersForm />
    </div>
  );
}

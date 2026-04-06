import { MailIcon, InfoIcon } from "lucide-react";

export default function SupportBar() {
  return (
    <div className="w-full bg-[#f7f8fa] border-t border-gray-200 py-4 md:py-6 px-2 text-gray-700 text-sm">
      <div className="max-w-[1240px] mx-auto flex flex-col md:flex-row items-center justify-between gap-4 md:gap-0">

        {/* Left Text (Hidden on Mobile) */}
        <div className="hidden md:block">
          <div className="font-semibold text-lg text-gray-800 mb-1">
            We're Always Here To Help
          </div>
          <div className="text-gray-500 text-sm">
            Reach out to us through our support email
          </div>
        </div>

        {/* Support Email */}
        <div className="flex items-center gap-3 px-4 py-2 rounded-lg">
          <MailIcon size={20} className="text-gray-400 flex-shrink-0" />
          <div className="flex flex-col">
            <span className="text-xs text-gray-500 uppercase font-medium tracking-wide">
              Email Support
            </span>
            <a
              href="mailto:support@Store1920.com"
              className="font-bold text-sm md:text-base text-gray-800 hover:underline leading-tight"
            >
              support@Store1920.com
            </a>
          </div>
        </div>

      </div>
    </div>
  );
}

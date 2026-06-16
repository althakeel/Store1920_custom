export default function PolicyPageLayout({ children, dir }) {
  return (
    <div className="w-full bg-white" dir={dir}>
      <div className="mx-auto w-full max-w-[1450px] px-4 sm:px-6 py-10 min-h-[60vh]">
        {children}
      </div>
    </div>
  );
}

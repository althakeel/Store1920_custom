'use client';

const buildPageItems = (page, totalPages) => {
  if (totalPages <= 1) return [];

  if (totalPages <= 7) {
    return Array.from({ length: totalPages }, (_, index) => ({
      type: 'page',
      value: index + 1,
    }));
  }

  const pages = new Set([1, totalPages, page, page - 1, page + 1]);
  const sorted = [...pages].filter((value) => value >= 1 && value <= totalPages).sort((a, b) => a - b);
  const items = [];

  sorted.forEach((value, index) => {
    const previous = sorted[index - 1];
    if (index > 0 && value - previous > 1) {
      items.push({ type: 'ellipsis', value: `gap-${previous}-${value}` });
    }
    items.push({ type: 'page', value });
  });

  return items;
};

export default function ShopPagination({
  page,
  totalPages,
  totalItems,
  pageSize,
  onPageChange,
}) {
  if (totalPages <= 1) return null;

  const start = (page - 1) * pageSize + 1;
  const end = Math.min(page * pageSize, totalItems);
  const pageItems = buildPageItems(page, totalPages);

  return (
    <div className="mt-8 flex flex-col items-center gap-4">
      <p className="text-sm text-gray-600">
        Showing {start.toLocaleString()}-{end.toLocaleString()} of {totalItems.toLocaleString()} products
      </p>

      <nav className="flex flex-wrap items-center justify-center gap-2" aria-label="Shop pagination">
        <button
          type="button"
          onClick={() => onPageChange(page - 1)}
          disabled={page <= 1}
          className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
        >
          Previous
        </button>

        {pageItems.map((item) => (
          item.type === 'ellipsis' ? (
            <span key={item.value} className="px-2 text-sm text-gray-400">...</span>
          ) : (
            <button
              key={item.value}
              type="button"
              onClick={() => onPageChange(item.value)}
              aria-current={item.value === page ? 'page' : undefined}
              className={`min-w-10 rounded-lg border px-3 py-2 text-sm font-semibold transition ${
                item.value === page
                  ? 'border-orange-500 bg-orange-500 text-white'
                  : 'border-gray-300 bg-white text-gray-700 hover:bg-gray-50'
              }`}
            >
              {item.value}
            </button>
          )
        ))}

        <button
          type="button"
          onClick={() => onPageChange(page + 1)}
          disabled={page >= totalPages}
          className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
        >
          Next
        </button>
      </nav>
    </div>
  );
}

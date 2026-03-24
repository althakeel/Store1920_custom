export default function WalletDetailsPage() {
  return (
    <div className="min-h-screen bg-slate-50 px-4 py-10">
      <div className="max-w-5xl mx-auto">
        <div className="bg-white border border-slate-200 rounded-xl p-6 mb-6">
          <h1 className="text-2xl font-semibold text-slate-900 mb-2">Wallet Details</h1>
          <p className="text-slate-600 text-sm">
            Earn and redeem brandstored Wallet coins on every order.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-white border border-slate-200 rounded-xl p-5">
            <h2 className="text-lg font-semibold text-slate-900 mb-2">How you earn coins</h2>
            <ul className="list-disc pl-5 text-slate-700 space-y-2">
              <li>New register: 20 coins free bonus</li>
              <li>Earn: 10 coins for every AED100 delivered order</li>
              <li>Coins are added only after order status is DELIVERED</li>
            </ul>
          </div>
          <div className="bg-white border border-slate-200 rounded-xl p-5">
            <h2 className="text-lg font-semibold text-slate-900 mb-2">How you redeem</h2>
            <ul className="list-disc pl-5 text-slate-700 space-y-2">
              <li>Redeem at checkout</li>
              <li>10 coins = AED5 discount</li>
              <li>Coins can be used across eligible orders</li>
            </ul>
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-6 mt-6">
          <h2 className="text-lg font-semibold text-slate-900 mb-4">FAQ</h2>
          <div className="space-y-3 text-slate-700">
            <div>
              <p className="font-semibold">How many coins do I get on registration?</p>
              <p className="text-sm">You get 20 coins as a free welcome bonus.</p>
            </div>
            <div>
              <p className="font-semibold">How many coins do I earn per purchase?</p>
              <p className="text-sm">You earn 10 coins for every AED100 delivered order value.</p>
            </div>
            <div>
              <p className="font-semibold">When are coins added?</p>
              <p className="text-sm">Coins are added automatically when the order status becomes DELIVERED.</p>
            </div>
            <div>
              <p className="font-semibold">How do I redeem coins?</p>
              <p className="text-sm">Use coins at checkout. 10 coins equals AED5 discount.</p>
            </div>
            <div>
              <p className="font-semibold">Do coins expire?</p>
              <p className="text-sm">No, coins do not expire.</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowDownLeft,
  ArrowUpRight,
  ChevronDown,
  Gift,
  RefreshCw,
  ShoppingBag,
  Sparkles,
  Wallet as WalletIconLucide,
} from "lucide-react";
import { useAuth } from "@/lib/useAuth";
import { isStorefrontWalletEnabled } from "@/lib/storefrontWallet";
import WalletIcon from "@/assets/icons/wallet.png";

const PERKS = [
  {
    icon: Gift,
    title: "Welcome bonus",
    value: "+20",
    detail: "On registration",
    tone: "from-amber-500 to-orange-500",
  },
  {
    icon: ShoppingBag,
    title: "Every order",
    value: "+10",
    detail: "After delivery",
    tone: "from-emerald-500 to-teal-500",
  },
  {
    icon: Sparkles,
    title: "Redeem rate",
    value: "1:1",
    detail: "Use at checkout",
    tone: "from-violet-500 to-indigo-500",
  },
];

const FAQ_ITEMS = [
  {
    question: "How much wallet do I get on registration?",
    answer: "20 wallet is added as a welcome bonus when you create your account.",
  },
  {
    question: "How much wallet do I earn per purchase?",
    answer: "You earn 10 wallet on every delivered order.",
  },
  {
    question: "When is wallet added?",
    answer: "Wallet is credited automatically after your order is delivered.",
  },
  {
    question: "How do I use my wallet?",
    answer: "Apply your wallet balance at checkout to reduce your order total instantly.",
  },
  {
    question: "Does wallet expire?",
    answer: "No. Your wallet balance stays in your account until you use it.",
  },
];

function formatBalance(amount) {
  const value = Number(amount || 0);
  if (!Number.isFinite(value)) return "0.00";
  return value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function getTransactionMeta(transaction) {
  switch (transaction.type) {
    case "EARN":
      return {
        label: "Earned",
        sign: "+",
        positive: true,
        icon: ArrowDownLeft,
        chip: "bg-emerald-50 text-emerald-700 ring-emerald-100",
      };
    case "BONUS":
      return {
        label: "Bonus",
        sign: "+",
        positive: true,
        icon: Gift,
        chip: "bg-amber-50 text-amber-700 ring-amber-100",
      };
    case "ADMIN_CREDIT":
      return {
        label: "Credit",
        sign: "+",
        positive: true,
        icon: Sparkles,
        chip: "bg-sky-50 text-sky-700 ring-sky-100",
      };
    case "REDEEM":
      return {
        label: "Redeemed",
        sign: "-",
        positive: false,
        icon: ArrowUpRight,
        chip: "bg-rose-50 text-rose-700 ring-rose-100",
      };
    case "ADMIN_DEDUCT":
      return {
        label: "Deducted",
        sign: "-",
        positive: false,
        icon: ArrowUpRight,
        chip: "bg-slate-100 text-slate-700 ring-slate-200",
      };
    default:
      return {
        label: "Transaction",
        sign: "",
        positive: true,
        icon: WalletIconLucide,
        chip: "bg-slate-100 text-slate-700 ring-slate-200",
      };
  }
}

function FaqItem({ question, answer, defaultOpen = false }) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm">
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left"
      >
        <span className="text-sm font-semibold text-slate-900">{question}</span>
        <ChevronDown
          size={18}
          className={`shrink-0 text-slate-400 transition-transform ${open ? "rotate-180" : ""}`}
        />
      </button>
      {open ? (
        <div className="border-t border-slate-100 px-5 pb-4 pt-3 text-sm leading-relaxed text-slate-600">
          {answer}
        </div>
      ) : null}
    </div>
  );
}

export default function WalletPage() {
  const router = useRouter();
  const storefrontWalletEnabled = isStorefrontWalletEnabled();
  const { user, loading, getToken } = useAuth();
  const [wallet, setWallet] = useState({ coins: 0, rupeesValue: 0, transactions: [] });
  const [error, setError] = useState("");
  const [fetching, setFetching] = useState(false);
  const [hasLoaded, setHasLoaded] = useState(false);
  const lastFetchRef = useRef(0);

  const openSignIn = () => {
    const signInEvent = new CustomEvent("openSignInModal", { detail: { mode: "login" } });
    window.dispatchEvent(signInEvent);
  };

  const loadWallet = async (silent = false) => {
    if (loading) return;
    if (!user || !getToken) {
      setError("Please sign in to view your wallet.");
      return;
    }
    const now = Date.now();
    if (now - lastFetchRef.current < 1500) return;
    lastFetchRef.current = now;
    try {
      if (!silent && !hasLoaded) setFetching(true);
      setError("");
      const token = await getToken(false);
      if (!token) {
        setError("Please sign in to view your wallet.");
        return;
      }
      const res = await fetch("/api/wallet", {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (!res.ok) {
        if (res.status === 401) {
          setError("Please sign in to view your wallet.");
        } else {
          setError(data?.error || "Failed to load wallet.");
        }
        return;
      }
      setWallet({
        coins: data.coins || 0,
        rupeesValue: data.rupeesValue || 0,
        transactions: data.transactions || [],
      });
      setHasLoaded(true);
    } catch (e) {
      const message = String(e?.message || "");
      if (message.includes("quota-exceeded")) {
        setError("Wallet temporarily unavailable. Please try again in a minute.");
      } else {
        setError("Failed to load wallet. Please try again.");
      }
    } finally {
      if (!silent && !hasLoaded) setFetching(false);
    }
  };

  useEffect(() => {
    if (!storefrontWalletEnabled) {
      router.replace("/");
    }
  }, [router, storefrontWalletEnabled]);

  useEffect(() => {
    if (!storefrontWalletEnabled) return;
    loadWallet();
    const interval = setInterval(() => {
      loadWallet(true);
    }, 60 * 1000);
    return () => clearInterval(interval);
  }, [user, getToken, loading, storefrontWalletEnabled]);

  const sortedTransactions = useMemo(
    () => [...(wallet.transactions || [])].sort(
      (left, right) => new Date(right.createdAt || 0) - new Date(left.createdAt || 0),
    ),
    [wallet.transactions],
  );

  if (!storefrontWalletEnabled) {
    return null;
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-[#f6f3ef]">
        <div className="mx-auto max-w-6xl px-4 py-10">
          <div className="h-56 animate-pulse rounded-[2rem] bg-white/70" />
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-[radial-gradient(circle_at_top,_#fff7ed_0%,_#f6f3ef_45%,_#efe7df_100%)] px-4 py-16">
        <div className="mx-auto max-w-lg rounded-[2rem] border border-white/70 bg-white/90 p-10 text-center shadow-[0_24px_80px_rgba(143,52,4,0.12)] backdrop-blur">
          <div className="mx-auto mb-5 flex h-20 w-20 items-center justify-center rounded-3xl bg-gradient-to-br from-[#8f3404] to-[#c45a12] shadow-lg">
            <Image src={WalletIcon} alt="" width={42} height={42} className="object-contain" />
          </div>
          <h1 className="text-2xl font-bold text-slate-900">Your Store1920 Wallet</h1>
          <p className="mt-2 text-sm leading-relaxed text-slate-600">
            Sign in to view your balance, track rewards, and redeem wallet at checkout.
          </p>
          <button
            type="button"
            onClick={openSignIn}
            className="mt-6 inline-flex items-center justify-center rounded-full bg-[#8f3404] px-6 py-3 text-sm font-semibold text-white transition hover:bg-[#742a03]"
          >
            Sign in to continue
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,_#fff7ed_0%,_#f6f3ef_42%,_#efe7df_100%)] px-4 py-8 sm:py-10">
      <div className="mx-auto max-w-6xl">
        <section className="relative overflow-hidden rounded-[2rem] bg-gradient-to-br from-[#5c2203] via-[#8f3404] to-[#c45a12] p-6 text-white shadow-[0_28px_80px_rgba(143,52,4,0.28)] sm:p-8">
          <div className="pointer-events-none absolute -right-10 -top-10 h-44 w-44 rounded-full bg-white/10 blur-2xl" />
          <div className="pointer-events-none absolute -bottom-16 left-8 h-52 w-52 rounded-full bg-amber-300/20 blur-3xl" />
          <div className="pointer-events-none absolute right-8 top-8 hidden h-28 w-28 rounded-[2rem] border border-white/15 bg-white/10 sm:block" />

          <div className="relative z-10 grid gap-8 lg:grid-cols-[1.2fr_0.8fr] lg:items-end">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-white/90">
                <Image src={WalletIcon} alt="" width={16} height={16} className="object-contain" />
                Store1920 Wallet
              </div>
              <h1 className="mt-4 text-3xl font-bold tracking-tight sm:text-4xl">
                Spend smarter with your rewards
              </h1>
              <p className="mt-2 max-w-xl text-sm leading-relaxed text-white/85 sm:text-base">
                Earn wallet on every delivery, stack your balance, and apply it instantly at checkout.
              </p>

              <div className="mt-6 flex flex-wrap gap-3">
                <Link
                  href="/new"
                  className="inline-flex items-center gap-2 rounded-full bg-white px-5 py-2.5 text-sm font-semibold text-[#8f3404] transition hover:bg-amber-50"
                >
                  <ShoppingBag size={16} />
                  Shop now
                </Link>
                <Link
                  href="/dashboard/orders"
                  className="inline-flex items-center gap-2 rounded-full border border-white/25 bg-white/10 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-white/15"
                >
                  View orders
                </Link>
              </div>
            </div>

            <div className="rounded-[1.75rem] border border-white/20 bg-white/12 p-5 backdrop-blur-md sm:p-6">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-white/70">
                    Available balance
                  </p>
                  <p className="mt-2 text-5xl font-bold tracking-tight sm:text-6xl">
                    {formatBalance(wallet.coins)}
                  </p>
                  <p className="mt-2 text-sm text-white/75">
                    Ready to redeem on your next order
                  </p>
                </div>
                <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-white/15 ring-1 ring-white/20">
                  <Image src={WalletIcon} alt="" width={34} height={34} className="object-contain" />
                </div>
              </div>

              <div className="mt-5 grid grid-cols-2 gap-3">
                <div className="rounded-2xl bg-black/15 px-4 py-3">
                  <p className="text-[11px] uppercase tracking-wide text-white/60">Wallet coins</p>
                  <p className="mt-1 text-lg font-semibold">{formatBalance(wallet.coins)}</p>
                </div>
                <div className="rounded-2xl bg-black/15 px-4 py-3">
                  <p className="text-[11px] uppercase tracking-wide text-white/60">Checkout value</p>
                  <p className="mt-1 text-lg font-semibold">{formatBalance(wallet.rupeesValue)}</p>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="mt-6 grid gap-4 md:grid-cols-3">
          {PERKS.map((perk) => {
            const Icon = perk.icon;
            return (
              <div
                key={perk.title}
                className="group rounded-[1.5rem] border border-white/70 bg-white/90 p-5 shadow-[0_12px_40px_rgba(15,23,42,0.05)] backdrop-blur transition hover:-translate-y-0.5 hover:shadow-[0_18px_50px_rgba(15,23,42,0.08)]"
              >
                <div className={`inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br ${perk.tone} text-white shadow-md`}>
                  <Icon size={20} />
                </div>
                <p className="mt-4 text-sm font-medium text-slate-500">{perk.title}</p>
                <p className="mt-1 text-2xl font-bold text-slate-900">{perk.value}</p>
                <p className="mt-1 text-sm text-slate-600">{perk.detail}</p>
              </div>
            );
          })}
        </section>

        <section className="mt-6 grid gap-6 lg:grid-cols-[1.05fr_0.95fr]">
          <div className="rounded-[1.75rem] border border-white/70 bg-white/90 p-6 shadow-[0_12px_40px_rgba(15,23,42,0.05)] backdrop-blur sm:p-7">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2 className="text-xl font-bold text-slate-900">Recent activity</h2>
                <p className="mt-1 text-sm text-slate-500">Your latest wallet credits and redemptions</p>
              </div>
              <button
                type="button"
                onClick={() => loadWallet()}
                className="inline-flex items-center gap-2 rounded-full border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-600 transition hover:bg-slate-50"
              >
                <RefreshCw size={14} className={fetching ? "animate-spin" : ""} />
                Refresh
              </button>
            </div>

            {fetching && !hasLoaded ? (
              <div className="mt-6 space-y-3">
                {[0, 1, 2].map((item) => (
                  <div key={item} className="h-20 animate-pulse rounded-2xl bg-slate-100" />
                ))}
              </div>
            ) : null}

            {!fetching && error ? (
              <div className="mt-6 rounded-2xl border border-red-100 bg-red-50 px-4 py-4 text-sm text-red-700">
                <p>{error}</p>
                <button
                  type="button"
                  onClick={() => loadWallet()}
                  className="mt-2 font-semibold text-red-800 hover:underline"
                >
                  Try again
                </button>
              </div>
            ) : null}

            {!error && hasLoaded && sortedTransactions.length === 0 ? (
              <div className="mt-6 rounded-[1.5rem] border border-dashed border-slate-200 bg-slate-50 px-6 py-10 text-center">
                <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-white shadow-sm">
                  <Image src={WalletIcon} alt="" width={28} height={28} className="object-contain opacity-80" />
                </div>
                <p className="mt-4 text-base font-semibold text-slate-900">No transactions yet</p>
                <p className="mt-1 text-sm text-slate-500">
                  Place your first order and your wallet rewards will appear here.
                </p>
                <Link
                  href="/new"
                  className="mt-5 inline-flex items-center justify-center rounded-full bg-[#8f3404] px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-[#742a03]"
                >
                  Start shopping
                </Link>
              </div>
            ) : null}

            {!error && sortedTransactions.length > 0 ? (
              <ul className="mt-6 space-y-3">
                {sortedTransactions.map((transaction, index) => {
                  const meta = getTransactionMeta(transaction);
                  const Icon = meta.icon;
                  const amount = transaction.coins ?? transaction.rupees ?? 0;

                  return (
                    <li
                      key={`${transaction.orderId || "tx"}-${transaction.createdAt || index}`}
                      className="flex items-center justify-between gap-4 rounded-2xl border border-slate-100 bg-slate-50/80 px-4 py-4"
                    >
                      <div className="flex min-w-0 items-center gap-3">
                        <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl ring-1 ${meta.chip}`}>
                          <Icon size={18} />
                        </div>
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold text-slate-900">
                            {transaction.description || meta.label}
                          </p>
                          <p className="mt-0.5 text-xs text-slate-500">
                            {transaction.createdAt
                              ? new Date(transaction.createdAt).toLocaleString(undefined, {
                                  month: "short",
                                  day: "numeric",
                                  year: "numeric",
                                  hour: "2-digit",
                                  minute: "2-digit",
                                })
                              : "Recent"}
                            {transaction.orderId ? ` · #${String(transaction.orderId).slice(-8).toUpperCase()}` : ""}
                          </p>
                        </div>
                      </div>
                      <div className={`shrink-0 text-sm font-bold ${meta.positive ? "text-emerald-600" : "text-rose-600"}`}>
                        {meta.sign}{formatBalance(amount)}
                      </div>
                    </li>
                  );
                })}
              </ul>
            ) : null}
          </div>

          <div className="space-y-4">
            <div className="rounded-[1.75rem] border border-white/70 bg-white/90 p-6 shadow-[0_12px_40px_rgba(15,23,42,0.05)] backdrop-blur sm:p-7">
              <h2 className="text-xl font-bold text-slate-900">How it works</h2>
              <div className="mt-5 space-y-4">
                <div className="flex gap-4">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#8f3404]/10 text-sm font-bold text-[#8f3404]">
                    1
                  </div>
                  <div>
                    <p className="font-semibold text-slate-900">Create your account</p>
                    <p className="mt-1 text-sm text-slate-600">Get 20 wallet instantly as a welcome bonus.</p>
                  </div>
                </div>
                <div className="flex gap-4">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#8f3404]/10 text-sm font-bold text-[#8f3404]">
                    2
                  </div>
                  <div>
                    <p className="font-semibold text-slate-900">Shop and receive</p>
                    <p className="mt-1 text-sm text-slate-600">Earn 10 wallet after each delivered order.</p>
                  </div>
                </div>
                <div className="flex gap-4">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#8f3404]/10 text-sm font-bold text-[#8f3404]">
                    3
                  </div>
                  <div>
                    <p className="font-semibold text-slate-900">Redeem at checkout</p>
                    <p className="mt-1 text-sm text-slate-600">Apply your balance and pay less on your next purchase.</p>
                  </div>
                </div>
              </div>
            </div>

            <div className="rounded-[1.75rem] border border-white/70 bg-white/90 p-6 shadow-[0_12px_40px_rgba(15,23,42,0.05)] backdrop-blur sm:p-7">
              <h2 className="text-xl font-bold text-slate-900">FAQ</h2>
              <div className="mt-5 space-y-3">
                {FAQ_ITEMS.map((item, index) => (
                  <FaqItem
                    key={item.question}
                    question={item.question}
                    answer={item.answer}
                    defaultOpen={index === 0}
                  />
                ))}
              </div>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}

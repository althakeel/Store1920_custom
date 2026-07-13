export function isStorefrontWalletEnabled() {
  return process.env.NEXT_PUBLIC_ENABLE_WALLET === 'true';
}

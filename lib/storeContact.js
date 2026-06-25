export const STORE1920_SUPPORT_EMAIL = 'support@store1920.com';
export const STORE1920_CUSTOMER_SUPPORT_PHONE = '8007861920';
export const STORE1920_CUSTOMER_SUPPORT_TEL = 'tel:8007861920';

export function getAdminOrderNotificationEmails() {
  const raw = [
    process.env.ADMIN_EMAIL,
    process.env.NEXT_PUBLIC_ADMIN_EMAIL,
  ].filter(Boolean).join(',');

  const emails = raw
    .replace(/['"]/g, '')
    .split(',')
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean);

  return [...new Set(emails)];
}

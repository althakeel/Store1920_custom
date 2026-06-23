import nodemailer from 'nodemailer';

function stripEnvQuotes(value = '') {
  const trimmed = String(value || '').trim();
  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"'))
    || (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    return trimmed.slice(1, -1);
  }
  return trimmed;
}

const host = process.env.SMTP_HOST;
const user = process.env.SMTP_USER;
const pass = stripEnvQuotes(process.env.SMTP_PASS);
const port = Number(process.env.SMTP_PORT || 465);
const secure = process.env.SMTP_SECURE !== 'false';

console.log('Config:', { host, port, secure, user, passLength: pass.length });

const transporter = nodemailer.createTransport({
  host,
  port,
  secure,
  auth: { user, pass },
  connectionTimeout: 15000,
  greetingTimeout: 15000,
  socketTimeout: 15000,
});

try {
  await transporter.verify();
  console.log('SMTP verify: OK');

  const info = await transporter.sendMail({
    from: `"Store1920" <${user}>`,
    to: user,
    subject: 'Store1920 SMTP test',
    html: '<p>If you see this, Hostinger SMTP works.</p>',
  });
  console.log('Sent:', info.messageId);
} catch (error) {
  console.error('SMTP failed:', error.message);
  if (error.response) console.error('Server response:', error.response);
  process.exit(1);
}

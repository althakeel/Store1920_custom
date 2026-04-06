// scripts/test-smtp-email.js
import { sendMail } from '../lib/email.js';

async function main() {
  try {
    const result = await sendMail({
      to: process.env.SMTP_USER, // send to yourself for test
      subject: 'SMTP Test Email',
      html: '<h2>This is a test email from your Store1920 app SMTP setup.</h2>'
    });
    console.log('Test email sent successfully:', result);
  } catch (err) {
    console.error('Failed to send test email:', err);
    process.exit(1);
  }
}

main();
        
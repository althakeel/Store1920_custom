/**
 * Prints the last stored WhatsApp reminder errors on abandoned carts.
 * Run: node --env-file=.env scripts/audit-abandoned-whatsapp-errors.js
 */
const mongoose = require('mongoose');

async function main() {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    console.error('MONGODB_URI missing');
    process.exit(1);
  }
  await mongoose.connect(uri);

  const AbandonedCart = mongoose.connection.collection('abandonedcarts');
  const carts = await AbandonedCart.find(
    {},
    {
      projection: {
        name: 1,
        phone: 1,
        recoveryToken: 1,
        recoveryOfferTotal: 1,
        whatsappCheckoutReminderStatus: 1,
        whatsappCheckoutReminderError: 1,
        whatsappCheckoutReminderSentAt: 1,
        updatedAt: 1,
      },
    },
  )
    .sort({ updatedAt: -1 })
    .limit(15)
    .toArray();

  console.log(`\nRecent abandoned carts (${carts.length}):\n`);
  carts.forEach((c) => {
    console.log('—'.repeat(60));
    console.log('name:', c.name || '(none)');
    console.log('phone:', c.phone || '(none)');
    console.log('recoveryToken:', c.recoveryToken ? 'yes' : 'no', '| offerTotal:', c.recoveryOfferTotal ?? '(none)');
    console.log('whatsapp status:', c.whatsappCheckoutReminderStatus || '(none)');
    console.log('whatsapp error:', c.whatsappCheckoutReminderError || '(none)');
    console.log('sentAt:', c.whatsappCheckoutReminderSentAt || '(none)');
  });

  await mongoose.disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

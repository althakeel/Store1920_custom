const mongoose = require('mongoose');
const Product = require('./models/Product').default;

const mongoUri = process.env.MONGODB_URI;

if (!mongoUri) {
  console.error('MONGODB_URI is missing. Please set it in .env');
  process.exit(1);
}

mongoose.connect(mongoUri).then(async () => {
  try {
    const total = await Product.countDocuments({ inStock: true });
    const fastDelivery = await Product.countDocuments({ inStock: true, fastDelivery: true });
    const noFastDelivery = await Product.countDocuments({ inStock: true, fastDelivery: false });
    const noFieldDefined = await Product.countDocuments({ inStock: true, fastDelivery: { $exists: false } });
    
    console.log('=== Product Count Analysis ===');
    console.log('Total in-stock products:', total);
    console.log('Fast delivery products:', fastDelivery);
    console.log('Non-fast delivery products:', noFastDelivery);
    console.log('No fastDelivery field:', noFieldDefined);
    
    // Sample one fast delivery product
    if (fastDelivery > 0) {
      const sample = await Product.findOne({ inStock: true, fastDelivery: true }).lean();
      console.log('\n=== Sample Fast Delivery Product ===');
      console.log('Name:', sample.name);
      console.log('FastDelivery:', sample.fastDelivery);
      console.log('InStock:', sample.inStock);
    }
    
    process.exit(0);
  } catch (err) {
    console.error('Error:', err.message);
    process.exit(1);
  }
}).catch(err => { 
  console.error('Connection Error:', err.message); 
  process.exit(1); 
});

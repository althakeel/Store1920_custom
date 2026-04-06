const mongoose = require('mongoose');
const Product = require('../models/Product').default;

const mongoUri = process.env.MONGODB_URI;

if (!mongoUri) {
  console.error('MONGODB_URI is missing. Please set it in .env');
  process.exit(1);
}

async function clearProducts() {
  try {
    await mongoose.connect(mongoUri);
    
    const count = await Product.countDocuments();
    console.log(`Found ${count} products in database`);
    
    if (count === 0) {
      console.log('No products to delete');
      process.exit(0);
    }
    
    const result = await Product.deleteMany({});
    console.log(`✅ Deleted ${result.deletedCount} products from MongoDB`);
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

clearProducts();

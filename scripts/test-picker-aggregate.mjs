import mongoose from 'mongoose';

const uri = process.env.MONGODB_URI;
if (!uri) {
  console.error('MONGODB_URI missing');
  process.exit(1);
}

const ProductSchema = new mongoose.Schema({}, { strict: false });
const Product = mongoose.models.Product || mongoose.model('Product', ProductSchema, 'products');

async function main() {
  await mongoose.connect(uri);
  const storeId = '69cf7453536ace6caa8c3716';
  const total = await Product.countDocuments({ storeId });
  const anyTotal = await Product.countDocuments({});
  console.log('products for storeId:', total, 'all products:', anyTotal);

  const badImages = await Product.countDocuments({
    storeId,
    images: { $exists: true, $not: { $type: 'array' } },
  });
  console.log('non-array images for store:', badImages);

  const projection = {
    _id: 1,
    name: 1,
    sku: 1,
    price: 1,
    AED: 1,
    inStock: 1,
    createdAt: 1,
    images: { $slice: [{ $ifNull: ['$images', []] }, 1] },
    externalImages: { $slice: [{ $ifNull: ['$externalImages', []] }, 1] },
  };

  try {
    const [result] = await Product.aggregate([
      { $match: { storeId } },
      { $sort: { name: 1 } },
      {
        $facet: {
          products: [{ $skip: 0 }, { $limit: 24 }, { $project: projection }],
          total: [{ $count: 'count' }],
        },
      },
    ]);
    console.log('aggregate ok', result?.products?.length, result?.total);
    const json = JSON.stringify({
      products: result?.products || [],
      pagination: { page: 1, limit: 24, total: result?.total?.[0]?.count || 0, totalPages: 1 },
    });
    console.log('json bytes', json.length);
  } catch (error) {
    console.error('aggregate failed:', error.message);
  }

  const weird = await Product.findOne({ storeId, price: { $type: 'decimal' } }).lean();
  console.log('decimal price sample', weird?._id);

  await mongoose.disconnect();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

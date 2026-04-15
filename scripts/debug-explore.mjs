import mongoose from 'mongoose';

const uri = 'mongodb+srv://store1920_user:!Althakeel2520@cluster0.d6dymif.mongodb.net/store1920_new?retryWrites=true&w=majority&appName=Cluster0';

const StoreSchema = new mongoose.Schema({
  name: String,
  exploreInterestsEnabled: Boolean,
  exploreInterestsProductIds: { type: [String], default: [] },
}, { collection: 'stores', strict: false });

const Store = mongoose.model('Store', StoreSchema);

await mongoose.connect(uri);
console.log('Connected');

// Test 1: plain findOne
const s1 = await Store.findOne().select('_id exploreInterestsEnabled exploreInterestsProductIds').lean();
console.log('\n--- findOne() ---');
console.log(' _id:', String(s1._id));
console.log(' enabled:', s1.exploreInterestsEnabled);
console.log(' productCount:', (s1.exploreInterestsProductIds || []).length);
console.log(' first3:', (s1.exploreInterestsProductIds || []).slice(0, 3));

// Test 2: findOne with array filter
const s2 = await Store.findOne({ 'exploreInterestsProductIds.0': { $exists: true } })
  .select('_id exploreInterestsEnabled exploreInterestsProductIds').lean();
console.log('\n--- findOne({ array.0 exists }) ---');
console.log(s2 ? `_id: ${s2._id}, count: ${(s2.exploreInterestsProductIds||[]).length}` : 'NULL - no store found');

// Test 3: check what the batch API would get
const ids = (s1.exploreInterestsProductIds || []).slice(0, 3);
console.log('\n--- Product IDs to resolve ---');
console.log(' Sample IDs:', ids);

const ProductSchema = new mongoose.Schema({}, { collection: 'products', strict: false });
const Product = mongoose.model('Product', ProductSchema);
if (ids.length) {
  const products = await Product.find({ _id: { $in: ids } }).select('_id name').lean();
  console.log(' Products found from those IDs:', products.length);
  console.log(' Detail:', products.map(p => ({ _id: String(p._id), name: p.name })));
  
  // Also try string match
  const products2 = await Product.find({ _id: { $in: ids.map(id => { try { return new mongoose.Types.ObjectId(id); } catch { return id; } }) } }).select('_id name').lean();
  console.log(' Products found (ObjectId cast):', products2.length);
}

await mongoose.disconnect();
console.log('\nDone.');

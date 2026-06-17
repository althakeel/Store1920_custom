import mongoose from 'mongoose';

const InventoryHistorySchema = new mongoose.Schema({
  storeId: { type: String, required: true, index: true },
  storeName: { type: String, default: '' },
  productId: { type: String, required: true, index: true },
  productName: { type: String, default: '' },
  sku: { type: String, default: '' },
  actorUserId: { type: String, default: '', index: true },
  actorEmail: { type: String, default: '' },
  actorName: { type: String, default: '' },
  actorRole: {
    type: String,
    enum: ['owner', 'admin', 'member', 'system', 'unknown'],
    default: 'unknown',
  },
  action: {
    type: String,
    enum: ['add_stock', 'set_stock', 'toggle_in_stock', 'bulk_update', 'product_edit', 'import', 'order_decrement', 'order_restore'],
    required: true,
  },
  quantityDelta: { type: Number, default: 0 },
  previousStock: { type: Number, default: 0 },
  newStock: { type: Number, default: 0 },
  source: { type: String, default: 'inventory_page' },
  details: { type: String, default: '' },
  metadata: { type: Object, default: {} },
}, { timestamps: true });

InventoryHistorySchema.index({ storeId: 1, createdAt: -1 });
InventoryHistorySchema.index({ createdAt: -1 });
InventoryHistorySchema.index({ actorUserId: 1, createdAt: -1 });

export default mongoose.models.InventoryHistory || mongoose.model('InventoryHistory', InventoryHistorySchema);

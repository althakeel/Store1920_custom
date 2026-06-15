import mongoose from 'mongoose'

const OrderCounterSchema = new mongoose.Schema({
  storeId: { type: String, required: true, unique: true, index: true },
  seq: { type: Number, required: true, default: 612344 },
}, { timestamps: true })

export default mongoose.models.OrderCounter || mongoose.model('OrderCounter', OrderCounterSchema)

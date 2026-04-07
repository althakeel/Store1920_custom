import mongoose from 'mongoose';

const Section4Schema = new mongoose.Schema({
  title: {
    type: String,
    required: true,
  },
  titleAr: {
    type: String,
    default: '',
  },
  category: {
    type: String,
    required: true,
  },
  gridSize: {
    type: Number,
    enum: [3, 6, 9],
    default: 6,
  },
  products: [{
    _id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Product',
      required: true,
    },
    name: String,
    slug: String,
    image: String,
    images: [String],
    discount: String,
    badge: String,
    offer: String,
  }],
  visible: {
    type: Boolean,
    default: true,
  },
  order: {
    type: Number,
    default: 0,
  },
}, {
  timestamps: true,
});

export default mongoose.models.Section4 || mongoose.model('Section4', Section4Schema);

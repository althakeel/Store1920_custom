import mongoose from 'mongoose';

const categorySchema = new mongoose.Schema({
  _id: {
    type: String,
    default: () => new mongoose.Types.ObjectId().toString()
  },
  name: {
    type: String,
    required: true
  },
  nameAr: {
    type: String,
    default: ''
  },
  legacySourceId: {
    type: String,
    default: null,
    index: true,
  },
  slug: {
    type: String,
    required: true,
    unique: true
  },
  description: String,
  descriptionAr: {
    type: String,
    default: ''
  },
  image: String,
  url: {
    type: String,
    required: false,
    default: ''
  },
  storeId: {
    type: String,
    default: null
  },
  parentId: {
    type: String,
    ref: 'Category',
    default: null
  }
}, {
  timestamps: true
});

const Category = mongoose.models.Category || mongoose.model('Category', categorySchema);

export default Category;

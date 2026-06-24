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
  },
  level: {
    type: Number,
    default: 1,
    min: 1,
    max: 3,
  },
  metaTitle: {
    type: String,
    default: '',
  },
  metaDescription: {
    type: String,
    default: '',
  },
  isActive: {
    type: Boolean,
    default: true,
  },
  sortOrder: {
    type: Number,
    default: 0,
  },
}, {
  timestamps: true
});

categorySchema.index({ parentId: 1, name: 1 });
categorySchema.index({ parentId: 1, sortOrder: 1 });
categorySchema.index({ level: 1, sortOrder: 1 });
categorySchema.index({ isActive: 1, level: 1 });

const Category = mongoose.models.Category || mongoose.model('Category', categorySchema);

export default Category;

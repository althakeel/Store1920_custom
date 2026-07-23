import mongoose from 'mongoose';

const BlogSchema = new mongoose.Schema(
  {
    storeId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Store',
      required: true,
      index: true,
    },
    title: { type: String, trim: true, required: true, default: '' },
    titleAr: { type: String, trim: true, default: '' },
    slug: { type: String, trim: true, required: true, index: true },
    excerpt: { type: String, trim: true, default: '' },
    excerptAr: { type: String, trim: true, default: '' },
    contentHtml: { type: String, default: '' },
    contentHtmlAr: { type: String, default: '' },
    coverImage: { type: String, trim: true, default: '' },
    status: {
      type: String,
      enum: ['draft', 'published'],
      default: 'draft',
      index: true,
    },
    publishedAt: { type: Date, default: null },
    seoTitle: { type: String, trim: true, default: '' },
    seoDescription: { type: String, trim: true, default: '' },
    authorName: { type: String, trim: true, default: '' },
  },
  { timestamps: true },
);

BlogSchema.index({ storeId: 1, slug: 1 }, { unique: true });
BlogSchema.index({ status: 1, publishedAt: -1 });

const Blog = mongoose.models.Blog || mongoose.model('Blog', BlogSchema);

export default Blog;

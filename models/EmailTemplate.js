import mongoose from 'mongoose'

const EmailTemplateSchema = new mongoose.Schema({
  storeId: { type: mongoose.Schema.Types.ObjectId, ref: 'Store', required: true },
  templateType: { type: String, enum: ['product_notification'], default: 'product_notification' },
  name: { type: String, required: true }, // Template name
  subject: { type: String, required: true },
  template: { type: String, required: true }, // HTML template with placeholders
  placeholders: [{
    name: String, // e.g., {{productName}}, {{productPrice}}, {{customMessage}}
    description: String
  }],
  isDefault: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
}, { timestamps: true })

EmailTemplateSchema.index({ storeId: 1, templateType: 1 });
EmailTemplateSchema.index({ storeId: 1, updatedAt: -1 });

export default mongoose.models.EmailTemplate || mongoose.model('EmailTemplate', EmailTemplateSchema)

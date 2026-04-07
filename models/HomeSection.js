import mongoose from "mongoose";

const HomeSectionSchema = new mongoose.Schema({
  section: String,
  sectionType: { type: String, default: "manual" },
  category: String,
  tag: String,
  productIds: [String],
  title: { type: String, default: "Untitled Section" },
  titleAr: { type: String, default: "" },
  subtitle: String,
  subtitleAr: { type: String, default: "" },
  slides: [String],
  slidesData: { type: Array, default: [] },
  bannerCtaText: String,
  bannerCtaTextAr: { type: String, default: "" },
  bannerCtaLink: String,
  layout: { type: String, default: "deals_with_banner" },
  isActive: { type: Boolean, default: true },
  sortOrder: { type: Number, default: 0 },
}, { timestamps: true });

export default mongoose.models.HomeSection || mongoose.model("HomeSection", HomeSectionSchema);
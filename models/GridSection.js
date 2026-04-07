import mongoose from "mongoose";

const GridSectionSchema = new mongoose.Schema({
  index: { type: Number, required: true, unique: true },
  title: { type: String, default: "" },
  titleAr: { type: String, default: "" },
  path: { type: String, default: "" },
  productIds: { type: [String], default: [] },
}, { timestamps: true });

export default mongoose.models.GridSection || mongoose.model("GridSection", GridSectionSchema);

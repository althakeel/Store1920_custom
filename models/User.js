import mongoose from "mongoose";

const LocationHistorySchema = new mongoose.Schema({
  timestamp: { type: Date, default: Date.now },
  ip: String,
  city: String,
  state: String,
  country: String,
  latitude: Number,
  longitude: Number,
  deviceType: String,
  browser: String,
  userAgent: String,
  pageUrl: String
}, { _id: false });

const UserSchema = new mongoose.Schema({
  _id: { type: String, required: true }, // Firebase UID as string
  firebaseUid: { type: String, unique: true, sparse: true }, // Firebase UID reference
  legacySourceId: { type: String, unique: true, sparse: true },
  name: String,
  email: { type: String, unique: true, sparse: true },
  phone: String,
  image: String,
  cart: {
    type: Map,
    of: mongoose.Schema.Types.Mixed,
    default: {}
  },
  // Location tracking
  locations: {
    type: [LocationHistorySchema],
    default: []
  },
  lastLocation: {
    city: String,
    state: String,
    country: String,
    latitude: Number,
    longitude: Number,
    timestamp: Date
  },
  firstVisitLocation: {
    city: String,
    state: String,
    country: String,
    timestamp: Date
  },
  // Email preferences
  emailPreferences: {
    promotional: { type: Boolean, default: true },
    orders: { type: Boolean, default: true },
    updates: { type: Boolean, default: true }
  }
  // Add other fields as needed
}, { timestamps: true, _id: false }); // Disable auto ObjectId generation

if (process.env.NODE_ENV === "development" && mongoose.models.User) {
  delete mongoose.models.User;
}

export default mongoose.models.User || mongoose.model("User", UserSchema);
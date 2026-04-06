import mongoose from 'mongoose';

const NavbarMenuSettingsSchema = new mongoose.Schema(
  {
    storeId: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    enabled: {
      type: Boolean,
      default: true,
    },
    logoUrl: {
      type: String,
      default: '',
      trim: true,
    },
    logoWidth: {
      type: Number,
    },
    logoHeight: {
      type: Number,
    },
    backgroundColor: {
      type: String,
      default: '#8f3404',
      trim: true,
    },
    items: [
      {
        label: {
          type: String,
          required: true,
        },
        url: {
          type: String,
          required: true,
        },
        categoryId: {
          type: String,
          required: false,
        },
      },
    ],
  },
  { timestamps: true }
);

const NavbarMenuSettingsModel = mongoose.models.NavbarMenuSettings ||
  mongoose.model('NavbarMenuSettings', NavbarMenuSettingsSchema);

// In Next.js dev hot-reload, a cached model may have been compiled before
// new fields were added. Ensure required paths exist on the cached schema.
if (!NavbarMenuSettingsModel.schema.path('logoWidth')) {
  NavbarMenuSettingsModel.schema.add({
    logoWidth: {
      type: Number,
    },
  });
}

if (!NavbarMenuSettingsModel.schema.path('logoHeight')) {
  NavbarMenuSettingsModel.schema.add({
    logoHeight: {
      type: Number,
    },
  });
}

export default NavbarMenuSettingsModel;

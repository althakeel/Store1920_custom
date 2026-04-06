import mongoose from 'mongoose'

const TopBarItemSchema = new mongoose.Schema(
  {
    id: { type: String, trim: true },
    title: { type: String, trim: true, default: '' },
    subtitle: { type: String, trim: true, default: '' },
    icon: { type: String, trim: true, default: '' },
    href: { type: String, trim: true, default: '' },
    action: { type: String, trim: true, default: '' }
  },
  { _id: false }
)

const BannerSliderItemSchema = new mongoose.Schema(
  {
    id: { type: String, trim: true, default: '' },
    image: { type: String, trim: true, default: '' },
    link: { type: String, trim: true, default: '/shop' },
    alt: { type: String, trim: true, default: '' }
  },
  { _id: false }
)

const defaultBannerSliderItems = [
  { id: 'banner-slider-1', image: '', link: '/category/sofas', alt: 'Banner 1' },
  { id: 'banner-slider-2', image: '', link: '/category/beds', alt: 'Banner 2' }
]

const defaultSecondaryBannerSliderItems = [
  { id: 'secondary-banner-slider-1', image: '', link: '/shop', alt: 'Lower Banner 1' },
  { id: 'secondary-banner-slider-2', image: '', link: '/shop', alt: 'Lower Banner 2' }
]

const StorePreferenceSchema = new mongoose.Schema(
  {
    storeId: { type: mongoose.Schema.Types.ObjectId, ref: 'Store', required: true, unique: true },
    topBar: {
      enabled: { type: Boolean, default: true },
      countdownLabel: { type: String, trim: true, default: 'HURRY UP !' },
      countdownEnd: { type: Date, default: null },
      items: {
        type: [TopBarItemSchema],
        default: [
          { id: 'shipping', title: 'Free Shipping', subtitle: 'Special for you', icon: 'truck' },
          { id: 'policy', title: 'Up to 90 days*', subtitle: 'Price adjustment', icon: 'bell' },
          { id: 'rewards', title: 'Signup Rewards', subtitle: '100 Coins + Free Coupons', icon: 'gift', action: 'signup' }
        ]
      }
    },
    shopShowcase: {
      enabled: { type: Boolean, default: true },
      featuredSectionTitle: { type: String, trim: true, default: 'Craziest sale of the year!' },
      featuredSectionDescription: { type: String, trim: true, default: "Grab the best deals before they're gone!" },
      mainBannerEnabled: { type: Boolean, default: true },
      mainBannerImage: { type: String, trim: true, default: '' },
      mainBannerTitle: { type: String, trim: true, default: 'Power up instantly no battery needed' },
      mainBannerTitleEnabled: { type: Boolean, default: true },
      mainBannerSubtitle: { type: String, trim: true, default: 'Never stress over a dead battery again' },
      mainBannerSubtitleEnabled: { type: Boolean, default: true },
      mainBannerCtaText: { type: String, trim: true, default: 'Order Now' },
      mainBannerCtaEnabled: { type: Boolean, default: true },
      mainBannerLink: { type: String, trim: true, default: '/shop' },
      mainBannerLeftColor: { type: String, trim: true, default: '#00112b' },
      mainBannerRightColor: { type: String, trim: true, default: '#00112b' },
      mainBannerTitleColor: { type: String, trim: true, default: '#ffffff' },
      mainBannerSubtitleColor: { type: String, trim: true, default: '#e5e7eb' },
      mainBannerCtaBgColor: { type: String, trim: true, default: '#ef2d2d' },
      mainBannerCtaTextColor: { type: String, trim: true, default: '#ffffff' },
      sectionTitle: { type: String, trim: true, default: 'More Reasons to Shop' },
      leftBlockBadgeText: { type: String, trim: true, default: '' },
      leftBlockSource: { type: String, enum: ['category', 'product'], default: 'category' },
      dealsTitle: { type: String, trim: true, default: 'MEGA DEALS' },
      countdownEnd: { type: Date, default: null },
      categoryIds: { type: [String], default: [] },
      sectionProductIds: { type: [String], default: [] },
      productIds: { type: [String], default: [] },
      topBannerImage: { type: String, trim: true, default: '' },
      topBannerTitle: { type: String, trim: true, default: 'SUPER SAVES FOR SUMMER' },
      topBannerLink: { type: String, trim: true, default: '/shop' },
      bottomBannerImage: { type: String, trim: true, default: '' },
      bottomBannerTitle: { type: String, trim: true, default: 'Shop Now. Pay Later. Ready for Summer.' },
      bottomBannerCtaText: { type: String, trim: true, default: 'Shop Now' },
      bottomBannerLink: { type: String, trim: true, default: '/shop' },
      bannerSliderEnabled: { type: Boolean, default: true },
      bannerSliderDesktopInterval: { type: Number, default: 4000 },
      bannerSliderMobileInterval: { type: Number, default: 3000 },
      bannerSliderDesktopHeight: { type: Number, default: 220 },
      bannerSliderMobileHeight: { type: Number, default: 120 },
      bannerSliderItems: {
        type: [BannerSliderItemSchema],
        default: defaultBannerSliderItems
      },
      secondaryBannerSliderEnabled: { type: Boolean, default: true },
      secondaryBannerSliderDesktopInterval: { type: Number, default: 4000 },
      secondaryBannerSliderMobileInterval: { type: Number, default: 3000 },
      secondaryBannerSliderDesktopHeight: { type: Number, default: 220 },
      secondaryBannerSliderMobileHeight: { type: Number, default: 120 },
      secondaryBannerSliderItems: {
        type: [BannerSliderItemSchema],
        default: defaultSecondaryBannerSliderItems
      }
    },
    appearanceSections: {
      type: mongoose.Schema.Types.Mixed,
      default: {}
    }
  },
  { timestamps: true }
)

const StorePreferenceModel = mongoose.models.StorePreference || mongoose.model('StorePreference', StorePreferenceSchema)

const missingShopShowcasePaths = {}

if (!StorePreferenceModel.schema.path('shopShowcase.mainBannerTitleEnabled')) {
  missingShopShowcasePaths.mainBannerTitleEnabled = { type: Boolean, default: true }
}

if (!StorePreferenceModel.schema.path('shopShowcase.mainBannerSubtitleEnabled')) {
  missingShopShowcasePaths.mainBannerSubtitleEnabled = { type: Boolean, default: true }
}

if (!StorePreferenceModel.schema.path('shopShowcase.mainBannerCtaEnabled')) {
  missingShopShowcasePaths.mainBannerCtaEnabled = { type: Boolean, default: true }
}

if (!StorePreferenceModel.schema.path('shopShowcase.bannerSliderEnabled')) {
  missingShopShowcasePaths.bannerSliderEnabled = { type: Boolean, default: true }
}

if (!StorePreferenceModel.schema.path('shopShowcase.bannerSliderDesktopInterval')) {
  missingShopShowcasePaths.bannerSliderDesktopInterval = { type: Number, default: 4000 }
}

if (!StorePreferenceModel.schema.path('shopShowcase.bannerSliderMobileInterval')) {
  missingShopShowcasePaths.bannerSliderMobileInterval = { type: Number, default: 3000 }
}

if (!StorePreferenceModel.schema.path('shopShowcase.bannerSliderDesktopHeight')) {
  missingShopShowcasePaths.bannerSliderDesktopHeight = { type: Number, default: 220 }
}

if (!StorePreferenceModel.schema.path('shopShowcase.bannerSliderMobileHeight')) {
  missingShopShowcasePaths.bannerSliderMobileHeight = { type: Number, default: 120 }
}

if (!StorePreferenceModel.schema.path('shopShowcase.leftBlockBadgeText')) {
  missingShopShowcasePaths.leftBlockBadgeText = { type: String, trim: true, default: '' }
}

if (!StorePreferenceModel.schema.path('shopShowcase.bannerSliderItems')) {
  missingShopShowcasePaths.bannerSliderItems = {
    type: [BannerSliderItemSchema],
    default: defaultBannerSliderItems
  }
}

if (!StorePreferenceModel.schema.path('shopShowcase.secondaryBannerSliderEnabled')) {
  missingShopShowcasePaths.secondaryBannerSliderEnabled = { type: Boolean, default: true }
}

if (!StorePreferenceModel.schema.path('shopShowcase.secondaryBannerSliderDesktopInterval')) {
  missingShopShowcasePaths.secondaryBannerSliderDesktopInterval = { type: Number, default: 4000 }
}

if (!StorePreferenceModel.schema.path('shopShowcase.secondaryBannerSliderMobileInterval')) {
  missingShopShowcasePaths.secondaryBannerSliderMobileInterval = { type: Number, default: 3000 }
}

if (!StorePreferenceModel.schema.path('shopShowcase.secondaryBannerSliderDesktopHeight')) {
  missingShopShowcasePaths.secondaryBannerSliderDesktopHeight = { type: Number, default: 220 }
}

if (!StorePreferenceModel.schema.path('shopShowcase.secondaryBannerSliderMobileHeight')) {
  missingShopShowcasePaths.secondaryBannerSliderMobileHeight = { type: Number, default: 120 }
}

if (!StorePreferenceModel.schema.path('shopShowcase.secondaryBannerSliderItems')) {
  missingShopShowcasePaths.secondaryBannerSliderItems = {
    type: [BannerSliderItemSchema],
    default: defaultSecondaryBannerSliderItems
  }
}

if (!StorePreferenceModel.schema.path('shopShowcase.leftBlockSource')) {
  missingShopShowcasePaths.leftBlockSource = { type: String, enum: ['category', 'product'], default: 'category' }
}

if (!StorePreferenceModel.schema.path('shopShowcase.sectionProductIds')) {
  missingShopShowcasePaths.sectionProductIds = { type: [String], default: [] }
}

if (Object.keys(missingShopShowcasePaths).length) {
  StorePreferenceModel.schema.add({
    shopShowcase: missingShopShowcasePaths
  })
}

export default StorePreferenceModel

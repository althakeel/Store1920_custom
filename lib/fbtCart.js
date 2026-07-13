function roundMoney(value) {
  return Math.round((Number(value) || 0) * 100) / 100;
}

export function calculateFbtBundleTotal({
  mainPrice,
  addonProducts = [],
  bundlePrice,
  bundleDiscount,
}) {
  const main = Number(mainPrice) || 0;
  const addonTotal = addonProducts.reduce((sum, product) => sum + (Number(product?.price) || 0), 0);
  const baseTotal = main + addonTotal;
  const fixedPrice = Number(bundlePrice);
  const discount = Number(bundleDiscount);

  if (Number.isFinite(fixedPrice) && fixedPrice > 0) {
    return roundMoney(fixedPrice);
  }
  if (Number.isFinite(discount) && discount > 0) {
    return roundMoney(baseTotal * (1 - discount / 100));
  }
  return roundMoney(baseTotal);
}

export function distributeFbtLinePrices({
  mainProductId,
  mainPrice,
  addonProducts = [],
  bundleTotal,
}) {
  const lines = [
    { productId: String(mainProductId), basePrice: Number(mainPrice) || 0 },
    ...addonProducts.map((product) => ({
      productId: String(product?._id || product?.id),
      basePrice: Number(product?.price) || 0,
    })),
  ].filter((line) => line.productId);

  const baseSum = lines.reduce((sum, line) => sum + line.basePrice, 0);
  const targetTotal = roundMoney(bundleTotal);
  const priceByProductId = new Map();

  if (!lines.length || baseSum <= 0) {
    return priceByProductId;
  }

  if (Math.abs(targetTotal - baseSum) < 0.01) {
    lines.forEach((line) => {
      priceByProductId.set(line.productId, roundMoney(line.basePrice));
    });
    return priceByProductId;
  }

  let allocated = 0;
  lines.forEach((line, index) => {
    if (index === lines.length - 1) {
      priceByProductId.set(line.productId, roundMoney(targetTotal - allocated));
      return;
    }
    const share = roundMoney((targetTotal * line.basePrice) / baseSum);
    priceByProductId.set(line.productId, share);
    allocated += share;
  });

  return priceByProductId;
}

export function buildFbtBundleCartMeta(mainProductId, memberIds) {
  const normalizedMainId = String(mainProductId || '');
  const normalizedMemberIds = Array.from(new Set(
    [normalizedMainId, ...memberIds.map((id) => String(id))].filter(Boolean),
  ));
  return {
    mainProductId: normalizedMainId,
    memberIds: normalizedMemberIds,
  };
}

export function applyFbtBundlePricingToOrderItems(ordersByStore, configByMainProductId) {
  if (!ordersByStore?.size || !configByMainProductId?.size) return;

  const mainProductIds = new Set();
  for (const sellerItems of ordersByStore.values()) {
    for (const item of sellerItems) {
      if (item?.fbtMainProductId) {
        mainProductIds.add(String(item.fbtMainProductId));
      }
    }
  }

  for (const mainProductId of mainProductIds) {
    const config = configByMainProductId.get(mainProductId);
    if (!config?.enableFBT) continue;

    const bundleItems = [];
    for (const sellerItems of ordersByStore.values()) {
      for (const item of sellerItems) {
        if (String(item.fbtMainProductId) === mainProductId) {
          bundleItems.push(item);
        }
      }
    }

    if (!bundleItems.length) continue;
    if (bundleItems.some((item) => Number(item.quantity) !== 1)) continue;

    const memberIds = bundleItems.map((item) => String(item.id));
    if (!memberIds.includes(mainProductId)) continue;

    const addonIds = memberIds.filter((id) => id !== mainProductId);
    const allowedAddonIds = new Set((config.fbtProductIds || []).map((id) => String(id)));
    if (!addonIds.length || !addonIds.every((id) => allowedAddonIds.has(id))) continue;

    const mainItem = bundleItems.find((item) => String(item.id) === mainProductId);
    const addonItems = bundleItems.filter((item) => String(item.id) !== mainProductId);
    if (!mainItem || !addonItems.length) continue;

    const bundleTotal = calculateFbtBundleTotal({
      mainPrice: mainItem.price,
      addonProducts: addonItems.map((item) => ({ price: item.price })),
      bundlePrice: config.fbtBundlePrice,
      bundleDiscount: config.fbtBundleDiscount,
    });

    const priceByProductId = distributeFbtLinePrices({
      mainProductId,
      mainPrice: mainItem.price,
      addonProducts: addonItems.map((item) => ({ _id: item.id, price: item.price })),
      bundleTotal,
    });

    bundleItems.forEach((item) => {
      const nextPrice = priceByProductId.get(String(item.id));
      if (nextPrice == null) return;
      item.price = nextPrice;
      item.appliedFbtBundle = {
        mainProductId,
        bundleTotal,
      };
    });
  }
}

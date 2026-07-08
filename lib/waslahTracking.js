/** Map Waslah webhook subtags to Store1920 order statuses. */

const SUBTAG_STATUS_MAP = {
  Delivered_001: 'DELIVERED',
  OutForDelivery_001: 'SHIPPED',
  PickedUp_002: 'SHIPPED',
  InTransit_001: 'SHIPPED',
  InTransit_002: 'SHIPPED',
  InTransit_003: 'SHIPPED',
  InTransit_004: 'SHIPPED',
  InTransit_005: 'SHIPPED',
  InTransit_006: 'SHIPPED',
  InTransit_007: 'SHIPPED',
  InTransit_008: 'SHIPPED',
  InTransit_009: 'SHIPPED',
  InTransit_010: 'SHIPPED',
  InSorting_001: 'SHIPPED',
  InSorting_002: 'SHIPPED',
  LabelGenerated_001: 'SHIPPED',
  NewShipment_001: 'PROCESSING',
  PickupRequested_001: 'PROCESSING',
  Cancelled_001: 'CANCELLED',
  ReturnToShipper_001: 'RETURNED',
  RTO_Delivered_001: 'RETURNED',
};

export function mapWaslahSubtagToOrderStatus(subtag = '') {
  const key = String(subtag || '').trim();
  return SUBTAG_STATUS_MAP[key] || null;
}

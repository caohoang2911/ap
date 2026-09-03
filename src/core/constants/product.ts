import { stringUtils } from '@/core/utils/string';

export const PRODUCT_PICKED_ERROR_TYPES = {
  OUT_OF_STOCK: 'OUT_OF_STOCK',
  QUALITY_DECLINE: 'QUALITY_DECLINE',
  INCORRECT_STOCK: 'INCORRECT_STOCK',
  IN_CART_OFFLINE_CUSTOMER: 'IN_CART_OFFLINE_CUSTOMER',
  NEAR_EXPIRY_DATE_NOT_YET_DISCOUNT_STAMPED:
    'NEAR_EXPIRY_DATE_NOT_YET_DISCOUNT_STAMPED',
  EXPIRED_ONLINE_SALE_DATE_NOT_YET_DISCOUNT_DATE:
    'EXPIRED_ONLINE_SALE_DATE_NOT_YET_DISCOUNT_DATE',
  PICK_WEIGHT_EXCEEDS_LIMIT: 'PICK_WEIGHT_EXCEEDS_LIMIT',
  INCORRECT_ORDERED_WEIGHT: 'INCORRECT_ORDERED_WEIGHT',
  /** SP pick không đủ nguyên thùng/lốc */
  INCOMPLETE_CASE_OR_PACK: 'INCOMPLETE_CASE_OR_PACK',
  WAITING_SUPPLIER_PROCESS: 'WAITING_SUPPLIER_PROCESS',
  PRODUCT_NOT_MEET_CUSTOMER_REQUIRE: 'PRODUCT_NOT_MEET_CUSTOMER_REQUIRE',
} as const;

/** Lý do lỗi cần chụp ảnh xác nhận (hết hàng / giảm chất lượng…). */
export const PRODUCT_PICKED_ERROR_TYPES_REQUIRING_IMAGE = [
  PRODUCT_PICKED_ERROR_TYPES.EXPIRED_ONLINE_SALE_DATE_NOT_YET_DISCOUNT_DATE,
  PRODUCT_PICKED_ERROR_TYPES.NEAR_EXPIRY_DATE_NOT_YET_DISCOUNT_STAMPED,
  PRODUCT_PICKED_ERROR_TYPES.QUALITY_DECLINE,
  PRODUCT_PICKED_ERROR_TYPES.WAITING_SUPPLIER_PROCESS,
  PRODUCT_PICKED_ERROR_TYPES.PRODUCT_NOT_MEET_CUSTOMER_REQUIRE,
] as const;

/**
 * Tạm thời optional để test siêu thị — bật `true` khi muốn chặn xác nhận
 * nếu chưa chụp ảnh với các lý do trong PRODUCT_PICKED_ERROR_TYPES_REQUIRING_IMAGE.
 */
export const REQUIRE_PICKED_IMAGE_FOR_ERROR_TYPES = false;

export const isPickedErrorTypeRequiringImage = (
  errorType?: string | null,
): boolean => {
  if (!errorType) return false;
  return (
    PRODUCT_PICKED_ERROR_TYPES_REQUIRING_IMAGE as readonly string[]
  ).includes(errorType);
};

export const PRODUCT_ACTIONS = {
  OUT_OF_STOCK: 'out-of-stock',
  LOW_QUALITY: 'low-quality',
  NEAR_EXPIRY: 'near-expiry',
  EXPIRED_ONLINE: 'expired-online',
  PICK_WEIGHT_EXCEEDS_LIMIT: 'pick-weight-exceeds-limit',
  INCORRECT_STOCK: 'incorrect-stock',
  IN_CART_OFFLINE_CUSTOMER: 'in-cart-offline-customer',
} as const;

export const PRODUCT_ACTION_LABELS = {
  [PRODUCT_ACTIONS.OUT_OF_STOCK]: 'Sản phẩm hết hàng',
  [PRODUCT_ACTIONS.LOW_QUALITY]: 'Sản phẩm giảm chất lượng',
  [PRODUCT_ACTIONS.NEAR_EXPIRY]: 'SP cận hạn sử dụng, chưa dán tem giảm giá',
  [PRODUCT_ACTIONS.EXPIRED_ONLINE]:
    'SP quá hạn bán online, chưa đến hạn giảm giá',
  [PRODUCT_ACTIONS.PICK_WEIGHT_EXCEEDS_LIMIT]:
    'SP vượt quá trọng lượng tối đa được phép pick',
  [PRODUCT_ACTIONS.INCORRECT_STOCK]: 'Sản phẩm sai tồn',
  [PRODUCT_ACTIONS.IN_CART_OFFLINE_CUSTOMER]:
    'Sp đang nằm trong giỏ hàng khách mua offline',
} as const;

export type ProductAction =
  (typeof PRODUCT_ACTIONS)[keyof typeof PRODUCT_ACTIONS];

/** Unit chuẩn hóa: bỏ dấu + UPPERCASE (vd. "Lốc" → "LOC"). */
export const normalizeProductUnit = (unit?: string): string =>
  stringUtils.removeAccents(unit?.trim() ?? '').toUpperCase();

/** Chỉ Thùng / Lốc / Pack mới áp dụng lý do thiếu nguyên kiện. */
export const isCaseOrPackUnit = (unit?: string): boolean => {
  const normalized = normalizeProductUnit(unit);
  if (!normalized) return false;
  return (
    normalized.startsWith('THUNG') ||
    normalized.startsWith('LOC') ||
    normalized.startsWith('PACK')
  );
};

export const isIncompleteCaseOrPackPickReason = (item: {
  id?: string;
  name?: string;
}): boolean => {
  if (item.id === PRODUCT_PICKED_ERROR_TYPES.INCOMPLETE_CASE_OR_PACK) {
    return true;
  }
  const name = item.name?.toLowerCase() ?? '';
  return (
    name.includes('nguyên thùng/lốc') ||
    name.includes('nguyên thùng, lốc') ||
    name.includes('không đủ nguyên thùng') ||
    name.includes('không còn đủ nguyên thùng')
  );
};

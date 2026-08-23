export enum ProductLabelEnum {
  GIFT = 'GIFT',
  COMBO = 'COMBO',
  DRY = 'DRY',
  FROZEN = 'FROZEN',
  CHILL = 'CHILL',
  FRESH = 'FRESH',
}

export type ProductItemGroup = {
  type: 'COMBO' | 'PRODUCT' | 'GIFT_PACK';
  name: string;
  quantity: number;
  elementRatio: {
    [key: string]: number;
  };
  elements?: Array<Product>;
};

export type GiftPack = Pick<ProductItemGroup, 'type' | 'name' | 'elements'>;

export type Product = {
  orderQuantityConversion?: {
    unit: string;
    weightRange: number[];
    quantity: number;
  };
  type?: 'GIFT';
  id: number;
  productPickingGuidelines?: Array<string>;
  substituteItems?: Array<Product>;
  pickedErrorType?: string;
  pickedNote?: string;
  /** URL ảnh xác nhận lý do lỗi (upload/uploadImages). */
  pickedImage?: string;
  pickedQuantity?: number;
  unitType?: string;
  quantity: number;
  pickedTime?: number;
  image?: string;
  tags?: Array<any>;
  name?: string;
  afterTaxPrice?: number;
  stockAvailable?: number;
  /** Tồn kho tại cửa hàng (API có thể trả thay cho hoặc cùng với stockAvailable). */
  stockOnhand?: number;
  discount?: number;
  sellPrice?: number;
  attributes?: any;
  originPrice?: number;
  barcode?: string;
  baseBarcode?: string;
  orderQuantity: number;
  refBarcodes?: Array<string>;
  unit?: string;
  /** Backend rule: yêu cầu nhập riêng số kiện nguyên và kiện gom lẻ khi pick. */
  isRequirePickedFullBoxAndOpenedBoxQuantity?: boolean;
  gifts?: Array<{ name: string; image: string }>;
  extraConversionQuantity?: number;
  categoryType?: string;
  vendorName?: string;
  pickedExtraQuantities?: {
    fullBoxQuantity?: number;
    openedBoxQuantity?: number;
    /** Danh sách KG từng lần quét, ví dụ [2.5, 2.6, 3.7]. */
    weightRangeItemKGs?: number[];
  };
};

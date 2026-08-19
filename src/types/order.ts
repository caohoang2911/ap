import { ORDER_DELIVERY_TYPE } from '@/core/constants/order';
import { Payment } from './order-pick';

export type OrderStatus =
  | 'ALL'
  | 'CONFIRMED'
  | 'STORE_PICKING'
  | 'STORE_PACKED'
  | 'BOOKED_SHIPPER'
  | 'SHIPPING'
  | 'TRANSFERRED'
  | 'COMPLETED'
  | 'STORE_TRANSFER_SHIPPER';
export type OrderStatusDriver =
  'UPCOMING_DELIVERY' | 'ON_TIME_DELIVERY' | 'OVERDUE_DELIVERY';

export enum OrderStatusValue {
  ALL = 'ALL',
  CONFIRMED = 'CONFIRMED',
  STORE_PICKING = 'STORE_PICKING',
  STORE_PACKED = 'STORE_PACKED',
  BOOKED_SHIPPER = 'BOOKED_SHIPPER',
  SHIPPING = 'SHIPPING',
  TRANSFERRED = 'TRANSFERRED',
  COMPLETED = 'COMPLETED',
}

export enum PackageSize {
  STANDARD = 'STANDARD',
  SIZE_1 = 'SIZE_1',
  SIZE_2 = 'SIZE_2',
  SIZE_3 = 'SIZE_3',
}

export enum PackageSizeLabel {
  STANDARD = 'Thông thường (50x40x50: 30kg - Miễn phí)',
  SIZE_1 = 'Mức 1 (60x50x60: 40kg - 10.000đ)',
  SIZE_2 = 'Mức 2 (70x60x70: 50kg - 20.000đ)',
  SIZE_3 = 'Mức 3 (90x90x90: 60kg - 40.000đ)',
}

export enum scheduleType {
  ORDER_DELIVERY_TIME = 'ORDER_DELIVERY_TIME',
  NOW = 'NOW',
}

export type Order = {
  driverNote: string;
  statusName: string;
  orderTime: string;
  code: string;
  status: OrderStatus;
  customer: any;
  payment: Payment;
  deliveryTimeRange?: any;
  amount: number;
  tags: Array<any>;
  pickerNote: string;
  type: string;
  groupShippingCode: string;
  fulfillError: any;
  lastTimeUpdateStatus: string;
  saleChannel: 'GRAB_MART' | 'KINGFOOD_OFFLINE';
  storeCode: string;
  deliveryType: ORDER_DELIVERY_TYPE;
  deliveryAddress: {
    fullAddress: string;
  };
  maxPickingTime: number;
  picker: {
    username: string;
    name: string;
  };
  pickedItemProgress: number;
  bagLabels: Array<Record<string, string>>;
  shortCode: string;
};

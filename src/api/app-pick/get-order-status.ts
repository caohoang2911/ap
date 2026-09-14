import { axiosClient } from '@/api/shared';
import { OrderStatusValue } from '~/src/types/order';

/**
 * Response của `getOrderStatus`.
 */
type GetOrderStatusResponse = {
  error?: string;
  data?: OrderStatusValue | null;
};

/**
 * Lấy status mới nhất của đơn từ BE để so sánh với status đang hiển thị ở FE.
 *
 * Trả về `null` khi BE không trả status (null/empty) → caller phải BỎ QUA,
 * không so sánh gì cả (theo yêu cầu nghiệp vụ).
 *
 * Endpoint đã được thêm vào `BLACK_LIST_SHOW_MESSAGE` trong `client.tsx` để
 * poll nền không bắn flash khi lỗi.
 */
export const getOrderStatus = async (
  orderCode: string,
): Promise<OrderStatusValue | null> => {
  // axiosClient unwrap `response.data` → res chính là body `{ data, error }`.
  const res = (await axiosClient.get('/app-pick/getOrderStatus', {
    params: { orderCode },
  })) as unknown as GetOrderStatusResponse;

  const status = res?.data;
  if (!status) return null;

  return status;
};

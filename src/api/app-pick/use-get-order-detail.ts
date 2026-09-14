import { axiosClient, queryClient } from '@/api/shared';
import { useQuery } from '@tanstack/react-query';
import { OrderDetail } from '~/src/types/order-pick';

/** Stable fallback — never use inline `{}` or every render gets a new reference and breaks effect deps. */
const EMPTY_ORDER_DETAIL = {} as OrderDetail;

type Variables = {
  orderCode?: string;
};

type Response = { error: string } & {
  data: OrderDetail;
};

const getDetailOrder = async ({ orderCode }: Variables): Promise<Response> => {
  const params = {
    orderCode,
  };
  return await axiosClient.get('app-pick/getOrderDetail', { params });
};

export const prefetchOrderDetailForCode = async ({ orderCode }: Variables) => {
  if (!orderCode) return;
  return queryClient.prefetchQuery({
    queryKey: ['orderDetail', orderCode],
    queryFn: () => getDetailOrder({ orderCode }),
    staleTime: 30 * 1000,
  });
};

const useOrderDetailQuery = ({ orderCode }: Variables) => {
  return useQuery({
    queryKey: ['orderDetail', orderCode],
    queryFn: () => {
      return getDetailOrder({ orderCode });
    },
    enabled: !!orderCode,
    staleTime: 30 * 1000,
    gcTime: Infinity,
  });
};

/**
 * Một nguồn order detail từ React Query cache theo code.
 */
export const useOrderDetailForCode = (orderCode: string | undefined) => {
  const query = useOrderDetailQuery({ orderCode });
  const isOrderDetailPending = query.isLoading;
  const isOrderDetailFetching = query.isFetching;
  const orderDetail = query.data?.data;
  const orderDetailError = query.data?.error;
  const hasOrderDetail = !!orderDetail;
  const isOrderDetailLoading = isOrderDetailPending;

  return {
    ...query,
    isOrderDetailPending,
    isOrderDetailFetching,
    isOrderDetailLoading,
    orderDetailError,
    hasOrderDetail,
    orderDetail: orderDetail ?? EMPTY_ORDER_DETAIL,
  };
};

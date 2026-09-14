import { axiosClient } from '@/api/shared';
import { type QueryClient, useInfiniteQuery } from '@tanstack/react-query';
import { OrderStatus } from '~/src/types/order';

type Variables = {
  status?: OrderStatus;
  keyword?: string;
  pageIndex?: number;
  expectedDeliveryTime?: string;
  deliveryType?: string | null;
  isMissingInvoiceOrders?: boolean;
};

export type SearchOrdersResponse = {
  total: number;
  toOffset: number;
  pageIndex: number;
  fromOffset: number;
  maxItemDisplay: number;
  list: Array<any>;
};

type Response =
  | ({ error: string } & {
      data: SearchOrdersResponse;
    })
  | any;

const searchOrders = async (filter?: Variables): Promise<Response> => {
  const filterCopy = { ...filter };

  if (filter?.status === 'ALL') {
    delete filterCopy.status;
  }

  const params = {
    filter: JSON.stringify({ ...filterCopy }),
  };

  return await axiosClient.get('app-pick/searchOrders', { params });
};

export function getNextPageParamSearchOrders(lastPage: Response) {
  const pageIndex = lastPage.data?.pageIndex;
  return pageIndex <
    Math.ceil(lastPage.data?.total / lastPage.data?.maxItemDisplay)
    ? pageIndex + 1
    : undefined;
}

/** Prefetch trang 1 (và cấu trúc infinite) khi user bấm tab — cache trùng với useSearchOrders. */
export function prefetchSearchOrders(
  queryClient: QueryClient,
  params: Variables,
) {
  return queryClient.prefetchInfiniteQuery({
    queryKey: ['searchOrders', params],
    queryFn: ({ pageParam }) =>
      searchOrders({
        ...params,
        pageIndex: pageParam as number,
      }),
    initialPageParam: 1,
    getNextPageParam: (lastPage: Response) =>
      getNextPageParamSearchOrders(lastPage),
  });
}

export const useSearchOrders = (
  params?: Variables,
  options?: any,
  queryKey?: string,
) => {
  return useInfiniteQuery({
    queryKey: [queryKey || 'searchOrders', params],
    queryFn: ({ pageParam = 0 }) => {
      return searchOrders({
        ...params,
        pageIndex: pageParam as number,
      });
    },
    getNextPageParam: (lastPage: Response) =>
      getNextPageParamSearchOrders(lastPage),
    select: (data) => {
      return {
        pages: data.pages.flatMap((page) => page.data?.list || []),
        pageParams: [...data.pageParams],
      };
    },
    enabled: !!params,
    initialPageParam: 1,
    staleTime: 5 * 1000,
    ...options,
  });
};

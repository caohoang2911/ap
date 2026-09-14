import { axiosClient } from '@/api/shared';
import { useQuery } from '@tanstack/react-query';

type Response =
  | ({ error: string } & {
      data: Array<any> | undefined;
    })
  | any;

const searchOrdersByKeyword = async (keyword?: string): Promise<Response> => {
  return await axiosClient.get('app-pick/suggestOrdersByKeyword', {
    params: { keyword },
  });
};

export const useSearchOrdersByKeyword = (
  keyword?: string,
  options?: any,
  queryKey?: string,
) => {
  return useQuery({
    queryKey: [queryKey || 'searchOrdersByKeywork', keyword],
    queryFn: () => searchOrdersByKeyword(keyword),
    enabled: !!keyword,
    ...options,
  });
};

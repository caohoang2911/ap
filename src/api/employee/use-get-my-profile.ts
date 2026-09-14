import { axiosClient } from '@/api/shared';
import { useQuery } from '@tanstack/react-query';
import { useEffect } from 'react';
import { setUser, useAuth } from '~/src/core';
import { setLoading } from '~/src/core/store/loading';

/** Tránh nhiều instance useGetMyProfile cùng gọi setUser một lần cho cùng bản ghi cache. */
let lastAppliedProfileDataUpdatedAt = 0;

type Response = { error: string } & {
  data: any;
};

const getMyProfile = async (): Promise<Response> => {
  return await axiosClient.get('employee/getMyProfile');
};

export const useGetMyProfile = () => {
  const authStatus = useAuth.use.status();

  const query = useQuery({
    queryKey: ['getMyProfile'],
    queryFn: () => {
      return getMyProfile();
    },
    enabled: authStatus === 'signIn',
  });

  const { data, dataUpdatedAt } = query;

  useEffect(() => {
    if (authStatus !== 'signIn') {
      lastAppliedProfileDataUpdatedAt = 0;
      return;
    }
    if (!data?.data || data?.error) return;
    if (dataUpdatedAt <= lastAppliedProfileDataUpdatedAt) return;
    lastAppliedProfileDataUpdatedAt = dataUpdatedAt;

    setLoading(true);

    const currentUserInfo = useAuth.getState().userInfo;
    setUser({
      ...currentUserInfo,
      kposShiftStatus: data.data.kposShiftStatus,
    });
    setLoading(false);
  }, [authStatus, data, data?.error, dataUpdatedAt]);

  // Override refetch để kiểm tra điều kiện auth
  const originalRefetch = query.refetch;
  const safeRefetch = () => {
    if (authStatus === 'signIn') {
      return originalRefetch();
    }
    return Promise.resolve({
      data: null,
      error: null,
      isError: false,
      isLoading: false,
    });
  };

  return {
    ...query,
    refetch: safeRefetch,
  };
};

import { useFocusEffect } from 'expo-router';
import React, {
  memo,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  ActivityIndicator,
  FlatList,
  Keyboard,
  Text,
  View,
} from 'react-native';
import {
  UNSEEN_NOTI_COUNTER_POLL_MS,
  useGetUnseenNotiCounter,
} from '~/src/api/app-pick/use-get-unseen-noti-counter';
import { useSearchOrders } from '~/src/api/app-pick/use-search-orders';
import { useRefreshToken } from '~/src/api/auth/use-refresh-token';
import { useGetMyProfile } from '~/src/api/employee/use-get-my-profile';
import { queryClient } from '~/src/api/shared';
import { setUser, useAuth } from '~/src/core';
import { useRoleDriver } from '~/src/core/hooks/useRole';
import { setToken, setUserInfo } from '~/src/core/store/auth/utils';
import { setLoading } from '~/src/core/store/loading';
import {
  setFromScanQrCode,
  setSelectedOrderCounter,
  useOrders,
} from '~/src/core/store/orders';
import { SectionAlert } from '../SectionAlert';
import Empty from '../shared/empty';
import OrderListSkeleton from '../shared/skeleton/order-list-skeleton';
import OrderItem from './order-item';
import Header from './header';
import PullToRefreshFlatList from '../shared/pull-to-refresh-flat-list';

// Tách OrderItem thành component riêng để tránh re-render toàn bộ danh sách
const MemoizedOrderItem = memo(function MemoizedOrderItem({
  item,
  selectedOrderCounter,
}: {
  item: any;
  selectedOrderCounter: string;
}) {
  return (
    <View className="mx-4 my-3">
      <OrderItem {...item} selectedOrderCounter={selectedOrderCounter} />
    </View>
  );
});

// Footer component
const ListFooter = memo(function ListFooter({
  isFetchingNextPage,
  hasNextPage,
  isFetching,
  hasItems,
}: {
  isFetchingNextPage: boolean;
  hasNextPage: boolean | undefined;
  isFetching: boolean;
  hasItems: boolean;
}) {
  if (isFetchingNextPage) {
    return <ActivityIndicator color="blue" />;
  }

  if (!hasNextPage && !isFetchingNextPage && !isFetching && hasItems) {
    return (
      <Text className="text-center text-xs text-gray-500">
        Danh sách đã hết
      </Text>
    );
  }

  return <View />;
});

const ErrorMessage = ({ error }: { error: string }) => (
  <View className="mt-2">
    <SectionAlert variant="danger">
      <Text>Error: {error}</Text>
    </SectionAlert>
  </View>
);

const EmptyComponent = ({ isFetching }: { isFetching: boolean }) => {
  if (!isFetching) {
    return (
      <View className="mx-4 mt-3">
        <Empty />
      </View>
    );
  }
  return null;
};

const OrderList = () => {
  // References
  const flatListRef = useRef<FlatList>(null);
  const isInitialRender = useRef(true);
  const isManualRefreshRef = useRef(false);
  const prevParamsRef = useRef<any>(null);

  const userInfo = useAuth.use.userInfo();

  const { refetch: refetchGetMyProfile } = useGetMyProfile();

  const { mutate: refreshToken } = useRefreshToken((data) => {
    setToken(data?.data?.zas || '');
    setTimeout(() => {
      setUserInfo({
        ...userInfo,
        ...data?.data,
      });
      setTimeout(() => {
        setUser({
          ...userInfo,
          ...data?.data,
        });
        setLoading(false);
      }, 200);
    }, 1000);
  });

  // State from store
  const selectedOrderCounter = useOrders.use.selectedOrderCounter();
  const deliveryType = useOrders.use.deliveryType();
  const fromScanQrCode = useOrders.use.fromScanQrCode();

  const isDriver = useRoleDriver();
  const [isOrderListFocused, setIsOrderListFocused] = useState(false);

  useFocusEffect(
    useCallback(() => {
      setIsOrderListFocused(true);
      return () => setIsOrderListFocused(false);
    }, []),
  );

  useGetUnseenNotiCounter(!isDriver && isOrderListFocused, {
    refetchInterval: isOrderListFocused ? UNSEEN_NOTI_COUNTER_POLL_MS : false,
  });

  // Initialize default tab based on user role
  useEffect(() => {
    if (isDriver) {
      setSelectedOrderCounter('ALL');
    } else if (!isDriver) {
      setSelectedOrderCounter('CONFIRMED');
    }
  }, [isDriver]);

  // State
  const [isRefreshIndicatorVisible, setIsRefreshIndicatorVisible] =
    useState(false);

  // Memoize search params
  const params = useMemo(() => {
    return {
      status: fromScanQrCode ? 'ALL' : selectedOrderCounter,
      deliveryType: fromScanQrCode ? null : deliveryType,
    };
  }, [selectedOrderCounter, deliveryType, fromScanQrCode]);

  // Check if params have changed
  const haveParamsChanged = useCallback(() => {
    if (!prevParamsRef.current) return true;

    // Only compare relevant fields for reload
    const prevParams = prevParamsRef.current;
    return (
      prevParams.status !== params?.status ||
      prevParams.deliveryType !== params?.deliveryType
    );
  }, [params]);

  // Update prevParams ref
  useEffect(() => {
    prevParamsRef.current = params;
  }, [params]);

  // Data query - Only run when storeCode exists
  const {
    data: ordersResponse,
    fetchNextPage,
    isFetching,
    isFetchingNextPage,
    hasNextPage,
    refetch,
    hasPreviousPage,
    isSuccess,
    isPending,
  } = useSearchOrders(params);

  const orderList = useMemo(
    () => ordersResponse?.pages || [],
    [ordersResponse?.pages],
  );
  const hasItems = orderList.length > 0;
  const hasError = !!(ordersResponse as any)?.error;
  const isLoading =
    !hasPreviousPage && isPending && !isManualRefreshRef.current;

  // Reset scan QR flag after successful fetch
  useEffect(() => {
    if (isSuccess && fromScanQrCode) {
      setFromScanQrCode(false);
    }
  }, [isSuccess, fromScanQrCode]);

  // First page reset function - memoized
  const goFirstPage = useCallback(async () => {
    await queryClient.resetQueries({ queryKey: ['searchOrders', params] });
    return refetch();
  }, [params, refetch]);

  // Reset page on filter changes
  useEffect(() => {
    if (!isInitialRender.current && haveParamsChanged()) {
      isManualRefreshRef.current = false;
      goFirstPage();
    } else {
      isInitialRender.current = false;
    }
  }, [selectedOrderCounter, deliveryType, goFirstPage, haveParamsChanged]);

  // Refresh on screen focus
  useFocusEffect(
    useCallback(() => {
      if (!isInitialRender.current) {
        refetch();
      }
      return () => {};
    }, [refetch]),
  );

  // Pull-to-refresh handler
  const handleRefresh = useCallback(() => {
    refreshToken();
    refetchGetMyProfile();

    isManualRefreshRef.current = true;
    setIsRefreshIndicatorVisible(true);

    Promise.all([
      goFirstPage(),
      queryClient.invalidateQueries({
        queryKey: ['getOrderStatusCounters'],
      }),
      queryClient.invalidateQueries({
        queryKey: ['getOrderDeliveryTypeCounters', selectedOrderCounter],
      }),
    ]).finally(() => {
      // Hide refresh indicator after all queries complete
      setTimeout(() => setIsRefreshIndicatorVisible(false), 500);
    });
  }, [goFirstPage, refetchGetMyProfile, refreshToken, selectedOrderCounter]);

  // Handle end reached - load more data
  const handleEndReached = useCallback(() => {
    if (hasNextPage && !isFetching && !isFetchingNextPage) {
      isManualRefreshRef.current = false;
      fetchNextPage();
    }
  }, [hasNextPage, isFetching, isFetchingNextPage, fetchNextPage]);

  // Memoize item renderer to prevent unnecessary re-renders
  const renderItem = useCallback(
    ({ item }: { item: any }) => {
      // Fast path: Chỉ render các items gần viewport
      return (
        <MemoizedOrderItem
          item={item}
          selectedOrderCounter={selectedOrderCounter}
        />
      );
    },
    [selectedOrderCounter],
  );

  // Optimize key extraction
  const keyExtractor = useCallback(
    (item: any, index: number) => `${item.code}-${index}`,
    [],
  );

  const dismissKeyboardOnScroll = useCallback(() => {
    Keyboard.dismiss();
  }, []);

  // Conditional rendering based on state
  if (isLoading) {
    return (
      <View className="flex-1 bg-white">
        <Header />
        <View className="px-4">
          <OrderListSkeleton />
        </View>
      </View>
    );
  }

  if (hasError) {
    return (
      <View className="flex-1 bg-white">
        <Header />
        <View className="px-4">
          <ErrorMessage error={(ordersResponse as any)?.error} />
        </View>
      </View>
    );
  }

  return (
    <View className="mb-4 flex-grow bg-white">
      <PullToRefreshFlatList
        className="flex-1"
        keyboardDismissMode="on-drag"
        onScrollBeginDrag={dismissKeyboardOnScroll}
        showsVerticalScrollIndicator={false}
        showsHorizontalScrollIndicator={false}
        ref={flatListRef}
        refreshing={isRefreshIndicatorVisible}
        onRefresh={handleRefresh}
        ListHeaderComponent={Header}
        stickyHeaderIndices={[0]}
        ListEmptyComponent={<EmptyComponent isFetching={isFetching} />}
        data={orderList}
        onEndReachedThreshold={0.3}
        onEndReached={handleEndReached}
        ListFooterComponent={
          <ListFooter
            isFetchingNextPage={isFetchingNextPage}
            hasNextPage={hasNextPage}
            isFetching={isFetching}
            hasItems={hasItems}
          />
        }
        keyExtractor={keyExtractor}
        renderItem={renderItem}
        removeClippedSubviews={true}
        initialNumToRender={5}
        maxToRenderPerBatch={3}
        updateCellsBatchingPeriod={75}
        windowSize={3}
      />
    </View>
  );
};

export default memo(OrderList);

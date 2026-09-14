import { TouchableOpacity } from '@gorhom/bottom-sheet';
import clsx from 'clsx';
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
  InteractionManager,
  NativeScrollEvent,
  NativeSyntheticEvent,
  Text,
  View,
} from 'react-native';
import { FlatList } from 'react-native-gesture-handler';
import { useGetOrderStatusCounters } from '~/src/api/app-pick';
import { queryClient } from '~/src/api/shared';
import {
  ORDER_COUNTER_STATUS,
  ORDER_COUNTER_STATUS_PRIORITY,
} from '@/core/constants/order';
import { useAuth } from '~/src/core';
import { setSelectedOrderCounter, useOrders } from '~/src/core/store/orders';

/**
 * Một số máy không gọi onMomentumScrollEnd sau scrollToIndex — vẫn cần fallback.
 */
const FALLBACK_COMMIT_AFTER_MS = 450;
/** Ước lượng width tab ngang — dùng cho getItemLayout & fallback khi chưa measure (averageItemLength: 0). */
const ESTIMATED_TAB_ITEM_WIDTH = 120;

const TabsStatus = () => {
  const ref = useRef<any>();
  const cachingOrderStatusCounters = useRef<any>(null);
  /** Tab user vừa bấm: commit store + API khi scroll dừng (onMomentumScrollEnd). */
  const pendingCommitTabIdRef = useRef<string | null>(null);
  const fallbackCommitTimerRef = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );

  const { storeCode } = useAuth.use.userInfo();
  const { data, refetch, isStale } = useGetOrderStatusCounters();
  const orderStatusCounters = data?.data
    ? { ...cachingOrderStatusCounters.current, ...data.data }
    : {};
  const { error } = data || {};
  const selectedOrderCounter = useOrders.use.selectedOrderCounter();
  /** Highlight ngay khi bấm; store cập nhật sau scroll để list đỡ lag. */
  const [pendingTabId, setPendingTabId] = useState<string | null>(null);
  const displaySelected = pendingTabId ?? selectedOrderCounter;

  useEffect(() => {
    cachingOrderStatusCounters.current = orderStatusCounters;
  }, [orderStatusCounters]);

  useEffect(() => {
    if (pendingTabId != null && pendingTabId === selectedOrderCounter) {
      setPendingTabId(null);
    }
  }, [pendingTabId, selectedOrderCounter]);

  useEffect(() => {
    return () => {
      if (fallbackCommitTimerRef.current != null) {
        clearTimeout(fallbackCommitTimerRef.current);
      }
    };
  }, []);

  const isFirtTime = useRef(true);

  useFocusEffect(
    useCallback(() => {
      if (!isFirtTime.current && isStale) {
        refetch();
      }
      return () => {
        isFirtTime.current = false;
      };
    }, [isStale, refetch]),
  );

  useEffect(() => {
    refetch();
  }, [storeCode]);

  const dataStatusCounters = useMemo(() => {
    return Object.keys(orderStatusCounters)
      ?.filter((key) => ORDER_COUNTER_STATUS_PRIORITY[key] !== undefined)
      ?.map((key: string) => {
        return {
          id: key,
          label: ORDER_COUNTER_STATUS[key],
          priority: ORDER_COUNTER_STATUS_PRIORITY[key],
          number: (orderStatusCounters as any)[key],
        };
      });
  }, [orderStatusCounters]);

  const sortedDataStatusCounters = useMemo(() => {
    return sortByPriority(dataStatusCounters || []);
  }, [dataStatusCounters]);

  const sortedDataRef = useRef(sortedDataStatusCounters);
  sortedDataRef.current = sortedDataStatusCounters;

  /** Ref + callback ổn định: chỉ đọc sorted mới nhất — tránh effect phụ thuộc goTabSelected (đổi mỗi lần refetch → scroll nhầm về tab đầu). */
  const scrollToTabId = useCallback((tabId: string) => {
    const sorted = sortedDataRef.current;
    if (sorted.findIndex((s) => s.id === tabId) === -1 || sorted.length === 0) {
      return;
    }

    const runScroll = () => {
      const fresh = sortedDataRef.current;
      const index = fresh.findIndex((s) => s.id === tabId);
      const dataLength = fresh.length;
      if (
        !ref.current ||
        index === -1 ||
        dataLength === 0 ||
        index < 0 ||
        index >= dataLength
      ) {
        return;
      }
      try {
        ref.current.scrollToIndex({
          animated: true,
          index,
          viewPosition: 0.5,
        });
      } catch (error) {
        if (__DEV__) {
          console.warn('scrollToIndex failed, using fallback:', error);
        }
        const estimatedOffset = Math.max(0, index * ESTIMATED_TAB_ITEM_WIDTH);
        try {
          ref.current.scrollToOffset({
            offset: estimatedOffset,
            animated: true,
          });
        } catch (fallbackError) {
          if (__DEV__) {
            console.warn('scrollToOffset fallback also failed:', fallbackError);
          }
        }
      }
    };

    InteractionManager.runAfterInteractions(() => {
      requestAnimationFrame(runScroll);
    });
  }, []);

  // Handle scroll failure with enhanced error handling
  const handleScrollToIndexFailed = useCallback(
    (info: {
      index: number;
      highestMeasuredFrameIndex: number;
      averageItemLength: number;
    }) => {
      if (!ref.current) return;

      const itemWidth =
        info.averageItemLength > 0
          ? info.averageItemLength
          : ESTIMATED_TAB_ITEM_WIDTH;
      const offset = Math.max(0, itemWidth * info.index);

      try {
        ref.current.scrollToOffset({ offset, animated: true });
      } catch (error) {
        if (__DEV__) {
          console.warn(
            'scrollToOffset failed in handleScrollToIndexFailed:',
            error,
          );
        }
      }
    },
    [],
  );

  // Chỉ khi tab được chọn (store) đổi — không gắn scrollToTabId/sorted vào dep refetch để tránh kéo list về đầu khi counters API về.
  useEffect(() => {
    if (selectedOrderCounter == null) return;
    scrollToTabId(String(selectedOrderCounter));
  }, [selectedOrderCounter, scrollToTabId]);

  const commitPendingTabAfterScroll = useCallback(() => {
    const id = pendingCommitTabIdRef.current;
    if (id == null) return;

    pendingCommitTabIdRef.current = null;
    if (fallbackCommitTimerRef.current != null) {
      clearTimeout(fallbackCommitTimerRef.current);
      fallbackCommitTimerRef.current = null;
    }

    setSelectedOrderCounter(id as any);
  }, []);

  const handleMomentumScrollEnd = useCallback(
    (_e: NativeSyntheticEvent<NativeScrollEvent>) => {
      commitPendingTabAfterScroll();
    },
    [commitPendingTabAfterScroll],
  );

  const handleTabPress = useCallback(
    (itemId: string) => {
      if (itemId === selectedOrderCounter) return;

      queryClient.invalidateQueries({
        queryKey: ['getOrderStatusCounters'],
      });

      // Không invalidate getOrderDeliveryTypeCounters: queryKey gắn selectedOrderCounter,
      // invalidate lúc này refetch tab cũ rồi commit store → fetch tab mới = gọi API 2 lần.

      if (fallbackCommitTimerRef.current != null) {
        clearTimeout(fallbackCommitTimerRef.current);
        fallbackCommitTimerRef.current = null;
      }

      pendingCommitTabIdRef.current = itemId;
      setPendingTabId(itemId);
      scrollToTabId(itemId);

      fallbackCommitTimerRef.current = setTimeout(() => {
        fallbackCommitTimerRef.current = null;
        if (pendingCommitTabIdRef.current === itemId) {
          commitPendingTabAfterScroll();
        }
      }, FALLBACK_COMMIT_AFTER_MS);
    },
    [commitPendingTabAfterScroll, scrollToTabId, selectedOrderCounter],
  );

  const renderTabItem = useCallback(
    ({ item, index }: { item: any; index: number }) => {
      const isStatusSeleted = item.id === displaySelected;
      const isFirst = index === 0;
      const isLast = index === sortedDataStatusCounters?.length - 1;

      return (
        <TouchableOpacity key={item.id} onPress={() => handleTabPress(item.id)}>
          <View
            className={clsx('py- rounded', {
              'pr-4': isFirst,
              'px-3': !isFirst,
              'px-0 pl-3': isLast,
            })}
          >
            <Text
              className={clsx({
                'color-colorPrimary font-semibold':
                  isStatusSeleted && item.id !== 'CANCELLED',
                'color-gray-500': !isStatusSeleted && item.id !== 'CANCELLED',
                'color-red-500 font-bold': item.id === 'CANCELLED',
              })}
            >
              <Text>{item.label}</Text>{' '}
              <Text className="text-blue text-lg">•</Text>{' '}
              <Text>{item.number}</Text>
            </Text>
            {isStatusSeleted && (
              <View
                style={{ height: 2, marginTop: 5 }}
                className={clsx({
                  'rounded-t-md bg-colorPrimary': isStatusSeleted,
                })}
              />
            )}
          </View>
        </TouchableOpacity>
      );
    },
    [displaySelected, sortedDataStatusCounters?.length, handleTabPress],
  );

  if (error) return <></>;

  return (
    <FlatList
      className="mt-4"
      ref={ref}
      showsVerticalScrollIndicator={false}
      showsHorizontalScrollIndicator={false}
      data={sortedDataStatusCounters}
      renderItem={renderTabItem}
      keyExtractor={(item) => item.id}
      getItemLayout={(_, index) => ({
        length: ESTIMATED_TAB_ITEM_WIDTH,
        offset: ESTIMATED_TAB_ITEM_WIDTH * index,
        index,
      })}
      onScrollToIndexFailed={handleScrollToIndexFailed}
      onMomentumScrollEnd={handleMomentumScrollEnd}
      horizontal
      removeClippedSubviews={true}
      maxToRenderPerBatch={10}
      windowSize={10}
      initialNumToRender={5}
    />
  );
};

export default memo(TabsStatus);

function sortByPriority(data: Array<any>) {
  return [...data].sort((a, b) => a.priority - b.priority);
}

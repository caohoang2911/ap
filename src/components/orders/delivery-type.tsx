import { useFocusEffect } from 'expo-router';
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  LayoutChangeEvent,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useGetOrderDeliveryTypeCounters } from '~/src/api/app-pick/use-get-order-delivery-type-counters';
import { prefetchSearchOrders } from '~/src/api/app-pick/use-search-orders';
import { queryClient } from '~/src/api/shared';
import { useAuth } from '~/src/core';
import { useConfig } from '~/src/core/store/config';
import { setDeliveryType, useOrders } from '~/src/core/store/orders';
import { getConfigNameById } from '~/src/core/utils/config';
import { OrderStatus } from '~/src/types/order';

type DeliveryTypeOption = {
  label: React.ReactNode | string;
  value: string;
};

const pickStatus = [
  'SHIPPER_DELIVERY',
  'OFFLINE_HOME_DELIVERY',
  'APARTMENT_COMPLEX_DELIVERY',
  'CUSTOMER_PICKUP',
];

function DeliveryType() {
  const cachingDeliveryTypeCounters = useRef<any>(null);

  const deliveryType = useOrders.use.deliveryType();
  const authStatus = useAuth.use.status();

  const config = useConfig.use.config();
  const orderDeliveryTypes = config?.orderDeliveryTypes || [];
  const refCurrentStatus = useRef<string | null>(null);

  const selectedOrderCounter = useOrders.use.selectedOrderCounter();
  const fromScanQrCode = useOrders.use.fromScanQrCode();

  const isFirtTime = useRef(true);

  const { data, refetch } = useGetOrderDeliveryTypeCounters({
    status: fromScanQrCode ? 'ALL' : (selectedOrderCounter as OrderStatus),
  });
  const safeRefetchCounters = useCallback(() => {
    void refetch().catch(() => null);
  }, [refetch]);

  const counters = data?.data
    ? { ...(cachingDeliveryTypeCounters.current || {}), ...data.data }
    : { ...(cachingDeliveryTypeCounters.current || {}) };

  const [containerWidth, setContainerWidth] = useState(0);
  const [contentWidth, setContentWidth] = useState(0);
  const scrollEnabled = contentWidth > containerWidth;

  useFocusEffect(
    useCallback(() => {
      if (!isFirtTime.current && authStatus === 'signIn') {
        safeRefetchCounters();
      }
      return () => {
        isFirtTime.current = false;
      };
    }, [authStatus, safeRefetchCounters]),
  );

  // Không refetch khi selectedOrderCounter / fromScanQrCode đổi: queryKey đã đổi,
  // useQuery tự chạy queryFn — refetch thêm ở đây = gọi API 2 lần (vd. đổi tab).

  const handleSelect = useCallback(
    (value: string) => {
      queryClient.invalidateQueries({
        queryKey: ['getOrderDeliveryTypeCounters'],
      });

      queryClient.invalidateQueries({
        queryKey: ['getOrderStatusCounters'],
      });

      const nextDeliveryType =
        refCurrentStatus.current === value ? null : value;
      void prefetchSearchOrders(queryClient, {
        status: (fromScanQrCode ? 'ALL' : selectedOrderCounter) as any,
        deliveryType: nextDeliveryType,
      });

      if (refCurrentStatus.current === value) {
        setDeliveryType(null);
        refCurrentStatus.current = null;
      } else {
        setDeliveryType(value);
        refCurrentStatus.current = value;
      }
    },
    [fromScanQrCode, selectedOrderCounter],
  );

  const options: DeliveryTypeOption[] = useMemo(() => {
    return Object.keys(counters)
      .filter((status) => pickStatus.includes(status))
      .map((status) => {
        const shippingMethodName = getConfigNameById(
          orderDeliveryTypes,
          status,
        );

        const textClasses =
          deliveryType === status ? 'text-blue-600' : 'text-gray-500';
        const backgroundColorClass =
          deliveryType === status ? 'bg-blue-50' : 'bg-slate-100';

        return {
          label: (
            <TouchableOpacity onPress={() => handleSelect(status)}>
              <View
                className={`flex flex-row items-center rounded-full py-1 px-2 ${backgroundColorClass}`}
              >
                <Text
                  numberOfLines={1}
                  className={`${textClasses} font-medium text-sm`}
                >
                  {shippingMethodName || status}
                </Text>
                <Text className={`${textClasses} text-lg`}> • </Text>
                <Text className={`${textClasses} font-medium text-sm`}>
                  {counters[status] || 0}
                </Text>
              </View>
            </TouchableOpacity>
          ),
          value: status,
        };
      });
  }, [counters, orderDeliveryTypes, deliveryType, handleSelect]);

  useEffect(() => {
    if (data?.data) {
      cachingDeliveryTypeCounters.current = {
        ...(cachingDeliveryTypeCounters.current || {}),
        ...data.data,
      };
    }
  }, [data?.data]);

  return (
    <View
      className="flex flex-row"
      onLayout={(event: LayoutChangeEvent) => {
        setContainerWidth(event.nativeEvent.layout.width);
      }}
    >
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ justifyContent: 'flex-end', flexGrow: 1 }}
        style={{ flex: 1 }}
        scrollEnabled={scrollEnabled}
        onContentSizeChange={(width) => {
          setContentWidth(width);
        }}
      >
        {options?.map((item, index) => {
          const isLast = index === options.length - 1;
          return (
            <View key={index} className={`${isLast ? 'mr-0' : 'mr-2'}`}>
              {item.label}
            </View>
          );
        })}
      </ScrollView>
    </View>
  );
}

export default DeliveryType;

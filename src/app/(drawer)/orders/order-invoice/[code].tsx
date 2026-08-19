import { useLocalSearchParams, useNavigation } from 'expo-router';
import React, { useCallback, useLayoutEffect, useState } from 'react';
import { Text, View } from 'react-native';
import { useOrderDetailForCode } from '~/src/api/app-pick/use-get-order-detail';
import { useOrderStatusAutoRefresh } from '~/src/core/hooks/useOrderStatusAutoRefresh';
import InvoiceInfo from '~/src/components/order-invoice/invoice-info';
import InvoiceProducts from '~/src/components/order-invoice/invoice-products';
import ShippingInfo from '~/src/components/order-invoice/shipping-info';
import { SectionAlert } from '~/src/components/SectionAlert';
import OrderInvoiceSkeleton from '~/src/components/shared/skeleton/order-detail-skeleton';
import PullToRefreshScrollView from '~/src/components/shared/pull-to-refresh-scroll-view';

const OrderInvoice = () => {
  const navigation = useNavigation();
  const { code } = useLocalSearchParams<{ code: string }>();
  const { isOrderDetailLoading, orderDetailError, refetch } =
    useOrderDetailForCode(code);
  const [isRefreshing, setIsRefreshing] = useState(false);

  useOrderStatusAutoRefresh(code);

  useLayoutEffect(() => {
    navigation.setOptions({
      headerShown: !isOrderDetailLoading,
    });
  }, [isOrderDetailLoading, navigation]);

  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    try {
      await refetch();
    } finally {
      setIsRefreshing(false);
    }
  }, [refetch]);

  if (orderDetailError) {
    return (
      <SectionAlert variant="danger">
        <Text>{orderDetailError}</Text>
      </SectionAlert>
    );
  }

  if (isOrderDetailLoading) {
    return <OrderInvoiceSkeleton />;
  }

  return (
    <>
      <PullToRefreshScrollView
        className="mb-7 flex-1 pt-3"
        refreshing={isRefreshing}
        onRefresh={handleRefresh}
      >
        <View className="flex flex-col gap-4">
          <InvoiceInfo />
          <ShippingInfo />
          <InvoiceProducts />
        </View>
      </PullToRefreshScrollView>
    </>
  );
};

export default OrderInvoice;

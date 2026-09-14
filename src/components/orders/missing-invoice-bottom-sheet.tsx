import Feather from '@expo/vector-icons/Feather';
import { BottomSheetFlatList } from '@gorhom/bottom-sheet';
import { useRouter } from 'expo-router';
import { toLower } from 'lodash';
import moment from 'moment';
import React, {
  forwardRef,
  useCallback,
  useImperativeHandle,
  useRef,
  useState,
} from 'react';
import { ActivityIndicator, Text, View } from 'react-native';
import { TouchableOpacity } from 'react-native-gesture-handler';
import { prefetchOrderDetailForCode } from '~/src/api/app-pick/use-get-order-detail';
import { useSearchOrders } from '~/src/api/app-pick/use-search-orders';
import { Badge } from '~/src/components/Badge';
import SBottomSheet from '~/src/components/SBottomSheet';
import { expectedDeliveryTime } from '~/src/core/utils/moment';
import { formatCurrency } from '~/src/core/utils/number';
import { Order } from '~/src/types/order';

const PARAMS = { isMissingInvoiceOrders: true };

const MissingInvoiceOrderItem = ({
  item,
  onPress,
}: {
  item: Order;
  onPress: () => void;
}) => {
  const router = useRouter();
  const isNavigatingRef = useRef(false);

  const handlePress = useCallback(() => {
    if (isNavigatingRef.current) return;
    isNavigatingRef.current = true;

    onPress();
    prefetchOrderDetailForCode({ orderCode: item.code });
    router.push({
      pathname: `orders/order-pick/${item.code}`,
      params: { status: item.status },
    });

    setTimeout(() => {
      isNavigatingRef.current = false;
    }, 800);
  }, [item.code, item.status, router, onPress]);

  const deliveryDay = item.deliveryTimeRange
    ? expectedDeliveryTime(item.deliveryTimeRange).day
    : null;
  const deliveryHh = item.deliveryTimeRange
    ? expectedDeliveryTime(item.deliveryTimeRange).hh
    : null;

  return (
    <TouchableOpacity onPress={handlePress}>
      <View className="mx-4 mb-3 rounded-md border border-gray-200 overflow-hidden bg-white">
        <View className="bg-bgPrimary px-3 py-2.5 flex flex-row justify-between items-center">
          <Text className="font-semibold text-base text-colorPrimary">
            {item.code}
          </Text>
          <Badge
            label={item.statusName}
            variant={toLower(item.status) as any}
          />
        </View>
        <View className="px-3 py-2.5 gap-2">
          <View className="flex flex-row items-center gap-2">
            <Feather name="user" size={16} color="gray" />
            <Text className="font-medium flex-1" numberOfLines={1}>
              {item.customer?.name}
            </Text>
            <Badge
              label={
                <Text className="text-sm">
                  {formatCurrency(item.amount, { unit: true })}
                </Text>
              }
              variant="warning"
            />
          </View>
          {deliveryDay && (
            <View className="flex flex-row items-center gap-2">
              <Feather name="calendar" size={16} color="gray" />
              <Text className="text-gray-600">
                {deliveryDay}
                {deliveryHh ? (
                  <Text className="text-orange-500 font-semibold">
                    {' '}
                    {deliveryHh}
                  </Text>
                ) : null}
              </Text>
            </View>
          )}
          <View className="flex flex-row items-center gap-2">
            <Feather name="clock" size={16} color="gray" />
            <Text className="text-gray-500 text-sm">
              Đặt {moment(item.orderTime).format('DD/MM/YYYY HH:mm')}
            </Text>
          </View>
        </View>
      </View>
    </TouchableOpacity>
  );
};

const MissingInvoiceBottomSheet = forwardRef<any>((_, ref) => {
  const [visible, setVisible] = useState(false);
  const bottomSheetRef = useRef<any>(null);

  useImperativeHandle(ref, () => ({
    present: () => {
      setVisible(true);
      requestAnimationFrame(() => bottomSheetRef.current?.present());
    },
    dismiss: () => {
      bottomSheetRef.current?.dismiss();
    },
  }));

  const handleClose = useCallback(() => setVisible(false), []);

  const { data, isFetchingNextPage, hasNextPage, fetchNextPage, isLoading } =
    useSearchOrders(
      PARAMS as any,
      { enabled: visible },
      'missingInvoiceOrders',
    );

  const orders = (data?.pages as unknown as Order[]) ?? [];

  const handleItemPress = useCallback(() => {
    bottomSheetRef.current?.dismiss();
  }, []);

  const renderItem = useCallback(
    ({ item }: { item: Order }) => (
      <MissingInvoiceOrderItem item={item} onPress={handleItemPress} />
    ),
    [handleItemPress],
  );

  const renderFooter = useCallback(() => {
    if (!isFetchingNextPage) return <View className="h-4" />;
    return (
      <View className="py-4 items-center">
        <ActivityIndicator size="small" />
      </View>
    );
  }, [isFetchingNextPage]);

  const renderEmpty = useCallback(() => {
    if (isLoading) {
      return (
        <View className="py-12 items-center">
          <ActivityIndicator size="large" />
        </View>
      );
    }
    return (
      <View className="py-12 items-center">
        <Text className="text-gray-400">Không có đơn chưa tạo HĐ</Text>
      </View>
    );
  }, [isLoading]);

  return (
    <SBottomSheet
      ref={bottomSheetRef}
      title="Đơn chưa tạo hóa đơn"
      titleAlign="left"
      visible={visible}
      snapPoints={['70%', '90%']}
      onClose={handleClose}
      disableScrollView
    >
      <BottomSheetFlatList
        data={orders}
        keyExtractor={(item: Order) => item.code}
        renderItem={renderItem}
        ListEmptyComponent={renderEmpty}
        ListFooterComponent={renderFooter}
        contentContainerStyle={{ paddingTop: 12 }}
        onEndReached={() =>
          hasNextPage && !isFetchingNextPage && fetchNextPage()
        }
        onEndReachedThreshold={0.3}
      />
    </SBottomSheet>
  );
});
MissingInvoiceBottomSheet.displayName = 'MissingInvoiceBottomSheet';

export default MissingInvoiceBottomSheet;

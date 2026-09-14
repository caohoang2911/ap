import { ORDER_DELIVERY_TYPE } from '@/core/constants/order';
import { Feather } from '@expo/vector-icons';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { router } from 'expo-router';
import React, { forwardRef, useImperativeHandle, useMemo, useRef } from 'react';
import { Pressable, Text, View } from 'react-native';
import { NavigationHelpers } from '~/src/core/utils/navigation';
import {
  getScanToDeliveryInfo,
  isEnableScanToDelivery,
  isHiddenScanToDelivery,
} from '~/src/core/utils/order';
import { OrderStatus } from '~/src/types/order';
import SBottomSheet from '../SBottomSheet';

interface OrderActionsBottomSheetProps {
  orderCode: string;
  orderStatus?: string;
  orderType?: string;
  status?: string;
  deliveryType?: string;
  visible: boolean;
  onClose: () => void;
}

export interface OrderActionsBottomSheetRef {
  present: () => void;
  dismiss: () => void;
}

const OrderActionsBottomSheet = forwardRef<
  OrderActionsBottomSheetRef,
  OrderActionsBottomSheetProps
>(({ orderCode, status, deliveryType, visible, onClose }, ref) => {
  const bottomSheetRef = useRef<OrderActionsBottomSheetRef>(null);

  const scanToDeliveryInfo = useMemo(
    () =>
      getScanToDeliveryInfo({
        deliveryType: deliveryType as ORDER_DELIVERY_TYPE,
        status: status as OrderStatus,
        orderCode,
      }),
    [deliveryType, status, orderCode],
  );

  useImperativeHandle(ref, () => ({
    present: () => {
      bottomSheetRef.current?.present();
    },
    dismiss: () => {
      bottomSheetRef.current?.dismiss();
    },
  }));

  const handleOrderInfoWithClose = () => {
    onClose();
    NavigationHelpers.toOrderInvoice(orderCode);
  };

  const handlePickOrderWithClose = () => {
    onClose();
    NavigationHelpers.toOrderPick(orderCode);
  };

  const handleScanBagDeliveryWithClose = () => {
    onClose();
    bottomSheetRef.current?.dismiss();
    router.push(scanToDeliveryInfo?.route as string);
  };

  const ActionItem = ({
    icon,
    title,
    enabled = true,
    onPress,
  }: {
    icon: string | React.ReactNode;
    title: string | null;
    enabled?: boolean;
    onPress: () => void;
  }) => (
    <Pressable
      disabled={!enabled}
      style={{
        backgroundColor: enabled ? '' : 'rgba(0, 0, 0, 0.05)',
        opacity: enabled ? 1 : 0.3,
      }}
      onPress={onPress}
      className="flex flex-row items-center py-4 px-2 border-b border-gray-200"
    >
      <View className="mr-4">
        {typeof icon === 'string' ? (
          <Feather name={icon as any} size={20} color="#374151" />
        ) : (
          icon
        )}
      </View>
      <Text className="text-base text-gray-800 font-medium">{title}</Text>
    </Pressable>
  );

  const shouldHideScanToDelivery =
    useMemo(
      () =>
        isHiddenScanToDelivery({
          deliveryType: deliveryType as ORDER_DELIVERY_TYPE,
        }),
      [deliveryType],
    ) || false;
  return (
    <>
      <SBottomSheet
        ref={bottomSheetRef}
        visible={visible}
        onClose={onClose}
        snapPoints={[270]}
        title="Thao tác"
        renderTitle={
          <View className="flex flex-row items-center">
            <Text className="font-semibold text-lg">Thao tác</Text>
            <Text className="font-semibold text-lg ml-2">{orderCode}</Text>
          </View>
        }
        titleAlign="left"
      >
        <View className="px-4">
          <ActionItem
            icon={
              <MaterialCommunityIcons
                name="barcode-scan"
                size={20}
                color="black"
              />
            }
            title="Pick đơn hàng"
            onPress={handlePickOrderWithClose}
            enabled={true}
          />
          <ActionItem
            icon="file-text"
            title="Thông tin đơn hàng"
            onPress={handleOrderInfoWithClose}
            enabled={true}
          />
          {!shouldHideScanToDelivery && (
            <ActionItem
              icon="package"
              title={
                getScanToDeliveryInfo({
                  deliveryType: deliveryType as ORDER_DELIVERY_TYPE,
                  status: status as OrderStatus,
                  orderCode,
                })?.title || ''
              }
              onPress={handleScanBagDeliveryWithClose}
              enabled={isEnableScanToDelivery({
                status: status as OrderStatus,
              })}
            />
          )}
        </View>
      </SBottomSheet>
    </>
  );
});

OrderActionsBottomSheet.displayName = 'OrderActionsBottomSheet';

export default OrderActionsBottomSheet;

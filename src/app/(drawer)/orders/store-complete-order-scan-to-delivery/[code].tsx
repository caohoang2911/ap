import {
  router,
  useLocalSearchParams,
  useNavigation,
  useSegments,
} from 'expo-router';
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useState,
} from 'react';
import { Text, View } from 'react-native';
import { useOrderDetailForCode } from '~/src/api/app-pick/use-get-order-detail';
import { useOrderStatusAutoRefresh } from '~/src/core/hooks/useOrderStatusAutoRefresh';
import { useHandoverOrder } from '~/src/api/app-pick/use-handover-order';
import { showMessage } from 'react-native-flash-message';
import Box from '~/src/components/Box';
import { Button } from '~/src/components/Button';
import ImageUploader from '~/src/components/ImageUploader';
import { SectionAlert } from '~/src/components/SectionAlert';
import FailureReasonBottomSheet from '~/src/components/store-complete-order-scan-to-delivery/failure-reason-bottom-sheet';
import InvoiceInfo from '~/src/components/store-complete-order-scan-to-delivery/invoice-info';
import PullToRefreshScrollView from '~/src/components/shared/pull-to-refresh-scroll-view';
import { ORDER_STATUS, ORDER_TAGS } from '@/core/constants/order';
import { hideAlert, showAlert } from '~/src/core/store/alert-dialog';
import {
  setCompleteUploadedImages,
  useStoreCompleteOrderScanToDelivery,
} from '~/src/core/store/store-complete-order-scan-to-delivery';
import { setLoading } from '~/src/core/store/loading';
import { OrderDetailHeader } from '~/src/types/order-pick';
import InvoiceAlert from '~/src/components/order-scan-to-delivery/invoice-alert';
import ShipperInfo from '~/src/components/shared/shipper-info';
import Header from '~/src/components/shared/header';
import ButtonBack from '~/src/components/ButtonBack';
import { getScanToDeliveryInfo } from '~/src/core/utils/order';
import { queryClient } from '~/src/api/shared/api-provider';
import ScanBagsSkeleton from '~/src/components/shared/skeleton/scan-bags-skeleton';

const OrderScanToDelivery = () => {
  const navigation = useNavigation();
  const segments = useSegments();
  const { code } = useLocalSearchParams<{ code: string }>();
  const {
    isOrderDetailLoading,
    isOrderDetailFetching,
    orderDetailError,
    orderDetail,
  } = useOrderDetailForCode(code);

  useOrderStatusAutoRefresh(code);

  const header = orderDetail?.header;
  const { tags, status, codAmount, deliveryType, shipping } =
    (header as OrderDetailHeader) || {};

  const proofImages = useStoreCompleteOrderScanToDelivery.use.uploadedImages();
  const [showFailureBottomSheet, setShowFailureBottomSheet] = useState(false);

  const title = getScanToDeliveryInfo({
    deliveryType,
    status,
    orderCode: code,
    shipping,
  })?.title;

  const { mutate: handoverOrder, isPending: isLoadingHandoverOrder } =
    useHandoverOrder(() => {
      showMessage({
        message: 'Đã hoàn tất',
        type: 'success',
      });
      setLoading(false);
      setCompleteUploadedImages('', true);
      router.push(`/orders`);
    });

  useLayoutEffect(() => {
    if (code) setCompleteUploadedImages('', true);
  }, [code]);

  useLayoutEffect(() => {
    navigation.setOptions({
      headerShown: true,
      header: () => (
        <Header
          title={title || ''}
          headerLeft={<ButtonBack onPress={() => router.dismiss(1)} />}
        />
      ),
    });
  }, [title, navigation, code, deliveryType, status]);

  useEffect(() => {
    return () => {
      setCompleteUploadedImages('', true);
    };
  }, []);

  const handleUploadedImages = useCallback((image: string) => {
    setCompleteUploadedImages(image);
  }, []);

  const isShowAlert = useMemo(() => {
    return !tags?.includes(ORDER_TAGS.ORDER_CREATED_INVOICE);
  }, [tags]);

  const handleRefresh = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['orderDetail'], exact: true });
  }, []);

  const featureAvailable = status === ORDER_STATUS.SHIPPING;

  const handleHandoverOrder = useCallback(() => {
    showAlert({
      title: 'Hoàn tất giao hàng?',
      message: `Bạn có chắc chắn hoàn tất giao hàng?`,
      onConfirm: () => {
        hideAlert();
        handoverOrder({ orderCode: code, proofImages });
      },
    });
  }, [code, handoverOrder, proofImages]);

  const handleHandoverFailOrder = useCallback(() => {
    setShowFailureBottomSheet(true);
  }, []);

  const handleCloseFailureBottomSheet = useCallback(() => {
    setShowFailureBottomSheet(false);
  }, []);

  if (orderDetailError) {
    return (
      <SectionAlert variant="danger">
        <Text>{orderDetailError}</Text>
      </SectionAlert>
    );
  }

  if (isOrderDetailLoading) {
    return <ScanBagsSkeleton />;
  }

  return (
    <>
      <View className="flex-1 mt-3">
        <PullToRefreshScrollView
          refreshing={isOrderDetailFetching}
          onRefresh={handleRefresh}
        >
          <InvoiceAlert show={isShowAlert} codAmount={codAmount} />
          <View className="flex flex-col gap-4">
            <ShipperInfo orderDetail={orderDetail || {}} />
            <InvoiceInfo />
            <Box>
              <ImageUploader
                proofDeliveryImages={proofImages}
                onUploadedImages={handleUploadedImages}
              />
            </Box>
          </View>
        </PullToRefreshScrollView>
      </View>
      <View className="border-t border-gray-200 pb-4">
        <View className="px-4 py-3 flex flex-row gap-3 bg-white ">
          <Button
            loading={isLoadingHandoverOrder}
            onPress={handleHandoverOrder}
            label={'Hoàn tất giao hàng'}
            className="flex-1"
            disabled={featureAvailable && proofImages?.length === 0}
          />
          <Button
            className="flex-1"
            onPress={handleHandoverFailOrder}
            label={'Giao hàng thất bại'}
            variant="warning"
          />
        </View>
      </View>

      <FailureReasonBottomSheet
        visible={showFailureBottomSheet}
        orderCode={code}
        onClose={handleCloseFailureBottomSheet}
        segments={segments}
      />
    </>
  );
};

export default OrderScanToDelivery;

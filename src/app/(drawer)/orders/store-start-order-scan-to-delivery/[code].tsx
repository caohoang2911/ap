import { ORDER_DELIVERY_TYPE, ORDER_TAGS } from '@/core/constants/order';
import { BarcodeScanningResult } from '~/src/types/scanner';
import { router, useLocalSearchParams, useNavigation } from 'expo-router';
import React, {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { RefreshControl, Text, View } from 'react-native';
import { ScrollView } from 'react-native-gesture-handler';
import {
  useCreateInvoiceFlow,
  useCreateInvoiceProcess,
  usePrintCodReceiptProcess,
} from '~/src/api/app-pick/use-create-invoice';
import { useOrderDetailForCode } from '~/src/api/app-pick/use-get-order-detail';
import { useOrderStatusAutoRefresh } from '~/src/core/hooks/useOrderStatusAutoRefresh';
import { useHandoverOrder } from '~/src/api/app-pick/use-handover-order';
import { useSetOrderScannedBagLabelScanned } from '~/src/api/app-pick/use-set-order-scanned-bag-label-scanned';
import { useStartSelfShipping } from '~/src/api/app-pick/use-start-self-shipping';
import { queryClient } from '~/src/api/shared/api-provider';
import { Button } from '~/src/components/Button';
import ButtonBack from '~/src/components/ButtonBack';
import CODReceipt from '~/src/components/CODReceipt';
import InvoiceAlert from '~/src/components/order-scan-to-delivery/invoice-alert';
import { SectionAlert } from '~/src/components/SectionAlert';
import Header from '~/src/components/shared/header';
import ScannerBox from '~/src/components/shared/scanner-box';
import ShipperInfo from '~/src/components/shared/shipper-info';
import Bags from '~/src/components/store-start-order-scan-to-delivery/bags';
import InvoiceInfo from '~/src/components/store-start-order-scan-to-delivery/invoice-info';
import { useAuth } from '~/src/core';
import { useCheckShift } from '~/src/core/hooks/useCheckShift';
import { usePdaScanTarget } from '~/src/core/hooks/usePdaScanTarget';
import { hideAlert, showAlert } from '~/src/core/store/alert-dialog';
import { setLoading } from '~/src/core/store/loading';
import { showMessage } from 'react-native-flash-message';
import { setUploadedImages } from '~/src/core/store/order-scan-to-delivery';
import {
  getIsScanQrCodeProduct,
  scanQrCodeSuccess,
  setStoreStartOrderBags,
  toggleStoreStartScanQrCodeProduct,
  useStoreStartOrderScanToDelivery,
} from '~/src/core/store/store-start-order-scan-to-delivery';
import { APP_ROUTES } from '~/src/core';
import {
  getScanToDeliveryInfo,
  isApartmentComplexDriverHandover,
} from '~/src/core/utils/order';
import { transformBagsData } from '~/src/core/utils/order-bags';
import { OrderDetailHeader } from '~/src/types/order-pick';
import ScanBagsSkeleton from '~/src/components/shared/skeleton/scan-bags-skeleton';

const OrderScanToDelivery = () => {
  const navigation = useNavigation();
  const { code } = useLocalSearchParams<{ code: string }>();

  const {
    isOrderDetailLoading,
    isOrderDetailFetching,
    orderDetailError,
    orderDetail,
  } = useOrderDetailForCode(code);

  useOrderStatusAutoRefresh(code);

  const [showPrintReceipt, setShowPrintReceipt] = useState(false);

  const header = orderDetail?.header as OrderDetailHeader | undefined;

  const { tags, deliveryType, codAmount, shipping, status } = header || {};

  const user = useAuth.use.userInfo();
  const { name, username } = user || {};

  const orderBags = useStoreStartOrderScanToDelivery.use.orderBags();

  const isScanQrCodeProduct = getIsScanQrCodeProduct();

  const title = getScanToDeliveryInfo({
    deliveryType,
    status,
    orderCode: code,
    shipping,
  })?.title;

  useEffect(() => {
    if (title) {
      navigation.setOptions({
        headerShown: true,
        header: () => (
          <Header
            title={title}
            headerLeft={<ButtonBack onPress={() => router.dismiss(1)} />}
          />
        ),
      });
    }
  }, [title, navigation]);

  useEffect(() => {
    if (isOrderDetailLoading || !header) return;

    const scanInfo = getScanToDeliveryInfo({
      deliveryType,
      status,
      orderCode: code,
      shipping,
    });

    if (
      isApartmentComplexDriverHandover({ deliveryType, status, shipping }) &&
      scanInfo?.route === APP_ROUTES.ORDER_SCAN_TO_DELIVERY(code)
    ) {
      router.replace(scanInfo.route);
    }
  }, [isOrderDetailLoading, header, deliveryType, status, code, shipping]);

  const invalidateOrderDetail = useCallback(async () => {
    await queryClient.invalidateQueries({ queryKey: ['orderDetail', code] });
  }, []);

  const { mutate: startSelfShipping, isPending: isLoadingStartSelfShipping } =
    useStartSelfShipping(() => {
      setLoading(false);
      queryClient.invalidateQueries({ queryKey: ['orderDetail', code] });
      router.replace(`/orders/store-complete-order-scan-to-delivery/${code}`);
    });

  const {
    mutateAsync: processCreateInvoice,
    isPending: isLoadingCreateInvoice,
  } = useCreateInvoiceProcess();

  const { mutate: printCodReceipt } = usePrintCodReceiptProcess({
    successMessage: 'In phiếu thu COD thành công',
    onSettled: () => {
      startSelfShipping({ orderCode: code });
    },
  });

  const createInvoiceFlowOrderCodeRef = useRef<string | null>(null);
  const { mutate: createInvoiceFlow, data: createInvoiceFlowData } =
    useCreateInvoiceFlow({
      onSuccess: async (orderCode) => {
        await invalidateOrderDetail();
        await processCreateInvoice({ orderCode });
        if (!!Number(codAmount)) {
          setShowPrintReceipt(true);
          setLoading(false);
        } else {
          startSelfShipping({ orderCode: code });
        }
      },
    });
  const invoiceCode =
    orderDetail?.header?.invoiceCode ??
    (createInvoiceFlowOrderCodeRef.current === code
      ? createInvoiceFlowData?.data?.invoiceCode
      : undefined);

  const { isPending: isLoadingHandoverOrder, mutate: handoverOrder } =
    useHandoverOrder(() => {
      showMessage({
        message: 'Đã hoàn tất',
        type: 'success',
      });
      setLoading(false);
      setUploadedImages('', true);
      queryClient.invalidateQueries({ queryKey: ['orderDetail', code] });
      router.back();
    });

  const shouldEnableCapture = Number(codAmount) > 0 && showPrintReceipt;

  // Reset store khi đổi đơn (code) hoặc khi rời màn — store là global, tránh dính đơn khác
  useLayoutEffect(() => {
    if (code) {
      setStoreStartOrderBags([]);
      toggleStoreStartScanQrCodeProduct(false);
    }
  }, [code]);

  useEffect(() => {
    if (orderDetail?.header?.bagLabels?.length) {
      const bagsType = transformBagsData(orderDetail.header.bagLabels);
      const flatBags = [
        ...bagsType.DRY,
        ...bagsType.FROZEN,
        ...bagsType.FRESH,
      ]?.map((bag) => ({ ...bag, isDone: bag.isDone ?? false }));
      setStoreStartOrderBags(flatBags);
    }
  }, [orderDetail?.header?.bagLabels]);

  useEffect(() => {
    return () => {
      setStoreStartOrderBags([]);
      toggleStoreStartScanQrCodeProduct(false);
    };
  }, []);

  const { mutate: setOrderScannedBagLabel } =
    useSetOrderScannedBagLabelScanned();

  const isAllDone = useMemo(() => {
    if (!Array.isArray(orderBags) || orderBags.length === 0) return false;
    return orderBags.every((bag) => bag.isDone || bag.lastScannedTime);
  }, [orderBags]);

  const isShipperDelivery = !!shipping?.driverName;

  const btnWithoutInvoiceLabel = useMemo(() => {
    if (isShipperDelivery) {
      return 'Xác nhận giao cho tài xế';
    }
    return 'Bắt đầu giao hàng nội khu';
  }, [isShipperDelivery]);

  const btnWithInvoiceLabel = useMemo(() => {
    if (isShipperDelivery) {
      return 'Tạo hoá đơn & giao cho tài xế';
    }
    return 'Tạo hoá đơn & giao hàng nội khu';
  }, [isShipperDelivery]);

  const isShowAlert = useMemo(() => {
    return !tags?.includes(ORDER_TAGS.ORDER_CREATED_INVOICE);
  }, [tags]);

  const handleRefresh = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['orderDetail', code] });
  }, []);

  const handleReceiptCaptureComplete = useCallback(
    (base64String: string) => {
      setShowPrintReceipt(false);
      printCodReceipt({ codReceiptBase64String: base64String.trim() });
    },
    [printCodReceipt],
  );

  const handleScanQrCodeProduct = useCallback(
    (result: BarcodeScanningResult) => {
      scanQrCodeSuccess(result, () => {
        if (result?.data) {
          setOrderScannedBagLabel({ orderCode: code, bagCode: result?.data });
        }
      });
    },
    [code, setOrderScannedBagLabel],
  );

  // Quét túi bằng máy PDA (đầu đọc laser) dùng chung handler với camera.
  usePdaScanTarget(handleScanQrCodeProduct);

  const { checkShift } = useCheckShift(() => {
    showAlert({
      stackId: `create-invoice-${code}`,
      title: btnWithInvoiceLabel + '?',
      onConfirm: () => {
        hideAlert();
        createInvoiceFlowOrderCodeRef.current = code;
        setLoading(true);
        createInvoiceFlow({ orderCode: code });
      },
    });
  });

  const handleStartDeliveryWithInvoice = () => {
    checkShift();
  };

  const handleStartDeliveryWithoutInvoice = () => {
    showAlert({
      title: btnWithoutInvoiceLabel + '?',
      onConfirm: () => {
        hideAlert();
        if (isShipperDelivery) {
          handoverOrder({ orderCode: code });
        } else {
          startSelfShipping({ orderCode: code });
        }
      },
    });
  };

  const handleStartScanQrCodeProduct = () => {
    toggleStoreStartScanQrCodeProduct(true);
  };

  const isDisabled = !orderBags?.length || isOrderDetailLoading;

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
        <ScrollView
          refreshControl={
            <RefreshControl
              refreshing={isOrderDetailFetching}
              onRefresh={handleRefresh}
            />
          }
        >
          <InvoiceAlert show={isShowAlert} codAmount={codAmount} />
          <View className="flex flex-col gap-4">
            <ShipperInfo orderDetail={orderDetail || {}} />
            <InvoiceInfo />
            <View className="border-t border-gray-200 pb-3">
              <Bags />
            </View>
          </View>
        </ScrollView>
      </View>
      <View className="border-t border-gray-200 pb-4">
        <View className="px-4 py-3 bg-white gap-2">
          {!isAllDone ? (
            <Button
              loading={isLoadingStartSelfShipping}
              onPress={handleStartScanQrCodeProduct}
              disabled={isDisabled}
              label={'Scan QR túi để giao hàng'}
            />
          ) : deliveryType === ORDER_DELIVERY_TYPE.OFFLINE_HOME_DELIVERY ? (
            <Button
              loading={isLoadingStartSelfShipping}
              onPress={handleStartDeliveryWithoutInvoice}
              disabled={isDisabled}
              label={btnWithoutInvoiceLabel}
            />
          ) : (
            <Button
              loading={
                isLoadingStartSelfShipping ||
                isLoadingCreateInvoice ||
                isLoadingHandoverOrder
              }
              onPress={handleStartDeliveryWithInvoice}
              disabled={isDisabled}
              label={btnWithInvoiceLabel}
            />
          )}
        </View>
      </View>
      <CODReceipt
        orderCode={code}
        invoiceNumber={invoiceCode || ''}
        codAmount={Number(codAmount)}
        employeeName={name || ''}
        employeeCode={username || ''}
        onCaptureComplete={handleReceiptCaptureComplete}
        enableCapture={shouldEnableCapture}
      />
      <ScannerBox
        visible={isScanQrCodeProduct}
        onSuccessBarcodeScanned={handleScanQrCodeProduct}
        onDestroy={() => toggleStoreStartScanQrCodeProduct(false)}
      />
    </>
  );
};

export default OrderScanToDelivery;

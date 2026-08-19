/**
 * Scan túi & giao — gom shipping: Zustand tiến độ theo nhóm, popup chỉ khi bấm «Tạo hoá đơn & giao…».
 * Chỉ màn này; store `order-scan-group-shipping-progress` không dùng nơi khác.
 */
import {
  ORDER_DELIVERY_TYPE,
  ORDER_STATUS,
  ORDER_TAGS,
} from '@/core/constants/order';
import FontAwesome from '@expo/vector-icons/FontAwesome';
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
  runCreateOrPrintInvoice,
  useCreateInvoiceFlow,
  useCreateInvoiceProcess,
  usePrintCodReceiptProcess,
} from '~/src/api/app-pick/use-create-invoice';
import { useOrderDetailForCode } from '~/src/api/app-pick/use-get-order-detail';
import { useOrderStatusAutoRefresh } from '~/src/core/hooks/useOrderStatusAutoRefresh';
import { useHandoverOrder } from '~/src/api/app-pick/use-handover-order';
import { useSetOrderScannedBagLabelScanned } from '~/src/api/app-pick/use-set-order-scanned-bag-label-scanned';
import { queryClient } from '~/src/api/shared/api-provider';
import { Button } from '~/src/components/Button';
import CODReceipt from '~/src/components/CODReceipt';
import Bags from '~/src/components/order-scan-to-delivery/bags';
import FulfillErrorAlert from '~/src/components/order-scan-to-delivery/fulfill-error-alert';
import InvoiceAlert from '~/src/components/order-scan-to-delivery/invoice-alert';
import InvoiceInfo from '~/src/components/order-scan-to-delivery/invoice-info';
import { SectionAlert } from '~/src/components/SectionAlert';
import Header from '~/src/components/shared/header';
import ScannerBox from '~/src/components/shared/scanner-box';
import ShipperInfo from '~/src/components/shared/shipper-info';
import { useAuth } from '~/src/core';
import { useCheckShift } from '~/src/core/hooks/useCheckShift';
import { usePdaScanTarget } from '~/src/core/hooks/usePdaScanTarget';
import {
  hideAlert,
  showAlert as showAlertDialog,
} from '~/src/core/store/alert-dialog';
import { setLoading } from '~/src/core/store/loading';
import {
  ensureOrderScanGroupShipping,
  getFirstIncompleteOrderCode,
  getGroupShippingProgressKey,
  isGroupShippingBagsComplete,
  markOrderScanGroupOrderBagsComplete,
  resetOrderScanGroupShippingProgress,
  useOrderScanGroupShippingProgress,
} from '~/src/core/store/order-scan-group-shipping-progress';
import {
  getIsScanQrCodeProduct,
  resetOrderBags,
  scanQrCodeSuccess,
  setUploadedImages,
  toggleScanQrCodeProduct,
  useOrderScanToDelivery,
} from '~/src/core/store/order-scan-to-delivery';
import {
  getScanToDeliveryInfo,
  hasOrderDriverInfo,
  isApartmentComplexDriverHandover,
} from '~/src/core/utils/order';
import { transformBagsData } from '~/src/core/utils/order-bags';
import { OrderDetailHeader } from '~/src/types/order-pick';
import { BarcodeScanningResult } from '~/src/types/scanner';
import ScanBagsSkeleton from '~/src/components/shared/skeleton/scan-bags-skeleton';
import { showMessage } from 'react-native-flash-message';

const ACTION_TYPE = {
  HANDOVER_TO_CUSTOMER: 'Xác nhận giao cho khách',
  HANDOVER_TO_SHIPPER: 'Xác nhận giao cho tài xế',
  DISABLE: 'Chưa thể giao hàng',
};

const ACTION_CONFIRM_TITLE = {
  HANDOVER_TO_CUSTOMER: 'Xác nhận giao cho khách?',
  HANDOVER_TO_SHIPPER: 'Xác nhận giao cho tài xế?',
};

const ORDER_SCAN_TO_DELIVERY_PATH = '/orders/order-scan-to-delivery';

const OrderScanToDelivery = () => {
  const navigation = useNavigation();
  const { code } = useLocalSearchParams<{ code: string }>();
  const [showPrintReceipt, setShowPrintReceipt] = useState(false);

  const user = useAuth.use.userInfo();
  const { name, username } = user || {};

  const {
    isOrderDetailLoading,
    isOrderDetailFetching,
    orderDetailError,
    orderDetail,
  } = useOrderDetailForCode(code);

  useOrderStatusAutoRefresh(code);

  useLayoutEffect(() => {
    if (code) {
      resetOrderBags();
      setUploadedImages('', true);
    }
  }, [code]);

  const orderBags = useOrderScanToDelivery.use.orderBags();

  const isScanQrCodeProduct = getIsScanQrCodeProduct();

  const header = orderDetail?.header as OrderDetailHeader | undefined;

  const { deliveryType, status, tags, handoverStatus, codAmount } =
    header || {};

  const hasStoreTransferShipperLog = Boolean(
    header?.logs?.some((log) => log.action === 'STORE_TRANSFER_SHIPPER'),
  );
  const isShipperInvoiceReprint =
    deliveryType === ORDER_DELIVERY_TYPE.SHIPPER_DELIVERY &&
    hasStoreTransferShipperLog;

  const isOfflineHomeDelivery =
    deliveryType === ORDER_DELIVERY_TYPE.OFFLINE_HOME_DELIVERY;

  const handoverSuccessMessage = isOfflineHomeDelivery
    ? 'Đã hoàn tất'
    : 'Đã hoàn tất! Vui lòng đợi in hóa đơn';

  const groupShippingOrderCodes = header?.groupShippingOrderCodes;
  const groupKey = useMemo(() => getGroupShippingProgressKey(header), [header]);
  const isMultiGroup = Boolean(
    groupShippingOrderCodes && groupShippingOrderCodes.length > 1 && groupKey,
  );
  const groupCodes = isMultiGroup ? groupShippingOrderCodes! : null;

  const title = getScanToDeliveryInfo({
    deliveryType,
    status,
    orderCode: code,
    shipping: header?.shipping,
  })?.title;

  useLayoutEffect(() => {
    if (title) {
      navigation.setOptions({
        headerShown: true,
        header: () => <Header title={title} />,
      });
    }
  }, [title, navigation]);

  const invalidateOrderDetail = useCallback(async () => {
    await queryClient.invalidateQueries({ queryKey: ['orderDetail', code] });
  }, [code]);

  const uploadedImages = useOrderScanToDelivery.use.uploadedImages();

  useEffect(() => {
    return () => {
      resetOrderBags();
      toggleScanQrCodeProduct(false);
      setUploadedImages('', true);
    };
  }, []);

  const invoiceHandoverInProgressRef = useRef(false);
  const { isPending: isLoadingHandoverOrder, mutateAsync: handoverOrder } =
    useHandoverOrder(() => {
      showMessage({
        message: handoverSuccessMessage,
        type: 'success',
      });
      if (!invoiceHandoverInProgressRef.current) {
        setLoading(false);
      }

      setUploadedImages('', true);
      queryClient.invalidateQueries({ queryKey: ['orderDetail', code] });

      if (isMultiGroup) {
        if (assertGroupShippingReadyForSubmit()) {
          resetOrderScanGroupShippingProgress();
        }
      } else {
        resetOrderScanGroupShippingProgress();
      }
    });

  const invoiceProcessModeRef = useRef<'CREATE' | 'REPRINT'>('CREATE');
  useEffect(() => {
    invoiceProcessModeRef.current = 'CREATE';
    setShowPrintReceipt(false);
  }, [code]);

  const {
    mutateAsync: processCreateInvoice,
    isPending: isLoadingCreateInvoice,
  } = useCreateInvoiceProcess({
    loadingMessage: 'Vui lòng đợi in hóa đơn...',
    keepLoadingOnSuccess: true,
    onError: () => {
      invoiceProcessModeRef.current = 'CREATE';
      setShowPrintReceipt(false);
    },
    onSuccess: async () => {
      await invalidateOrderDetail();

      if (invoiceProcessModeRef.current === 'REPRINT') {
        if (!!Number(codAmount)) {
          setShowPrintReceipt(true);
          setLoading(true, 'Đang chuẩn bị phiếu thu COD...');
        } else {
          invoiceProcessModeRef.current = 'CREATE';
          setLoading(false);
        }
        return;
      }

      // Đơn có COD: KHÔNG back ở đây. Phải đợi in phiếu thu COD xong mới rời màn
      // (xử lý ở printCodReceipt.onSettled bên dưới). Nếu back ngay, <CODReceipt>
      // bị unmount trước khi capture → phiếu thu COD không được in.
      if (!!Number(codAmount)) return;

      // Flow shipper ở lại màn hình để detail reload và đổi nút thành "In hóa đơn"
      // theo log STORE_TRANSFER_SHIPPER.
      if (deliveryType === ORDER_DELIVERY_TYPE.SHIPPER_DELIVERY) {
        setLoading(false);
        return;
      }

      setLoading(false);

      if (isMultiGroup) {
        if (assertGroupShippingReadyForSubmit()) {
          router.back();
        }
      } else {
        router.back();
      }
    },
  });

  const { mutateAsync: printCodReceipt, isPending: isPrintingCodReceipt } =
    usePrintCodReceiptProcess({
      successMessage: 'In phiếu thu COD thành công',
      // In phiếu thu xong (thành công hoặc thất bại) mới rời màn — thay cho nhánh
      // router.back() của đơn không COD ở processCreateInvoice.onSuccess.
      onSettled: async () => {
        const wasReprint = invoiceProcessModeRef.current === 'REPRINT';
        // Cleanup trước mọi await để ref không bị kẹt nếu invalidate thất bại.
        invoiceProcessModeRef.current = 'CREATE';
        setShowPrintReceipt(false);
        setLoading(true, 'Đang cập nhật đơn hàng...');
        await invalidateOrderDetail();

        if (wasReprint) {
          setLoading(false);
          return;
        }

        if (deliveryType === ORDER_DELIVERY_TYPE.SHIPPER_DELIVERY) {
          setLoading(false);
          return;
        }

        setLoading(false);

        if (isMultiGroup) {
          if (assertGroupShippingReadyForSubmit()) {
            router.back();
          }
        } else {
          router.back();
        }
      },
    });

  const createInvoiceFlowOrderCodeRef = useRef<string | null>(null);
  const {
    mutate: createInvoiceFlow,
    data: createInvoiceFlowData,
    isPending: isCreatingInvoice,
  } = useCreateInvoiceFlow({
    onError: () => {
      invoiceProcessModeRef.current = 'CREATE';
      setShowPrintReceipt(false);
    },
    onSuccess: async (orderCode) => {
      await invalidateOrderDetail();
      await processCreateInvoice({ orderCode });
      if (!!Number(codAmount)) {
        setShowPrintReceipt(true);
        setLoading(true, 'Đang chuẩn bị phiếu thu COD...');
      }
    },
  });

  const invoiceCode =
    orderDetail?.header?.invoiceCode ??
    (createInvoiceFlowOrderCodeRef.current === code
      ? createInvoiceFlowData?.data?.invoiceCode
      : undefined);

  const shouldEnableCapture = Number(codAmount) > 0 && showPrintReceipt;

  const actionType = useMemo(
    () => ACTION_TYPE[handoverStatus as keyof typeof ACTION_TYPE],
    [handoverStatus],
  );

  const isPickupInvoiceOnly =
    deliveryType === ORDER_DELIVERY_TYPE.CUSTOMER_PICKUP &&
    (status === ORDER_STATUS.COMPLETED || status === ORDER_STATUS.TRANSFERRED);

  const actionTypeWithInvoice = useMemo(() => {
    if (isShipperInvoiceReprint) {
      return 'Tạo lại hoá đơn';
    }
    if (isPickupInvoiceOnly) {
      return 'Tạo lại hoá đơn';
    }
    if (deliveryType === ORDER_DELIVERY_TYPE.SHIPPER_DELIVERY) {
      return 'Tạo hoá đơn & giao cho tài xế';
    }
    return 'Tạo hoá đơn & giao cho khách';
  }, [deliveryType, isPickupInvoiceOnly, isShipperInvoiceReprint]);

  const generateMessageCreateInvoice = useMemo(() => {
    if (deliveryType === ORDER_DELIVERY_TYPE.SHIPPER_DELIVERY) {
      return 'Bạn có chắc chắn tạo hóa đơn & giao cho tài xế?';
    }
    // return 'Bạn có chắc chắn tạo hóa đơn & giao cho khách?';
    return null;
  }, [deliveryType]);

  const { mutate: setOrderScannedBagLabel } =
    useSetOrderScannedBagLabelScanned();

  const { checkShift } = useCheckShift(() => {
    const isShipperDelivery =
      deliveryType === ORDER_DELIVERY_TYPE.SHIPPER_DELIVERY;
    showAlertDialog({
      // Cùng stackId → double-tap nút / auto-trigger sau scan túi (PICK UP) chỉ
      // giữ 1 dialog confirm, không stack thành nhiều popup gọi tạo hóa đơn.
      stackId: `create-invoice-${code}`,
      title: isShipperInvoiceReprint
        ? 'Tạo lại hoá đơn?'
        : isShipperDelivery
          ? 'Tạo hoá đơn & hoàn tất giao hàng'
          : isPickupInvoiceOnly
            ? 'Tạo lại hoá đơn?'
            : 'Tạo hoá đơn & hoàn tất đơn hàng',
      message: isShipperInvoiceReprint ? null : generateMessageCreateInvoice,
      isHideCancelButton: true,
      blockDismiss: true,
      onConfirm: async () => {
        hideAlert();
        createInvoiceFlowOrderCodeRef.current = code;
        setLoading(true, 'Vui lòng đợi in hóa đơn...');

        // PICKUP đã hoàn tất/chuyển giao và SHIPPER đã có log handover nên không
        // gọi handoverOrder lại. Dùng chung rule: có mã HĐ thì in, chưa có thì
        // tạo với note "In lại hóa đơn" rồi callback createInvoiceFlow sẽ in.
        if (isShipperInvoiceReprint || isPickupInvoiceOnly) {
          invoiceProcessModeRef.current = 'REPRINT';
          runCreateOrPrintInvoice({
            orderCode: code,
            existingInvoiceCode: invoiceCode,
            printExistingInvoice: () =>
              processCreateInvoice({ orderCode: code }),
            createMissingInvoice: createInvoiceFlow,
          });
          return;
        }

        invoiceHandoverInProgressRef.current = true;
        try {
          const result = await handoverOrder({
            orderCode: code,
            proofImages: uploadedImages,
          });

          if (result.error) {
            setLoading(false);
            showMessage({
              message: result.error,
              type: 'danger',
            });
            return;
          }

          // Handover callback đã chạy trong lúc ref=true nên loading vẫn được
          // giữ. Từ đây mutation tạo/in hóa đơn tiếp quản loading.
          invoiceHandoverInProgressRef.current = false;
          createInvoiceFlow({ orderCode: code });
        } catch {
          // useHandoverOrder.onError đã tắt loading; consume mutateAsync reject
          // để callback confirm không tạo unhandled Promise rejection.
          setLoading(false);
        } finally {
          invoiceHandoverInProgressRef.current = false;
        }
      },
    });
  });

  const disableByStatus = useMemo(() => {
    if (deliveryType === 'CUSTOMER_PICKUP') {
      return status === ORDER_STATUS.SHIPPING;
    }

    return status !== ORDER_STATUS.STORE_PACKED;
  }, [deliveryType, status]);

  const serverAllBagsDone = useMemo(() => {
    const labels = orderDetail?.header?.bagLabels;
    if (!labels?.length) return false;
    const bagsType = transformBagsData(labels);
    const flat = [...bagsType.DRY, ...bagsType.FROZEN, ...bagsType.FRESH];
    return (
      flat.length > 0 && flat.every((bag) => bag.isDone || bag.lastScannedTime)
    );
  }, [orderDetail?.header?.bagLabels]);

  const isAllDone = useMemo(() => {
    if (!Array.isArray(orderBags) || orderBags.length === 0) {
      return serverAllBagsDone;
    }
    const localDone = orderBags.every(
      (bag) => bag.isDone || bag.lastScannedTime,
    );
    return localDone || serverAllBagsDone;
  }, [orderBags, serverAllBagsDone, disableByStatus]);

  const promptNavigateToOrder = useCallback((targetCode: string) => {
    router.replace(`${ORDER_SCAN_TO_DELIVERY_PATH}/${targetCode}`);
  }, []);

  /** Gom shipping: chỉ popup này, chỉ khi bấm «Tạo hoá đơn & giao…» (không check nơi khác). */
  const assertGroupShippingReadyForSubmit = useCallback((): boolean => {
    if (
      !isMultiGroup ||
      !groupCodes?.length ||
      !groupKey ||
      !code ||
      orderDetailError
    ) {
      return true;
    }
    if (!isAllDone) {
      return true;
    }

    markOrderScanGroupOrderBagsComplete(code);
    const scanned = useOrderScanGroupShippingProgress.getState().scannedByCode;
    if (isGroupShippingBagsComplete(groupCodes, scanned)) {
      return true;
    }

    const nextCode = getFirstIncompleteOrderCode(groupCodes, scanned);
    if (!nextCode) {
      return true;
    }

    showAlertDialog({
      stackId: 'order-scan-group-shipping-submit',
      message: (
        <Text className="text-base text-gray-900">
          Đơn hàng gom shipping, NV siêu thị cần scan & giao cho tài xế đơn tiếp
          theo <Text className="font-bold">{nextCode}</Text>
        </Text>
      ),
      blockDismiss: true,
      isHideCancelButton: true,
      confirmText: 'Xác nhận',
      onConfirm: () => {
        hideAlert();
        promptNavigateToOrder(nextCode);
      },
    });
    return false;
  }, [
    isMultiGroup,
    groupCodes,
    groupKey,
    code,
    orderDetailError,
    isAllDone,
    promptNavigateToOrder,
  ]);

  useEffect(() => {
    if (
      !groupKey ||
      !groupCodes ||
      orderDetailError ||
      isOrderDetailLoading ||
      !code
    ) {
      return;
    }
    ensureOrderScanGroupShipping(groupKey, groupCodes);
  }, [groupKey, groupCodes, orderDetailError, isOrderDetailLoading, code]);

  const handleCheckoutOrderBagsWithInvoice = useCallback(() => {
    checkShift();
  }, [checkShift]);

  const handleStartDeliveryWithoutInvoice = useCallback(() => {
    showAlertDialog({
      title:
        ACTION_CONFIRM_TITLE[
          handoverStatus as keyof typeof ACTION_CONFIRM_TITLE
        ],
      onConfirm: () => {
        hideAlert();
        handoverOrder({ orderCode: code, proofImages: uploadedImages });
      },
    });
  }, [handoverStatus, code, uploadedImages, handoverOrder]);

  const handleScanQrCodeProduct = useCallback(
    (result: BarcodeScanningResult) => {
      scanQrCodeSuccess(result, () => {
        if (!result?.data) return;
        setOrderScannedBagLabel({ orderCode: code, bagCode: result?.data });

        if (isOfflineHomeDelivery) return;
        if (deliveryType !== ORDER_DELIVERY_TYPE.CUSTOMER_PICKUP) return;

        const bags = useOrderScanToDelivery.getState().orderBags;
        const allBagsScanned =
          bags.length > 0 &&
          bags.every((bag) => bag.isDone || bag.lastScannedTime);
        if (!allBagsScanned) return;

        toggleScanQrCodeProduct(false);
        handleCheckoutOrderBagsWithInvoice();
      });
    },
    [
      code,
      deliveryType,
      isOfflineHomeDelivery,
      setOrderScannedBagLabel,
      handleCheckoutOrderBagsWithInvoice,
    ],
  );

  // Quét túi bằng máy PDA (đầu đọc laser) dùng chung handler với camera.
  usePdaScanTarget(handleScanQrCodeProduct);

  const showAlert = useMemo(() => {
    return !tags?.includes(ORDER_TAGS.ORDER_CREATED_INVOICE);
  }, [tags]);

  const disableActionWithInvoice = useMemo(() => {
    if (isPickupInvoiceOnly || isShipperInvoiceReprint) return false;

    const hasDriverInfo = hasOrderDriverInfo(header?.shipping);
    const baseDisable =
      !orderBags.length || isOrderDetailLoading || handoverStatus === 'DISABLE';
    const requiresDriverInfo =
      deliveryType === ORDER_DELIVERY_TYPE.SHIPPER_DELIVERY ||
      isApartmentComplexDriverHandover({
        deliveryType,
        status,
        shipping: header?.shipping,
      });

    return baseDisable || (requiresDriverInfo && !hasDriverInfo);
  }, [
    orderBags,
    isOrderDetailLoading,
    handoverStatus,
    header?.shipping,
    deliveryType,
    status,
    isPickupInvoiceOnly,
    isShipperInvoiceReprint,
  ]);

  const renderAction = useMemo(() => {
    const isDisabledWithoutInvoice =
      !orderBags.length || isOrderDetailLoading || handoverStatus === 'DISABLE';
    return isAllDone || isPickupInvoiceOnly || isShipperInvoiceReprint ? (
      isOfflineHomeDelivery ? (
        <Button
          loading={
            isLoadingHandoverOrder ||
            isCreatingInvoice ||
            isLoadingCreateInvoice ||
            isPrintingCodReceipt ||
            showPrintReceipt
          }
          onPress={handleStartDeliveryWithoutInvoice}
          label={actionType}
          disabled={isDisabledWithoutInvoice}
          variant="warning"
        />
      ) : (
        <Button
          loading={
            isLoadingHandoverOrder ||
            isCreatingInvoice ||
            isLoadingCreateInvoice ||
            isPrintingCodReceipt ||
            showPrintReceipt
          }
          onPress={handleCheckoutOrderBagsWithInvoice}
          label={actionTypeWithInvoice}
          disabled={disableActionWithInvoice}
          variant="warning"
        />
      )
    ) : (
      <Button
        onPress={() => toggleScanQrCodeProduct(true)}
        icon={<FontAwesome name="qrcode" size={20} color="white" />}
        label={'Scan túi'}
      />
    );
  }, [
    isAllDone,
    isPickupInvoiceOnly,
    isShipperInvoiceReprint,
    orderBags,
    isLoadingHandoverOrder,
    isLoadingCreateInvoice,
    isCreatingInvoice,
    isPrintingCodReceipt,
    showPrintReceipt,
    handleStartDeliveryWithoutInvoice,
    handleCheckoutOrderBagsWithInvoice,
    actionType,
    actionTypeWithInvoice,
    isOfflineHomeDelivery,
    disableActionWithInvoice,
    isOrderDetailLoading,
    handoverStatus,
    toggleScanQrCodeProduct,
  ]);

  const handleRefresh = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['orderDetail', code] });
  }, [code]);

  const handleReceiptCaptureComplete = useCallback(
    async (base64String: string) => {
      const codReceiptBase64String = base64String.trim();
      if (!codReceiptBase64String) {
        invoiceProcessModeRef.current = 'CREATE';
        setShowPrintReceipt(false);
        setLoading(false);
        return;
      }

      try {
        await printCodReceipt({ codReceiptBase64String });
      } catch {
        // Mutation đã show lỗi và chạy onSettled cleanup; consume mutateAsync
        // rejection vì CODReceipt gọi callback theo contract void.
      }
    },
    [printCodReceipt],
  );

  if (isOrderDetailLoading) {
    return <ScanBagsSkeleton />;
  }

  if (orderDetailError) {
    return (
      <SectionAlert variant="danger">
        <Text>{orderDetailError}</Text>
      </SectionAlert>
    );
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
          <InvoiceAlert
            show={showAlert}
            orderDetail={orderDetail}
            codAmount={codAmount}
          />
          <FulfillErrorAlert fulfillError={header?.fulfillError} />
          <View className="flex flex-col gap-4">
            {deliveryType !== ORDER_DELIVERY_TYPE.CUSTOMER_PICKUP &&
            (deliveryType !== ORDER_DELIVERY_TYPE.APARTMENT_COMPLEX_DELIVERY ||
              isApartmentComplexDriverHandover({
                deliveryType,
                status,
                shipping: header?.shipping,
              })) ? (
              <ShipperInfo orderDetail={orderDetail} />
            ) : null}
            <InvoiceInfo />
            <View className="border-t border-gray-200 pb-3">
              <Bags bagLabels={header?.bagLabels} />
            </View>
          </View>
        </ScrollView>
      </View>
      {(actionType || isPickupInvoiceOnly || isShipperInvoiceReprint) && (
        <View className="border-t border-gray-200 pb-4">
          <View className="px-4 py-3 bg-white ">{renderAction}</View>
        </View>
      )}
      <CODReceipt
        orderCode={code}
        invoiceNumber={invoiceCode}
        codAmount={Number(codAmount)}
        employeeName={name || ''}
        employeeCode={username || ''}
        onCaptureComplete={handleReceiptCaptureComplete}
        enableCapture={shouldEnableCapture}
      />
      <ScannerBox
        visible={isScanQrCodeProduct}
        onSuccessBarcodeScanned={handleScanQrCodeProduct}
        onDestroy={() => toggleScanQrCodeProduct(false)}
      />
    </>
  );
};

export default OrderScanToDelivery;

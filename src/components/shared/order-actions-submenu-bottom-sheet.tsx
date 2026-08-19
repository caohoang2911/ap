import Ionicons from '@expo/vector-icons/Ionicons';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { useLocalSearchParams } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useRef } from 'react';
import { Pressable, Text } from 'react-native';
import { showMessage } from 'react-native-flash-message';
import {
  runCreateOrPrintInvoice,
  useCreateInvoiceFlow,
  useCreateInvoiceProcess,
  usePrintCodReceiptProcess,
} from '~/src/api/app-pick/use-create-invoice';
import { useOrderDetailForCode } from '~/src/api/app-pick/use-get-order-detail';
import { queryClient } from '~/src/api/shared/api-provider';
import { useAuth } from '~/src/core/store/auth';
import { EBikeLine } from '~/src/core/svgs';
import { OrderDetail } from '~/src/types/order-pick';
import CODReceipt from '../CODReceipt';
import SBottomSheet from '../SBottomSheet';
import BookShipperActionsBottomsheet from './book-shipper-actions-bottomsheet';
import CancelBookShipperBottomsheet from './cancel-book-shipper-bottom-sheet';
import OrderDeliveryTypeBottomSheet from './order-delivery-type-bottom-sheet';
import OrderHistoryBottomSheet from './order-history-bottom-sheet';
import { setLoading } from '~/src/core/store/loading';

interface OrderActionsSubmenuBottomSheetProps {
  visible: boolean;
  setVisible: (visible: boolean) => void;
  deliveryType?: string;
  orderCode?: string;
  status?: string;
  invoiceCode?: string;
}

/** Đọc mã hóa đơn mới nhất từ cache orderDetail (dùng sau khi invalidate). */
const getInvoiceCodeFromCache = (orderCode: string) =>
  queryClient.getQueryData<{ data: OrderDetail }>(['orderDetail', orderCode])
    ?.data?.header?.invoiceCode;

const OrderActionsSubmenuBottomSheet = ({
  visible,
  setVisible,
  deliveryType,
  orderCode,
  invoiceCode,
}: OrderActionsSubmenuBottomSheetProps) => {
  const { code } = useLocalSearchParams<{ code: string }>();
  const actionRef = useRef<any>();
  const bookAhamoveActionsBottomsheetRef = useRef<any>();
  const cancelBookShipperBottomsheetRef = useRef<any>();

  const effectiveOrderCode = code || orderCode || '';

  const { orderDetail } = useOrderDetailForCode(effectiveOrderCode);
  const codAmount = orderDetail?.header?.codAmount;
  const hasCod = Number(codAmount) > 0;

  const [reprintWithCapture, setReprintWithCapture] = React.useState(false);
  /** Mã HĐ in lên phiếu thu COD — có thể là HĐ vừa được tạo trong luồng này. */
  const [codReceiptInvoiceCode, setCodReceiptInvoiceCode] =
    React.useState<string>('');

  const [orderDeliveryTypeVisible, setOrderDeliveryTypeVisible] =
    React.useState(false);
  const [orderHistoryVisible, setOrderHistoryVisible] = React.useState(false);

  const invalidateOrderDetail = useCallback(async () => {
    if (!effectiveOrderCode) return;
    await queryClient.invalidateQueries({
      queryKey: ['orderDetail', effectiveOrderCode],
    });
  }, [effectiveOrderCode]);

  const { mutateAsync: printInvoice, isPending: isPrintingInvoice } =
    useCreateInvoiceProcess({
      successMessage: 'In lại hóa đơn thành công',
      onSuccess: invalidateOrderDetail,
    });
  const { mutate: printCodReceipt } = usePrintCodReceiptProcess({
    successMessage: 'In phiếu thu COD thành công',
    onSuccess: () => invalidateOrderDetail(),
  });

  /**
   * In hóa đơn, đơn COD thì in tiếp phiếu thu (qua <CODReceipt> capture).
   * Lỗi in đã được useCreateInvoiceProcess báo + tắt loading nên chỉ cần dừng luồng.
   */
  const printInvoiceThenCodReceipt = useCallback(
    async (invoiceCodeForReceipt: string) => {
      try {
        await printInvoice({ orderCode: effectiveOrderCode });
      } catch {
        return;
      }

      if (!hasCod) return;

      setCodReceiptInvoiceCode(invoiceCodeForReceipt);
      setReprintWithCapture(true);
      setLoading(false);
    },
    [printInvoice, effectiveOrderCode, hasCod],
  );

  const { mutate: createInvoiceFlow, isPending: isCreatingInvoice } =
    useCreateInvoiceFlow({
      onSuccess: async (createdOrderCode, response) => {
        await invalidateOrderDetail();
        await printInvoiceThenCodReceipt(
          response?.data?.invoiceCode ||
            getInvoiceCodeFromCache(createdOrderCode) ||
            '',
        );
      },
    });

  const user = useAuth.use.userInfo();
  const { name, username } = user || {};

  useEffect(() => {
    if (visible) {
      actionRef.current?.present();
    }
  }, [visible]);

  const actions = useMemo(
    () => [
      {
        key: 'book-ahamove',
        title: 'Book tài xế giao hàng',
        icon: <EBikeLine />,
      },
      {
        key: 'cancel-book-shipper',
        title: 'Hủy book tài xế giao hàng',
        icon: (
          <MaterialCommunityIcons
            name="book-cancel-outline"
            size={24}
            color="black"
          />
        ),
      },
      {
        key: 'change-delivery-type',
        title: 'Đổi phương thức giao hàng',
        icon: <Ionicons name="swap-horizontal" size={24} color="black" />,
      },
      {
        key: 'reprint-invoice',
        title: 'Tạo lại hóa đơn',
        icon: <MaterialIcons name="print" size={24} color="black" />,
      },
      {
        key: 'history-order',
        title: 'Lịch sử đơn hàng',
        icon: <MaterialIcons name="history" size={24} color="black" />,
      },
    ],
    [],
  );

  const renderItem = ({
    onClickAction,
    key,
    title,
    icon,
    enabled = true,
  }: {
    key: string;
    title: string | React.ReactNode;
    icon: React.ReactNode;
    onClickAction: (key: string) => void;
    enabled?: boolean;
  }) => {
    return (
      <Pressable
        onPress={() => onClickAction?.(key)}
        disabled={!enabled}
        className="flex-row items-center px-4 py-4 border border-x-0 border-t-0 border-b-1 border-gray-200 gap-4"
        style={{ opacity: enabled ? 1 : 0.5 }}
      >
        {icon}
        <Text className={`text-gray-300`}>{title}</Text>
      </Pressable>
    );
  };

  const handleClickAction = (key: string) => {
    setVisible(false);
    switch (key) {
      case 'book-ahamove':
        bookAhamoveActionsBottomsheetRef.current?.present();
        break;
      case 'cancel-book-shipper':
        cancelBookShipperBottomsheetRef.current?.present();
        break;
      case 'change-delivery-type':
        setOrderDeliveryTypeVisible(true);
        break;
      case 'reprint-invoice': {
        if (!effectiveOrderCode) {
          showMessage({
            message: 'Thiếu mã đơn hàng, không thể in hóa đơn',
            type: 'warning',
          });
          break;
        }

        // Chống double-tap: một luồng tạo/in đang chạy thì bỏ qua.
        if (isCreatingInvoice || isPrintingInvoice) break;

        setLoading(true);
        runCreateOrPrintInvoice({
          orderCode: effectiveOrderCode,
          existingInvoiceCode: invoiceCode || orderDetail?.header?.invoiceCode,
          printExistingInvoice: printInvoiceThenCodReceipt,
          createMissingInvoice: createInvoiceFlow,
        });
        break;
      }
      case 'history-order':
        setOrderHistoryVisible(true);
        break;
      default:
        break;
    }
  };

  const handleReceiptCaptureComplete = useCallback(
    (base64String: string) => {
      setReprintWithCapture(false);

      // Capture lỗi trả về chuỗi rỗng — <CODReceipt> đã báo lỗi, không gọi máy in.
      const codReceiptBase64String = base64String.trim();
      if (!codReceiptBase64String) {
        setLoading(false);
        return;
      }

      printCodReceipt({ codReceiptBase64String });
    },
    [printCodReceipt],
  );

  const shouldEnableCapture = reprintWithCapture && hasCod;

  return (
    <>
      <SBottomSheet
        visible={visible}
        title="Thao tác"
        ref={actionRef}
        snapPoints={[360]}
        titleAlign="center"
        onClose={() => setVisible(false)}
      >
        {actions.map((action: any) => (
          <React.Fragment key={action.key}>
            {renderItem({
              ...action,
              onClickAction: handleClickAction,
              enabled: action.enabled !== undefined ? action.enabled : true,
            })}
          </React.Fragment>
        ))}
      </SBottomSheet>
      <CODReceipt
        orderCode={effectiveOrderCode}
        invoiceNumber={
          codReceiptInvoiceCode ||
          invoiceCode ||
          orderDetail?.header?.invoiceCode ||
          ''
        }
        codAmount={Number(codAmount)}
        employeeName={name || ''}
        employeeCode={username || ''}
        onCaptureComplete={handleReceiptCaptureComplete}
        enableCapture={shouldEnableCapture}
      />
      <BookShipperActionsBottomsheet ref={bookAhamoveActionsBottomsheetRef} />
      <CancelBookShipperBottomsheet
        orderCode={effectiveOrderCode}
        ref={cancelBookShipperBottomsheetRef}
      />
      <OrderDeliveryTypeBottomSheet
        setVisible={setOrderDeliveryTypeVisible}
        visible={orderDeliveryTypeVisible}
        deliveryType={deliveryType || null}
        orderCode={effectiveOrderCode}
      />
      <OrderHistoryBottomSheet
        orderCode={effectiveOrderCode}
        setVisible={setOrderHistoryVisible}
        visible={orderHistoryVisible}
        orderDetail={orderDetail || {}}
      />
    </>
  );
};

export default OrderActionsSubmenuBottomSheet;

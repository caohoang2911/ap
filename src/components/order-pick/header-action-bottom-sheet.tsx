import React, { forwardRef, useImperativeHandle, useRef, useState } from 'react';
import { Pressable, Text } from 'react-native';

import { router, useGlobalSearchParams } from 'expo-router';
import { useSaveOrderPickingAsDraft } from '~/src/api/app-pick/use-save-order-picking-as-draft';
import { setLoading } from '~/src/core/store/loading';
import { useOrderPick } from '~/src/core/store/order-pick';
import {
  BillLine,
  CloseLine,
  EBikeLine,
  PrintLine,
  QRScanLine,
  TruckLine,
} from '~/src/core/svgs';
import SaveOutLine from '~/src/core/svgs/SaveOutline';
import SBottomSheet from '../SBottomSheet';
const actions = [
  {
    key: 'view-order',
    title: 'Xem thông tin đơn hàng',
    icon: <BillLine />,
  },
  {
    key: 'enter-bag-and-tem',
    title: 'Nhập số lượng túi và in tem',
    icon: <PrintLine />,
  },
  {
    key: 'scan-bag-customer',
    title: 'Scan túi - Giao cho khách',
    icon: <QRScanLine />,
  },
  {
    key: 'scan-bag-shipper',
    title: 'Scan túi - Giao cho shipper',
    icon: <QRScanLine />,
  },
  // {
  //   key: 'store-shipping',
  //   title: 'Store giao hàng',
  //   icon: <TruckLine />,
  // },
  // {
  //   key: 'book-ahamove',
  //   title: 'Book Ahamove',
  //   icon: <EBikeLine />,
  // },
  {
    key: 'save-draft',
    title: 'Lưu tạm',
    icon: <SaveOutLine />,
  },
  {
    key: 'cancel-order',
    title: <Text className="text-red-500">Huỷ đơn</Text>,
    icon: <CloseLine color={'#E53E3E'} />,
  },
];

type Props = {};

const OrderPickHeadeActionBottomSheet = forwardRef<any, Props>(
  ({ }, ref) => {
    const { code } = useGlobalSearchParams<{ code: string }>();

    const [visible, setVisible] = useState(false);

    const orderPickProducts = useOrderPick.use.orderPickProducts();
    
    const actionRef = useRef<any>();

    const { mutate: saveOrderPickingAsDraft } = useSaveOrderPickingAsDraft();

    useImperativeHandle(
      ref,
      () => {
        return {
          present: () => {
            actionRef.current?.present();
            setVisible(!visible);
          },
        };
      },
      []
    );

    const renderItem = ({
      onClickAction,
      key,
      title,
      icon,
    }: {
      key: string;
      title: string | React.ReactNode;
      icon: React.ReactNode;
      onClickAction: (key: string) => void;
    }) => {
      return (
        <Pressable
          onPress={() => onClickAction?.(key)}
          className="flex-row items-center px-4 py-4 border border-x-0 border-t-0 border-b-1 border-gray-200 gap-4"
        >
          {icon}
          <Text className="text-gray-300">{title}</Text>
        </Pressable>
      );
    };

    const handleClickAction = (key: string) => {
      switch (key) {
        case 'save-draft':
          setLoading(true);
          saveOrderPickingAsDraft({ pickedItems: Object.values(orderPickProducts).map((item) => ({
            ...item,
            name: item.name || '',
            quantity: item.quantity || 0,
            barcode: item.barcode || '',
            pickedQuantity: item.pickedQuantity || 0,
            pickedError: item.pickedError || '',
            pickedNote: item.pickedNote || '',
          })), orderCode: code,});
          break;
        case 'view-order':
          router.push(`orders/order-invoice/${code}`);
          break;
        default:
          break;
      }
      actionRef.current?.dismiss();

    };

    return (
      <SBottomSheet
        visible={visible}
        title="Thao tác" ref={actionRef}>
        {actions.map((action) => renderItem({ ...action, onClickAction: handleClickAction }))}
      </SBottomSheet>
    );
  }
);

export default OrderPickHeadeActionBottomSheet;

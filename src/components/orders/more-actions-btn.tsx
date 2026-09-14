import { router } from 'expo-router';
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { Pressable, Text, View } from 'react-native';
import { TouchableOpacity } from 'react-native-gesture-handler';
import { BillLine, More2Fill } from '~/src/core/svgs';
import SBottomSheet from '../SBottomSheet';
import { prefetchOrderDetailForCode } from '~/src/api/app-pick/use-get-order-detail';
const actions = [
  {
    key: 'view-invoice',
    title: 'Xem thông tin đơn hàng',
    icon: <BillLine />,
  },
];

interface MoreActionsBtnProps {
  code: string;
}

const MoreActionsBtn = ({ code }: MoreActionsBtnProps) => {
  const [visible, setVisible] = useState(false);
  const actionRef = useRef<any>();
  const renderItem = useMemo(
    () =>
      function ActionItem({
        onClickAction,
        key,
        title,
        icon,
      }: {
        key: string;
        title: string | React.ReactNode;
        icon: React.ReactNode;
        onClickAction: (key: string) => void;
      }) {
        return (
          <Pressable
            onPress={() => onClickAction?.(key)}
            className="flex-row items-center px-4 py-4 border border-x-0 border-t-0 border-b-1 border-gray-200 gap-4"
          >
            {icon}
            <Text className="text-gray-300">{title}</Text>
          </Pressable>
        );
      },
    [],
  );

  const handleClickAction = useCallback(
    (key: string) => {
      switch (key) {
        case 'view-invoice':
          prefetchOrderDetailForCode({
            orderCode: code,
          });
          router.push(`orders/order-invoice/${code}`);
          break;
        default:
          break;
      }
      setVisible(false);
    },
    [code],
  );

  useEffect(() => {
    if (visible) {
      actionRef.current?.present();
    }
  }, [visible]);

  return (
    <>
      <TouchableOpacity onPress={() => setVisible(true)} hitSlop={15}>
        <View className="p-1">
          <More2Fill width={18} height={18} />
        </View>
      </TouchableOpacity>
      {visible && (
        <SBottomSheet
          title="Thao tác"
          visible={visible}
          onClose={() => setVisible(false)}
          ref={actionRef}
          snapPoints={[200]}
        >
          {actions.map((item) => (
            <React.Fragment key={item.key}>
              {renderItem({ ...item, onClickAction: handleClickAction })}
            </React.Fragment>
          ))}
        </SBottomSheet>
      )}
    </>
  );
};

export default MoreActionsBtn;

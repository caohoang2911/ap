import { Formik, useFormikContext } from 'formik';
import { isEmpty, isNumber, toLower } from 'lodash';
import moment from 'moment-timezone';
import React, {
  memo,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  Dimensions,
  Keyboard,
  Platform,
  Pressable,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useIsFocused } from '@react-navigation/native';
import { showMessage } from 'react-native-flash-message';
import {
  isCaseOrPackUnit,
  isIncompleteCaseOrPackPickReason,
  isPickedErrorTypeRequiringImage,
  PRODUCT_ACTIONS,
  PRODUCT_PICKED_ERROR_TYPES,
  REQUIRE_PICKED_IMAGE_FOR_ERROR_TYPES,
  type ProductAction,
} from '@/core/constants/product';
import { hideAlert, showAlert } from '@/core/store/alert-dialog';
import { useQueryClient } from '@tanstack/react-query';
import { useLocalSearchParams } from 'expo-router';
import { TouchableOpacity } from 'react-native-gesture-handler';
import {
  useSetOrderItemPicked,
  type SetOrderItemPickedProduct,
} from '~/src/api/app-pick/use-set-order-item-picked';
import ImageUploader from '~/src/components/ImageUploader';
import { useOrderPickProductsFlat } from '~/src/core/hooks/useOrderPickProductsFlat';
import { useConfig } from '~/src/core/store/config';
import {
  setActionProduct,
  setCurrentId,
  setIsVisibleReplaceProduct,
  setLastScannedId,
  setOrderPickProduct,
  setQuantityFromBarcode,
  setReplacePickedProductId,
  clearScannedIds,
  clearWeightRangePendingScanKGs,
  drainWeightRangePendingScanKGs,
  getWeightRangeDraft,
  setWeightRangeDraft,
  setScanMoreProduct,
  toggleScanQrCodeProduct,
  toggleShowAmountInput,
  useOrderPick,
  setSuccessForBarcodeScan,
  setIsEditManual,
  setIsPickedByManualBarcodeInput,
} from '~/src/core/store/order-pick';
import {
  formatDecimal,
  roundToDecimalDecrease,
  roundToDecimalIncrease,
} from '~/src/core/utils/number';
import { barcodeCondition } from '~/src/core/utils/order-bags';
import {
  mergePickedProductIntoOrderDetailData,
  type OrderDetailQueryData,
} from '~/src/core/utils/order-detail-query-cache';
import { Product } from '~/src/types/product';
import { Badge } from '../Badge';
import { Button } from '../Button';
import { Input } from '../Input';
import SBottomSheet from '../SBottomSheet';
import SDropdown from '../SDropdown';
import SImage from '../SImage';
import ProductPickingGuidelines from './product-picking-guidelines';
import { UnitText } from './unit-text';
import PickMoreScanButton from './pick-more-scan-button';
import WeightRangeLineItems, {
  getWeightRangeOrderQuantity,
  isWeightRangeProduct,
  normalizeWeightRangeItemKGs,
  parseWeightRangeItemKGs,
  sumWeightRangeItemKGs,
  WEIGHT_RANGE_LIST_MAX_HEIGHT,
} from './weight-range-line-items';

const BOTTOM_SHEET_TOP_HEADER_HEIGHT = 228;
const BOTTOM_SHEET_HEADER_BORDER = 16;
const BOTTOM_SHEET_PRODUCT_NAME = 24;
const BOTTOM_SHEET_BADGE_ROW = 28;
const BOTTOM_SHEET_PACK_WARNING = 20;
const BOTTOM_SHEET_GUIDELINES_MARGIN = 16;
const BOTTOM_SHEET_GUIDELINES_HEADER_HEIGHT = 28;
const BOTTOM_SHEET_GUIDELINES_LINE_HEIGHT = 24;
const BOTTOM_SHEET_FORM_PADDING_TOP = 16;
const BOTTOM_SHEET_FORM_PADDING_BOTTOM = 32;
const BOTTOM_SHEET_QUANTITY_SECTION = 76;
const BOTTOM_SHEET_WEIGHT_RANGE_SECTION = WEIGHT_RANGE_LIST_MAX_HEIGHT; // 4 item + pick thêm
const BOTTOM_SHEET_BOX_SECTION = 96;
const BOTTOM_SHEET_SECTION_GAP = 16;
const BOTTOM_SHEET_REASON_SECTION = 72;
const BOTTOM_SHEET_IMAGE_SECTION = 120;
const BOTTOM_SHEET_CONFIRM_BUTTON = 48;
const EMPTY_WEIGHT_RANGE_ITEM_KGS: number[] = [];

const QUICK_ACTION_TO_ERROR_TYPE: Partial<
  Record<
    ProductAction,
    (typeof PRODUCT_PICKED_ERROR_TYPES)[keyof typeof PRODUCT_PICKED_ERROR_TYPES]
  >
> = {
  [PRODUCT_ACTIONS.LOW_QUALITY]: PRODUCT_PICKED_ERROR_TYPES.QUALITY_DECLINE,
  [PRODUCT_ACTIONS.NEAR_EXPIRY]:
    PRODUCT_PICKED_ERROR_TYPES.NEAR_EXPIRY_DATE_NOT_YET_DISCOUNT_STAMPED,
  [PRODUCT_ACTIONS.EXPIRED_ONLINE]:
    PRODUCT_PICKED_ERROR_TYPES.EXPIRED_ONLINE_SALE_DATE_NOT_YET_DISCOUNT_DATE,
  [PRODUCT_ACTIONS.PICK_WEIGHT_EXCEEDS_LIMIT]:
    PRODUCT_PICKED_ERROR_TYPES.PICK_WEIGHT_EXCEEDS_LIMIT,
  [PRODUCT_ACTIONS.INCORRECT_STOCK]: PRODUCT_PICKED_ERROR_TYPES.INCORRECT_STOCK,
  [PRODUCT_ACTIONS.IN_CART_OFFLINE_CUSTOMER]:
    PRODUCT_PICKED_ERROR_TYPES.IN_CART_OFFLINE_CUSTOMER,
};

function computeInputAmountBottomSheetHeight({
  windowHeight,
  safeAreaTop,
  guidelinesCount = 0,
  shouldShowBoxInput = false,
  isWeightRange = false,
  hasConversionBadge = false,
  hasPackWarning = false,
  hasImageSection = false,
}: {
  windowHeight: number;
  safeAreaTop: number;
  guidelinesCount?: number;
  shouldShowBoxInput?: boolean;
  isWeightRange?: boolean;
  hasConversionBadge?: boolean;
  hasPackWarning?: boolean;
  hasImageSection?: boolean;
}) {
  const headerHeight =
    BOTTOM_SHEET_TOP_HEADER_HEIGHT +
    BOTTOM_SHEET_PRODUCT_NAME +
    BOTTOM_SHEET_BADGE_ROW +
    (hasConversionBadge ? BOTTOM_SHEET_BADGE_ROW : 0) +
    (hasPackWarning ? BOTTOM_SHEET_PACK_WARNING : 0) +
    BOTTOM_SHEET_HEADER_BORDER;

  const guidelinesHeight = guidelinesCount
    ? BOTTOM_SHEET_GUIDELINES_MARGIN +
      BOTTOM_SHEET_GUIDELINES_HEADER_HEIGHT +
      guidelinesCount * BOTTOM_SHEET_GUIDELINES_LINE_HEIGHT +
      8
    : 0;

  const formHeight =
    BOTTOM_SHEET_FORM_PADDING_TOP +
    // WeightRange dùng list thay cho QuantitySection thông thường
    (isWeightRange ? 0 : BOTTOM_SHEET_QUANTITY_SECTION) +
    (isWeightRange ? BOTTOM_SHEET_WEIGHT_RANGE_SECTION : 0) +
    (shouldShowBoxInput
      ? BOTTOM_SHEET_SECTION_GAP + BOTTOM_SHEET_BOX_SECTION
      : 0) +
    BOTTOM_SHEET_SECTION_GAP +
    BOTTOM_SHEET_REASON_SECTION +
    (hasImageSection
      ? BOTTOM_SHEET_SECTION_GAP + BOTTOM_SHEET_IMAGE_SECTION
      : 0) +
    BOTTOM_SHEET_SECTION_GAP +
    BOTTOM_SHEET_CONFIRM_BUTTON +
    BOTTOM_SHEET_FORM_PADDING_BOTTOM;

  const estimatedHeight = headerHeight + guidelinesHeight + formHeight;
  const maxHeight = windowHeight - safeAreaTop - 8;

  return Math.min(estimatedHeight, maxHeight);
}

// QuantityControls Component
const DecrementButton = memo(
  ({ onPress, disabled }: { onPress: () => void; disabled: boolean }) => (
    <TouchableOpacity
      disabled={disabled}
      className="overflow-hidden"
      onPress={onPress}
      style={{ marginLeft: -9 }}
    >
      <View
        className="rounded-md bg-gray-200"
        style={{ width: 38, height: 38 }}
      >
        <View className="absolute top-1/2 left-1/2 transform -translate-y-1/2 -translate-x-1/2">
          <Text className="text-2xl w-full h-full text-center text-blue-500">
            -
          </Text>
        </View>
      </View>
    </TouchableOpacity>
  ),
);
DecrementButton.displayName = 'DecrementButton';

const IncrementButton = memo(
  ({ onPress, disabled }: { onPress: () => void; disabled: boolean }) => (
    <TouchableOpacity
      disabled={disabled}
      onPress={onPress}
      style={{ marginRight: -9 }}
    >
      <View
        className=" rounded-md bg-gray-200"
        style={{ width: 38, height: 38 }}
      >
        <View className="absolute top-1/2 left-1/2 transform -translate-y-1/2 -translate-x-1/2">
          <Text className="text-2xl w-full h-full text-center text-blue-500">
            +
          </Text>
        </View>
      </View>
    </TouchableOpacity>
  ),
);
IncrementButton.displayName = 'IncrementButton';

// QuantitySection Component
const QuantitySection = memo(
  ({
    values,
    currentProduct,
    handleBlur,
    action,
    setFieldValue,
    quantityInit,
    setQuantityFromBarcode,
    toggleScanQrCodeProduct,
    onInputFocus,
    label = 'Số lượng pick',
  }: any) => {
    const editable = useMemo(
      () => action !== PRODUCT_ACTIONS.OUT_OF_STOCK,
      [action],
    );

    const handleDecrement = useCallback(() => {
      // setQuantityFromBarcode(0);
      const valueChange = roundToDecimalDecrease(
        Number(values?.pickedQuantity || 0),
      );
      if (Number(valueChange) < 0) {
        setFieldValue('pickedQuantity', 0);
        return;
      }
      setFieldValue('pickedQuantity', Number(valueChange));
      if (Number(values?.pickedQuantity) >= Number(quantityInit) && !action) {
        setFieldValue('pickedErrorType', null);
      }
    }, [values?.pickedQuantity, quantityInit, setFieldValue, action]);

    const handleIncrement = useCallback(() => {
      if (!editable) return;
      // setQuantityFromBarcode(0);
      const valueChange = roundToDecimalIncrease(
        Number(values?.pickedQuantity || 0),
      );
      if (Number(valueChange) < 0) {
        setFieldValue('pickedQuantity', 0);
        return;
      }
      setFieldValue('pickedQuantity', Number(valueChange));
      if (Number(values?.pickedQuantity) >= Number(quantityInit) && !action) {
        setFieldValue('pickedErrorType', null);
      }
    }, [values?.pickedQuantity, quantityInit, setFieldValue, editable, action]);

    const handleQRScan = useCallback(() => {
      toggleScanQrCodeProduct(true);
      setQuantityFromBarcode(
        Math.floor(Number(values?.pickedQuantity || 0) * 1000) / 1000,
      );
      setScanMoreProduct(true);
    }, [
      values?.pickedQuantity,
      toggleScanQrCodeProduct,
      setQuantityFromBarcode,
    ]);

    useEffect(() => {
      return () => {
        setScanMoreProduct(false);
      };
    }, []);

    const handleChangeText = useCallback(
      (value: string) => {
        setQuantityFromBarcode(0);
        setFieldValue('pickedQuantity', formatDecimal(value));
        if (Number(value) >= Number(quantityInit)) {
          setFieldValue('pickedErrorType', null);
        }
      },
      [quantityInit, setFieldValue, setQuantityFromBarcode],
    );

    const errorMessage = useMemo(() => {
      return Number(values?.pickedQuantity) < Number(quantityInit) &&
        !values?.pickedErrorType
        ? 'SL pick nhỏ hơn SL đặt. Vui lòng chọn lý do'
        : undefined;
    }, [values?.pickedQuantity, values?.pickedErrorType, quantityInit]);

    return (
      <View className="flex gap-2 flex-1" style={{ position: 'relative' }}>
        <Text className="text-base font-medium text-gray-700">
          {label}

          {currentProduct?.unit ? (
            <Text className="text-orange-500 font-semibold">
              {' '}
              <UnitText unit={currentProduct.unit} />
            </Text>
          ) : null}
        </Text>

        <View className="flex-row items-center gap-3">
          <Input
            className="flex-1"
            selectTextOnFocus
            placeholder="Nhập số lượng"
            inputClasses="text-center"
            keyboardType="decimal-pad"
            onChangeText={handleChangeText}
            editable={editable}
            useBottomSheetTextInput
            name="pickedQuantity"
            value={values?.pickedQuantity?.toString()}
            onBlur={handleBlur('pickedQuantity')}
            onFocus={() => onInputFocus?.('pickedQuantity')}
            defaultValue="0"
            prefix={
              <DecrementButton onPress={handleDecrement} disabled={false} />
            }
            suffix={
              <IncrementButton onPress={handleIncrement} disabled={false} />
            }
          />
          <PickMoreScanButton onPress={handleQRScan} disabled={!editable} />
        </View>

        {errorMessage && <Text className="text-red-500">{errorMessage}</Text>}
      </View>
    );
  },
);
QuantitySection.displayName = 'QuantitySection';

// ReasonDropdown Component
const ReasonDropdown = memo(
  ({
    productPickedErrorTypes,
    values,
    setFieldValue,
    quantityInit,
    setErrors,
    action,
    currentProduct,
    isWeightRange = false,
  }: any) => {
    const isQuantityEnough =
      Number(values?.pickedQuantity) >= Number(quantityInit);
    const hasQuickAction = Object.values(PRODUCT_ACTIONS).includes(action);
    // WeightRange: "đủ" tính theo SỐ ITEM đã quét (length) so với SL đặt quy đổi,
    // KHÔNG theo tổng KG (pickedQuantity).
    const isWeightRangeEnough =
      isWeightRange &&
      (values?.weightRangeItemKGs?.length ?? 0) >=
        getWeightRangeOrderQuantity(currentProduct);
    // Chưa đủ → enable cho chọn lý do; đủ → disable (và auto-clear bên dưới).
    // Vẫn enable khi đang OUT_OF_STOCK để user đổi lý do được.
    const isDisabled = isWeightRange
      ? isWeightRangeEnough
      : isQuantityEnough || hasQuickAction;
    const { unit } = currentProduct || {};

    const pickedQty = Number(values?.pickedQuantity || 0);
    const hasPickedSomething = isWeightRange
      ? (values?.weightRangeItemKGs?.length ?? 0) > 0
      : pickedQty > 0;

    useEffect(() => {
      if (
        (isWeightRange || !isCaseOrPackUnit(unit)) &&
        isIncompleteCaseOrPackPickReason({ id: values?.pickedErrorType })
      ) {
        setFieldValue('pickedErrorType', '');
        setFieldValue('pickedImage', '');
        return;
      }
      // Đã pick > 0 → không được giữ lý do hết hàng
      if (
        hasPickedSomething &&
        values?.pickedErrorType === PRODUCT_PICKED_ERROR_TYPES.OUT_OF_STOCK
      ) {
        setFieldValue('pickedErrorType', '');
        setFieldValue('pickedImage', '');
        return;
      }
      if (isWeightRange) {
        if (!isWeightRangeEnough || !values?.pickedErrorType) return;
        setFieldValue('pickedErrorType', '');
        setFieldValue('pickedImage', '');
        return;
      }
      if (!isQuantityEnough || hasQuickAction || !values?.pickedErrorType) {
        return;
      }
      setFieldValue('pickedErrorType', '');
      setFieldValue('pickedImage', '');
    }, [
      isWeightRange,
      isWeightRangeEnough,
      isQuantityEnough,
      hasQuickAction,
      hasPickedSomething,
      values?.pickedErrorType,
      setFieldValue,
      unit,
    ]);

    const handleSelect = useCallback(
      (value: string) => {
        setFieldValue('pickedErrorType', value);
        if (!isPickedErrorTypeRequiringImage(value)) {
          setFieldValue('pickedImage', '');
        }
        setErrors({});
      },
      [setFieldValue, setErrors],
    );

    const handleClear = useCallback(() => {
      if (isDisabled) return;
      setFieldValue('pickedErrorType', '');
      setFieldValue('pickedImage', '');
    }, [setFieldValue, isDisabled]);

    const productPickedErrorsWithUnit = useMemo(() => {
      return productPickedErrorTypes
        .map((item: any) => {
          if (item.id === PRODUCT_PICKED_ERROR_TYPES.OUT_OF_STOCK) {
            return {
              ...item,
              // Đã pick > 0 → không cho chọn hết hàng
              disabled: hasPickedSomething,
            };
          }
          if (item.id === PRODUCT_PICKED_ERROR_TYPES.INCORRECT_ORDERED_WEIGHT) {
            return {
              ...item,
              // Weight range: quét theo KG dù unit hiển thị là Bông/Quả/Trái...
              disabled: !isWeightRange && toLower(unit) !== 'kg',
            };
          }
          if (isIncompleteCaseOrPackPickReason(item)) {
            return {
              ...item,
              // Chỉ unit Thùng/Lốc/Pack; weight range cũng không áp dụng
              disabled: isWeightRange || !isCaseOrPackUnit(unit),
            };
          }
          return item;
        })
        ?.reverse();
    }, [productPickedErrorTypes, unit, isWeightRange, hasPickedSomething]);

    const dropdownModalHeight = useMemo(() => {
      const screenHeight = Dimensions.get('window').height;
      const maxHeight = Math.floor(screenHeight * 0.75);
      const itemCount = productPickedErrorsWithUnit?.length || 0;
      const estimatedItemHeight = 48;
      const baseHeight = 49; // modal header
      const calculatedHeight = baseHeight + itemCount * estimatedItemHeight;
      return Math.min(maxHeight, calculatedHeight);
    }, [productPickedErrorsWithUnit]);

    return (
      <SDropdown
        data={productPickedErrorsWithUnit}
        label="Chọn lý do"
        modalProps={{
          height: dropdownModalHeight,
        }}
        labelClasses="font-medium"
        mode="modal"
        dropdownPosition="top"
        placeholder="Vui lòng chọn"
        allowClear={true}
        disabled={isDisabled}
        value={values?.pickedErrorType}
        onSelect={handleSelect}
        onClear={handleClear}
      />
    );
  },
);
ReasonDropdown.displayName = 'ReasonDropdown';

// Pack input
const BoxInput = memo(
  ({ values, setFieldValue, handleBlur, onInputFocus, unit }: any) => {
    const handleChangeText = useCallback(
      (name: string, value: string) => {
        setFieldValue(name, parseInt(value || '0'));
      },
      [setFieldValue],
    );

    const handleDecrement = useCallback(
      (name: string) => {
        const valueChange = roundToDecimalDecrease(Number(values?.[name] || 0));
        if (Number(valueChange) < 0) {
          setFieldValue(name, 0);
          return;
        }

        setFieldValue(name, Number(valueChange));
      },
      [setFieldValue, values],
    );

    const handleIncrement = useCallback(
      (name: string) => {
        const valueChange = roundToDecimalIncrease(Number(values?.[name] || 0));
        if (Number(valueChange) < 0) {
          setFieldValue(name, 0);
          return;
        }

        setFieldValue(name, Number(valueChange));
      },
      [setFieldValue, values],
    );

    return (
      <View className="flex-1 flex-row gap-2">
        <View className="flex-1">
          <Input
            label={
              <Text className="font-medium text-gray-500" numberOfLines={1}>
                {unit ? (
                  <>
                    <UnitText unit={unit} /> nguyên kiện
                  </>
                ) : (
                  'Nguyên kiện'
                )}
              </Text>
            }
            placeholder="Nhập số lượng"
            value={values?.fullBoxQuantity?.toString()}
            onChangeText={(value: string) =>
              handleChangeText('fullBoxQuantity', value)
            }
            keyboardType="decimal-pad"
            inputClasses="text-center"
            useBottomSheetTextInput
            name="fullBoxQuantity"
            onBlur={handleBlur('fullBoxQuantity')}
            onFocus={() => onInputFocus?.('fullBoxQuantity')}
            defaultValue="0"
            prefix={
              <DecrementButton
                onPress={() => handleDecrement('fullBoxQuantity')}
                disabled={false}
              />
            }
            suffix={
              <IncrementButton
                onPress={() => handleIncrement('fullBoxQuantity')}
                disabled={false}
              />
            }
          />
        </View>
        <View className="flex-1">
          <Input
            label={
              <Text className="font-medium text-gray-500" numberOfLines={1}>
                {unit ? (
                  <>
                    <UnitText unit={unit} /> gom lẻ
                  </>
                ) : (
                  'Gom lẻ'
                )}
              </Text>
            }
            placeholder="Nhập số lượng"
            value={values?.openedBoxQuantity?.toString()}
            onChangeText={(value: string) =>
              handleChangeText('openedBoxQuantity', value)
            }
            keyboardType="decimal-pad"
            inputClasses="text-center"
            useBottomSheetTextInput
            name="openedBoxQuantity"
            onBlur={handleBlur('openedBoxQuantity')}
            onFocus={() => onInputFocus?.('openedBoxQuantity')}
            defaultValue="0"
            suffix={
              <IncrementButton
                onPress={() => handleIncrement('openedBoxQuantity')}
                disabled={false}
              />
            }
            prefix={
              <DecrementButton
                onPress={() => handleDecrement('openedBoxQuantity')}
                disabled={false}
              />
            }
          />
        </View>
      </View>
    );
  },
);
BoxInput.displayName = 'BoxInput';

// FormContent Component
const FormContent = memo(
  ({
    values,
    handleBlur,
    setFieldValue,
    setErrors,
    currentProduct,
    quantity,
    productPickedErrorTypes,
    action,
    quantityInit,
    quantityFromBarcode,
    shouldShowBoxInput,
    shouldShowWeightRangeInput,
    onInputFocus,
    onImageUploadingChange,
  }: any) => {
    const currentProductId = currentProduct?.id;
    const fullBoxQuantity =
      (currentProduct as Product)?.pickedExtraQuantities?.fullBoxQuantity || 0;
    const openedBoxQuantity =
      (currentProduct as Product)?.pickedExtraQuantities?.openedBoxQuantity ||
      0;

    // Init số lượng + hộp thùng khi đổi sản phẩm
    useEffect(() => {
      if (shouldShowWeightRangeInput) return;
      setFieldValue('pickedQuantity', quantityFromBarcode || quantity);
      setFieldValue('fullBoxQuantity', fullBoxQuantity);
      setFieldValue('openedBoxQuantity', openedBoxQuantity);
    }, [
      currentProductId,
      fullBoxQuantity,
      openedBoxQuantity,
      quantityFromBarcode,
      quantity,
      setFieldValue,
      shouldShowWeightRangeInput,
    ]);

    return (
      <View className="px-4 mt-4 pb-4 gap-4">
        {!shouldShowWeightRangeInput && (
          <QuantitySection
            values={values}
            quantity={quantity}
            quantityInit={quantityInit}
            currentProduct={currentProduct}
            action={action}
            handleBlur={handleBlur}
            setFieldValue={setFieldValue}
            setQuantityFromBarcode={setQuantityFromBarcode}
            toggleScanQrCodeProduct={toggleScanQrCodeProduct}
            onInputFocus={onInputFocus}
          />
        )}
        {shouldShowWeightRangeInput && (
          <WeightRangeLineItems
            values={values}
            setFieldValue={setFieldValue}
            orderQuantityConversion={
              (currentProduct as Product)?.orderQuantityConversion
            }
          />
        )}
        {shouldShowBoxInput && (
          <BoxInput
            values={values}
            setFieldValue={setFieldValue}
            handleBlur={handleBlur}
            onInputFocus={onInputFocus}
            unit={currentProduct?.unit}
          />
        )}
        <ReasonDropdown
          productPickedErrorTypes={productPickedErrorTypes}
          values={values}
          action={action}
          quantityInit={quantityInit}
          setFieldValue={setFieldValue}
          setErrors={setErrors}
          currentProduct={currentProduct}
          isWeightRange={shouldShowWeightRangeInput}
        />
        {isPickedErrorTypeRequiringImage(values?.pickedErrorType) ? (
          <ImageUploader
            key={`pick-evidence-${currentProduct?.id}-${values?.pickedErrorType}`}
            title="Thêm Hình ảnh"
            variant="dashed"
            cameraOnly
            maxImages={1}
            required
            proofDeliveryImages={
              values?.pickedImage ? [values.pickedImage] : undefined
            }
            onImagesChange={(urls) => {
              setFieldValue('pickedImage', urls[0] || '');
            }}
            onUploadingChange={onImageUploadingChange}
          />
        ) : null}
      </View>
    );
  },
);
FormContent.displayName = 'FormContent';

const FormikPopupContent = ({
  action,
  bottomSheetHeightBase,
  bottomSheetHeightWithImage,
  currentProduct,
  displayPickedQuantity,
  handleInputFocus,
  handleSheetClose,
  inputBottomSheetRef,
  isImageUploading,
  isKeyboardVisible,
  isSetOrderTemToPickedPending,
  isShowAmountInput,
  isWeightRange,
  orderQuantity,
  productPickedErrorTypes,
  quantityFromBarcode,
  renderTitle,
  renderTopHeader,
  setIsImageUploading,
  shouldShowBoxInput,
  weightRangePendingScanKGs,
}: any) => {
  const { values, handleBlur, setFieldValue, handleSubmit, setErrors } =
    useFormikContext<any>();
  const currentProductId = (currentProduct as Product)?.id;
  const weightRangeItemKGs =
    values?.weightRangeItemKGs ?? EMPTY_WEIGHT_RANGE_ITEM_KGS;
  const pickedErrorType = values?.pickedErrorType;
  const pickedQuantity = values?.pickedQuantity;
  const isOutOfStockAction = action === PRODUCT_ACTIONS.OUT_OF_STOCK;
  const quickActionErrorType = action
    ? QUICK_ACTION_TO_ERROR_TYPE[action as ProductAction]
    : undefined;
  // Effect khởi tạo quick action chỉ chạy theo action/lifecycle như logic cũ.
  // Ref giữ giá trị Formik mới nhất mà không biến việc user đổi/xóa lý do thành trigger.
  const pickedErrorTypeRef = useRef(pickedErrorType);
  pickedErrorTypeRef.current = pickedErrorType;

  const isError = isWeightRange
    ? weightRangeItemKGs.length === 0 && !pickedErrorType
    : Number(pickedQuantity) < Number(orderQuantity) && !pickedErrorType;

  const needsPickedImage = isPickedErrorTypeRequiringImage(pickedErrorType);
  const isMissingRequiredImage =
    REQUIRE_PICKED_IMAGE_FOR_ERROR_TYPES &&
    needsPickedImage &&
    !values?.pickedImage;

  useEffect(() => {
    if (!needsPickedImage) {
      setIsImageUploading(false);
    }
  }, [needsPickedImage, setIsImageUploading]);

  const bottomSheetHeight = needsPickedImage
    ? bottomSheetHeightWithImage
    : bottomSheetHeightBase;

  const weightRangeItemsRef = useRef<number[]>([]);
  weightRangeItemsRef.current = weightRangeItemKGs;

  // Drain pending KG từ scan → form (chạy ở Formik, không phụ thuộc WeightRangeLineItems mount)
  useLayoutEffect(() => {
    if (!isShowAmountInput || !isWeightRange) return;
    if (weightRangePendingScanKGs.length === 0) return;

    const pending = drainWeightRangePendingScanKGs();
    if (pending.length === 0) return;

    const merged = [...weightRangeItemsRef.current, ...pending];
    setFieldValue('weightRangeItemKGs', merged);
    // Cập nhật draft ngay trong cùng layout-effect (sau khi đã drain queue)
    // để không có cửa sổ mất item nếu remount xảy ra trước passive effect.
    if (currentProductId != null) {
      setWeightRangeDraft({ id: currentProductId, items: merged });
    }
  }, [
    currentProductId,
    isShowAmountInput,
    isWeightRange,
    setFieldValue,
    weightRangePendingScanKGs,
  ]);

  // Mirror danh sách KG hiện tại → store draft (gắn product id) để remount
  // giữa chừng có thể khôi phục, tránh mất item đã quét → submit rỗng.
  useEffect(() => {
    if (!isShowAmountInput || !isWeightRange) return;
    if (currentProductId == null) return;
    setWeightRangeDraft({
      id: currentProductId,
      items: weightRangeItemKGs,
    });
  }, [currentProductId, isShowAmountInput, isWeightRange, weightRangeItemKGs]);

  useEffect(() => {
    if (!isShowAmountInput) return;

    if (isOutOfStockAction) {
      if (!isWeightRange) {
        setFieldValue('pickedQuantity', 0);
        setFieldValue(
          'pickedErrorType',
          PRODUCT_PICKED_ERROR_TYPES.OUT_OF_STOCK,
        );
      } else if (!pickedErrorTypeRef.current) {
        // WeightRange: chỉ set mặc định lần đầu mở popup
        setFieldValue(
          'pickedErrorType',
          PRODUCT_PICKED_ERROR_TYPES.OUT_OF_STOCK,
        );
      }
      return;
    }

    if (quickActionErrorType) {
      setFieldValue('pickedErrorType', quickActionErrorType);
    }
  }, [
    isOutOfStockAction,
    isShowAmountInput,
    isWeightRange,
    quickActionErrorType,
    setFieldValue,
  ]);

  useEffect(() => {
    if (!isShowAmountInput || isWeightRange) return;
    if (isOutOfStockAction) return;

    setFieldValue('pickedQuantity', displayPickedQuantity.toString());
  }, [
    displayPickedQuantity,
    isOutOfStockAction,
    isShowAmountInput,
    isWeightRange,
    setFieldValue,
  ]);

  return (
    <SBottomSheet
      topHeader={renderTopHeader}
      renderTitle={renderTitle}
      ref={inputBottomSheetRef}
      snapPoints={[bottomSheetHeight]}
      onClose={handleSheetClose}
      visible={isShowAmountInput}
      enablePanDownToClose={!isWeightRange}
      enableHandlePanningGesture={!isWeightRange}
      enableContentPanningGesture={!isWeightRange}
      extraButton={
        isKeyboardVisible ? undefined : (
          <Button
            onPress={() => handleSubmit()}
            label="Xác nhận"
            disabled={isError || isMissingRequiredImage || isImageUploading}
            loading={isSetOrderTemToPickedPending}
          />
        )
      }
    >
      <FormContent
        values={values}
        handleBlur={handleBlur}
        setFieldValue={setFieldValue}
        setErrors={setErrors}
        currentProduct={currentProduct}
        quantityInit={currentProduct?.orderQuantity}
        quantity={displayPickedQuantity}
        action={action}
        productPickedErrorTypes={productPickedErrorTypes}
        quantityFromBarcode={quantityFromBarcode}
        shouldShowBoxInput={shouldShowBoxInput}
        shouldShowWeightRangeInput={isWeightRange}
        onInputFocus={handleInputFocus}
        onImageUploadingChange={setIsImageUploading}
      />
    </SBottomSheet>
  );
};

// Main Component
const InputAmountPopup = () => {
  const { height: windowHeight } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const [isKeyboardVisible, setIsKeyboardVisible] = useState(false);
  const [isImageUploading, setIsImageUploading] = useState(false);
  const barcodeScanSuccess = useOrderPick.use.barcodeScanSuccess();
  const isShowAmountInput = useOrderPick.use.isShowAmountInput();
  const isPickedByManualBarcodeInput =
    useOrderPick.use.isPickedByManualBarcodeInput();
  const quantityFromBarcode = useOrderPick.use.quantityFromBarcode();
  const { code } = useLocalSearchParams<{ code: string }>();
  const queryClient = useQueryClient();
  const action = useOrderPick.use.action();
  // Chống 2 màn order-pick cùng mount (noti push) tranh nhau popup: store là
  // singleton global nên chỉ instance thuộc màn đang focus + đúng đơn trong store
  // được phép present/submit. Xem memory: global-store-multi-mounted-screen-pattern.
  const isFocused = useIsFocused();
  const currentCode = useOrderPick.use.currentCode();

  const {
    mutate: setOrderTemToPicked,
    isPending: isSetOrderTemToPickedPending,
  } = useSetOrderItemPicked(
    (variables) => {
      reset();

      const picked = variables.pickedItem;
      if (code && picked) {
        queryClient.setQueryData<OrderDetailQueryData>(
          ['orderDetail', code],
          (old) => mergePickedProductIntoOrderDetailData(old, picked),
        );
      }

      if (picked) {
        setOrderPickProduct(picked);
        setLastScannedId(picked.id ?? null);
        setReplacePickedProductId(picked.id);
        if (!picked.pickedQuantity && picked.tags?.includes('REPLACEABLE')) {
          showAlert({
            title: 'Thông báo',
            message: 'Sản phẩm hết hàng, vui lòng chọn sản phẩm thay thế?',
            isHideCancelButton: true,
            onConfirm: () => {
              hideAlert();
              setIsVisibleReplaceProduct(true);
            },
          });
        }
      }
    },
    () => {
      // Pick lỗi (vd "not exist item id"): store có thể đang lệch server — CS sửa
      // đơn giữa chừng, item bị thay/xoá nên id trong store đã chết, mà auto-refresh
      // chỉ so sánh status nên không phát hiện. Refetch để đồng bộ lại danh sách,
      // tránh retry gửi tiếp đúng id chết đó.
      if (code) {
        queryClient.invalidateQueries({ queryKey: ['orderDetail', code] });
      }
    },
  );
  const config = useConfig.use.config();
  const productPickedErrorTypes = useMemo(
    () => config?.productPickedErrorTypes || [],
    [config],
  );

  const inputBottomSheetRef = useRef<any>(null);

  const isEditManual = useOrderPick.use.isEditManual();
  const currentId = useOrderPick.use.currentId();

  const orderPickProductsFlat = useOrderPickProductsFlat();

  // Find current product - memoized to avoid recalculation on every render
  const currentProduct = useMemo(() => {
    let product = orderPickProductsFlat.find((product: Product) =>
      isEditManual
        ? product.id === currentId
        : (barcodeCondition(barcodeScanSuccess, product.refBarcodes) ||
            product.id === currentId) &&
          !product.pickedTime,
    );

    if (isEmpty(product)) {
      product = orderPickProductsFlat.find(
        (product: Product) =>
          barcodeCondition(barcodeScanSuccess, product.refBarcodes) ||
          product.id === currentId,
      );
    }

    return product;
  }, [orderPickProductsFlat, isEditManual, currentId, barcodeScanSuccess]);

  // Extract product properties once
  const { pickedQuantity, orderQuantity } = currentProduct || {
    pickedQuantity: 0,
    orderQuantity: 0,
  };
  const displayPickedQuantity = useMemo(() => {
    if (
      isNumber(quantityFromBarcode) &&
      action === PRODUCT_ACTIONS.OUT_OF_STOCK
    ) {
      return 0;
    }
    return quantityFromBarcode || pickedQuantity || 0;
  }, [quantityFromBarcode, pickedQuantity, action]);
  const productName = currentProduct?.name || '';

  const packOrBoxUnitWarning = useMemo(() => {
    const unitName = currentProduct?.unit?.trim();
    if (!unitName) return null;
    const lowerUnit = unitName.toLowerCase();
    if (lowerUnit.startsWith('pack') || lowerUnit.startsWith('thùng')) {
      return (
        <Text className="font-bold text-orange-500 text-sm mt-1">
          SP bán theo <UnitText unit={unitName} className="font-bold" />, vui
          lòng pick đúng quy cách
        </Text>
      );
    }
    return null;
  }, [currentProduct?.unit]);

  const isWeightRange = isWeightRangeProduct(currentProduct);
  const weightRangeOrderQuantity = getWeightRangeOrderQuantity(currentProduct);

  // Memoize title component
  const renderTitle = useMemo(
    () => (
      <Pressable
        className="flex justify-between gap-1"
        onPress={Keyboard.dismiss}
      >
        <View className="flex flex-row items-center gap-1">
          {currentProduct?.tags?.includes('GIFT') && (
            <View className="mb-0.5">
              <Text>🎁 </Text>
            </View>
          )}
          <Text className="font-semibold">{productName}</Text>
        </View>
        <View className="flex flex-row items-center gap-1">
          <Badge
            className="self-start"
            variant={isWeightRange ? 'purple' : 'default'}
            label={
              <>
                {'SL đặt: '}
                {isWeightRange && currentProduct?.orderQuantityConversion ? (
                  <>
                    {`${weightRangeOrderQuantity} x `}
                    <UnitText
                      unit={currentProduct.orderQuantityConversion.unit}
                      orderQuantityConversion
                    />
                  </>
                ) : (
                  <>
                    {`${currentProduct?.orderQuantity} `}
                    <UnitText unit={currentProduct?.unit || ''} />
                  </>
                )}
              </>
            }
          />
          {currentProduct?.barcode && (
            <Badge
              className="self-start"
              label={currentProduct.barcode}
              variant="pink"
            />
          )}
        </View>
        {packOrBoxUnitWarning}
        {!!currentProduct?.productPickingGuidelines && (
          <View className="flex flex-row items-center gap-1 w-full mt-4">
            <ProductPickingGuidelines
              guidelines={currentProduct?.productPickingGuidelines}
            />
          </View>
        )}
      </Pressable>
    ),
    [
      productName,
      currentProduct?.orderQuantity,
      currentProduct?.unit,
      currentProduct?.tags,
      currentProduct?.barcode,
      currentProduct?.orderQuantityConversion,
      currentProduct?.productPickingGuidelines,
      packOrBoxUnitWarning,
      isWeightRange,
      weightRangeOrderQuantity,
    ],
  );

  const renderTopHeader = useMemo(
    () => (
      <Pressable
        className="mb-2 pt-8"
        onPress={() => {
          Keyboard.dismiss();
        }}
      >
        <View className="flex-row items-center justify-center">
          <SImage
            source={currentProduct?.image}
            style={{ width: 180, height: 180, borderRadius: 8 }}
          />
        </View>
      </Pressable>
    ),
    [currentProduct?.image],
  );

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      setQuantityFromBarcode(0);
    };
  }, []);

  // Handle BottomSheet visibility — CHỈ instance thuộc màn đang focus + đúng đơn
  // trong store mới present. Cờ isShowAmountInput là global: nếu không gate, sheet
  // của màn order-pick nền (đơn khác, còn mounted do noti push) cũng mở chồng lên,
  // và submit từ sheet đó sẽ ghép product trong store với orderCode của NÓ →
  // server báo "not exist item id".
  useEffect(() => {
    if (!isShowAmountInput) return;
    if (!isFocused) return;
    if (currentCode && code && currentCode !== code) return;
    inputBottomSheetRef.current?.present();
  }, [isShowAmountInput, isFocused, currentCode, code]);

  useEffect(() => {
    const showEvent =
      Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent =
      Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
    const showSub = Keyboard.addListener(showEvent, () => {
      setIsKeyboardVisible(true);
    });
    const hideSub = Keyboard.addListener(hideEvent, () => {
      setIsKeyboardVisible(false);
    });
    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  useEffect(() => {
    if (!isShowAmountInput) {
      setIsKeyboardVisible(false);
      setIsImageUploading(false);
    }
  }, [isShowAmountInput]);

  const shouldShowBoxInput =
    currentProduct?.isRequirePickedFullBoxAndOpenedBoxQuantity === true;
  const weightRangePendingScanKGs =
    useOrderPick.use.weightRangePendingScanKGs();
  const isScanQrCodeProduct = useOrderPick.use.isScanQrCodeProduct();
  const hasPackWarning = useMemo(() => {
    const unitName = currentProduct?.unit?.trim()?.toLowerCase();
    return (
      !!unitName &&
      (unitName.startsWith('pack') || unitName.startsWith('thùng'))
    );
  }, [currentProduct?.unit]);
  const hasConversionBadge = false;

  const bottomSheetHeightBase = useMemo(
    () =>
      computeInputAmountBottomSheetHeight({
        windowHeight,
        safeAreaTop: insets.top,
        guidelinesCount: currentProduct?.productPickingGuidelines?.length ?? 0,
        shouldShowBoxInput,
        isWeightRange,
        hasConversionBadge,
        hasPackWarning,
        hasImageSection: false,
      }),
    [
      windowHeight,
      insets.top,
      currentProduct?.productPickingGuidelines,
      shouldShowBoxInput,
      isWeightRange,
      hasConversionBadge,
      hasPackWarning,
    ],
  );

  const bottomSheetHeightWithImage = useMemo(
    () =>
      computeInputAmountBottomSheetHeight({
        windowHeight,
        safeAreaTop: insets.top,
        guidelinesCount: currentProduct?.productPickingGuidelines?.length ?? 0,
        shouldShowBoxInput,
        isWeightRange,
        hasConversionBadge,
        hasPackWarning,
        hasImageSection: true,
      }),
    [
      windowHeight,
      insets.top,
      currentProduct?.productPickingGuidelines,
      shouldShowBoxInput,
      isWeightRange,
      hasConversionBadge,
      hasPackWarning,
    ],
  );

  // Memoized callbacks
  const reset = useCallback(() => {
    toggleShowAmountInput(false);
    setCurrentId(null);
    setQuantityFromBarcode(0);
    setSuccessForBarcodeScan('');
    setScanMoreProduct(false);
    setIsEditManual(false);
    setIsPickedByManualBarcodeInput(false);
    clearScannedIds();
    // Giữ lastScannedId / barcodeScrollTo để list vẫn scroll/highlight SP vừa quét/pick.
    clearWeightRangePendingScanKGs();
    setWeightRangeDraft(null);
    setActionProduct(null);
  }, []);

  const handleSheetClose = useCallback(() => {
    if (isScanQrCodeProduct) return;
    reset();
  }, [isScanQrCodeProduct, reset]);

  // Đơn vừa được đồng bộ lại (refetch sau lỗi pick / CS sửa đơn) mà SP đang mở
  // không còn trong danh sách → đóng popup, tránh treo form trống và tránh user
  // xác nhận trên dữ liệu mồ côi.
  useEffect(() => {
    if (!isShowAmountInput) return;
    if (currentProduct?.id != null) return;
    reset();
  }, [isShowAmountInput, currentProduct?.id, reset]);

  const handleInputFocus = useCallback(
    (field?: 'pickedQuantity' | 'fullBoxQuantity' | 'openedBoxQuantity') => {
      setIsKeyboardVisible(true);
      requestAnimationFrame(() => {
        if (field === 'pickedQuantity') {
          inputBottomSheetRef.current?.scrollTo?.({ y: 0, animated: true });
          return;
        }

        if (field === 'fullBoxQuantity') {
          inputBottomSheetRef.current?.scrollTo?.({ y: 90, animated: true });
          return;
        }

        if (field === 'openedBoxQuantity') {
          inputBottomSheetRef.current?.scrollTo?.({ y: 90, animated: true });
          return;
        }
      });
    },
    [],
  );

  const onSubmit = useCallback(
    (values: any) => {
      if (!productName) return;

      // Chốt chặn cuối trước khi gửi server: product trong store phải thuộc đúng
      // đơn của màn này. Store là singleton — nếu instance màn nền submit, nó sẽ
      // ghép product của đơn đang focus với orderCode của màn nền → server báo
      // "not exist item id". Phát hiện lệch → chặn + đồng bộ lại, không gửi bậy.
      const storeCode = useOrderPick.getState().currentCode;
      if (!code || (storeCode && storeCode !== code)) {
        showMessage({
          message: 'Dữ liệu đơn hàng không khớp, vui lòng thao tác lại',
          type: 'warning',
        });
        if (code) {
          queryClient.invalidateQueries({ queryKey: ['orderDetail', code] });
        }
        return;
      }

      const pickedQty = Number(values?.pickedQuantity || 0);
      const orderQty = Number(orderQuantity || 0);
      const weightRangeOrderQty = getWeightRangeOrderQuantity(currentProduct);
      const pickedWeightRangeCount = values?.weightRangeItemKGs?.length ?? 0;

      const pickedItem = {
        ...currentProduct,
        // Giữ barcode gốc của SP trên đơn — không ghi đè bằng cache scan.
        barcode: currentProduct?.barcode || barcodeScanSuccess,
        isPickedByManualBarcodeInput,
        pickedQuantity: pickedQty,
        pickedErrorType: isWeightRange
          ? pickedWeightRangeCount >= weightRangeOrderQty
            ? ''
            : values?.pickedErrorType
          : pickedQty >= orderQty
            ? ''
            : values?.pickedErrorType,
        pickedNote: values?.pickedNote,
        ...(values?.pickedImage ? { pickedImage: values.pickedImage } : {}),
        pickedTime: moment().valueOf(),
        isAllowEditPickQuantity: true,
        ...((shouldShowBoxInput || isWeightRange) && {
          pickedExtraQuantities: {
            ...(shouldShowBoxInput && {
              fullBoxQuantity: values?.fullBoxQuantity || 0,
              openedBoxQuantity: values?.openedBoxQuantity || 0,
            }),
            ...(isWeightRange && {
              weightRangeItemKGs: normalizeWeightRangeItemKGs(
                values?.weightRangeItemKGs ?? [],
              ),
            }),
          },
        }),
      } as SetOrderItemPickedProduct;

      Keyboard.dismiss();

      setOrderTemToPicked({ pickedItem, orderCode: code });
    },
    [
      productName,
      currentProduct,
      barcodeScanSuccess,
      isPickedByManualBarcodeInput,
      orderQuantity,
      code,
      shouldShowBoxInput,
      isWeightRange,
      setOrderTemToPicked,
      queryClient,
    ],
  );

  // Memoize initial values
  const initialProductId = currentProduct?.id;
  const initialPickedErrorType = currentProduct?.pickedErrorType;
  const initialPickedNote = currentProduct?.pickedNote;
  const initialPickedImage = currentProduct?.pickedImage;
  const initialPickedExtraQuantities = currentProduct?.pickedExtraQuantities;
  // WeightRange không reinit theo displayPickedQuantity (drain queue lo việc đó).
  const initialDisplayPickedQuantity = isWeightRange
    ? 0
    : displayPickedQuantity;
  const initialValues = useMemo(() => {
    // Ưu tiên bản nháp đang thao tác (mirror trong store) để KHÔNG mất item đã
    // quét khi Formik remount giữa chừng. draft gắn theo product id để không lẫn
    // sản phẩm; null = mở phiên mới → seed từ dữ liệu đã lưu.
    const draft = getWeightRangeDraft();
    const weightRangeItemKGs = isWeightRange
      ? draft && draft.id === initialProductId
        ? draft.items
        : parseWeightRangeItemKGs(
            initialPickedExtraQuantities?.weightRangeItemKGs,
          )
      : [];

    return {
      pickedQuantity: isWeightRange
        ? sumWeightRangeItemKGs(weightRangeItemKGs)
        : initialDisplayPickedQuantity,
      pickedErrorType: initialPickedErrorType || '',
      pickedNote: initialPickedNote || '',
      pickedImage: initialPickedImage || '',
      ...(shouldShowBoxInput && {
        fullBoxQuantity: initialPickedExtraQuantities?.fullBoxQuantity || 0,
        openedBoxQuantity: initialPickedExtraQuantities?.openedBoxQuantity || 0,
      }),
      ...(isWeightRange && { weightRangeItemKGs }),
    };
  }, [
    initialDisplayPickedQuantity,
    initialPickedErrorType,
    initialPickedExtraQuantities,
    initialPickedImage,
    initialPickedNote,
    initialProductId,
    isWeightRange,
    shouldShowBoxInput,
  ]);

  const formikKey = isWeightRange
    ? `wr-${currentProduct?.id ?? 'none'}-${isShowAmountInput}`
    : `pick-${currentProduct?.id ?? 'none'}`;

  return (
    <Formik
      key={formikKey}
      initialValues={initialValues}
      validateOnChange
      onSubmit={onSubmit}
      enableReinitialize={!isWeightRange}
    >
      <FormikPopupContent
        action={action}
        bottomSheetHeightBase={bottomSheetHeightBase}
        bottomSheetHeightWithImage={bottomSheetHeightWithImage}
        currentProduct={currentProduct}
        displayPickedQuantity={displayPickedQuantity}
        handleInputFocus={handleInputFocus}
        handleSheetClose={handleSheetClose}
        inputBottomSheetRef={inputBottomSheetRef}
        isImageUploading={isImageUploading}
        isKeyboardVisible={isKeyboardVisible}
        isSetOrderTemToPickedPending={isSetOrderTemToPickedPending}
        isShowAmountInput={isShowAmountInput}
        isWeightRange={isWeightRange}
        orderQuantity={orderQuantity}
        productPickedErrorTypes={productPickedErrorTypes}
        quantityFromBarcode={quantityFromBarcode}
        renderTitle={renderTitle}
        renderTopHeader={renderTopHeader}
        setIsImageUploading={setIsImageUploading}
        shouldShowBoxInput={shouldShowBoxInput}
        weightRangePendingScanKGs={weightRangePendingScanKGs}
      />
    </Formik>
  );
};

export default memo(InputAmountPopup);

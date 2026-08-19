import React, { forwardRef } from 'react';
import { FlatList, type FlatListProps, RefreshControl } from 'react-native';

type PullToRefreshFlatListProps<ItemT> = FlatListProps<ItemT> & {
  refreshing: boolean;
  onRefresh: () => void;
};

/**
 * FlatList có pull-to-refresh dùng chung. Header nên truyền qua
 * ListHeaderComponent để indicator nằm phía trên toàn bộ nội dung màn hình.
 */
const PullToRefreshFlatListInner = <ItemT,>(
  {
    refreshing,
    onRefresh,
    progressViewOffset = 0,
    ...props
  }: PullToRefreshFlatListProps<ItemT>,
  ref: React.ForwardedRef<FlatList<ItemT>>,
) => (
  <FlatList
    ref={ref}
    {...props}
    contentInsetAdjustmentBehavior="never"
    refreshControl={
      <RefreshControl
        refreshing={refreshing}
        onRefresh={onRefresh}
        progressViewOffset={progressViewOffset}
        tintColor="#3280f6"
        colors={['#3280f6']}
      />
    }
  />
);

const PullToRefreshFlatList = forwardRef(PullToRefreshFlatListInner) as <ItemT>(
  props: PullToRefreshFlatListProps<ItemT> & {
    ref?: React.ForwardedRef<FlatList<ItemT>>;
  },
) => React.ReactElement;

export default PullToRefreshFlatList;

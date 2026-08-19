import React, { forwardRef } from 'react';
import { RefreshControl, ScrollView, type ScrollViewProps } from 'react-native';

type PullToRefreshScrollViewProps = ScrollViewProps & {
  refreshing: boolean;
  onRefresh: () => void;
  progressViewOffset?: number;
};

/** ScrollView detail có pull-to-refresh đồng bộ với danh sách chính. */
const PullToRefreshScrollView = forwardRef<
  ScrollView,
  PullToRefreshScrollViewProps
>(function PullToRefreshScrollView(
  { refreshing, onRefresh, progressViewOffset = 0, ...props },
  ref,
) {
  return (
    <ScrollView
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
});

export default PullToRefreshScrollView;

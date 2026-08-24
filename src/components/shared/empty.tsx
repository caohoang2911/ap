import React from 'react';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { View, Text } from 'react-native';

const Empty = () => {
  return (
    <View className="items-center pt-2">
      <View className="py-2 px-4 flex items-center gap-1 rounded-full">
        <MaterialIcons name="search-off" size={23} color="gray" />
        <Text className="text-gray-500">Không có dữ liệu</Text>
      </View>
    </View>
  );
};

export default Empty;

import {
  AntDesign,
  Ionicons,
  MaterialCommunityIcons,
  MaterialIcons,
} from '@expo/vector-icons';
import { DrawerContentComponentProps } from '@react-navigation/drawer';
import { DrawerActions } from '@react-navigation/native';
import { router, useNavigation } from 'expo-router';
import { Dimensions, Pressable, Text, View } from 'react-native';
import { TouchableOpacity } from 'react-native-gesture-handler';
import { DUMMY_PROCESSING_SLIP_COUNT } from '~/src/core/constants/drawer';
import { ROUTES } from '~/src/core/constants/routes';
import { useSignOut } from '~/src/core/hooks/useSignOut';
import {
  canManagePickerShift,
  canManageStoreEmployees,
  canManageStoreTeleGroup,
  stripEmployeeCodeFromName,
} from '~/src/core/utils/employee';
import { SafeScrollView } from '~/src/core/utils/safe-scrollview';
import { stringUtils } from '~/src/core/utils/string';
import { useAuth } from '../core';
import { useConfig } from '../core/store/config';
import { getConfigNameById } from '../core/utils/config';
import { colors } from '../ui/colors';
import { Avatar, AvatarFallback } from './Avatar';
import { VersionDisplay } from './VersionDisplay';

type DrawerMenuItem = {
  label: string;
  icon: React.ReactNode;
  onPress: () => void;
  enable?: boolean;
  show?: boolean;
  badgeCount?: number;
};

export function DrawerContent(_drawerProps: DrawerContentComponentProps) {
  const userInfo = useAuth.use.userInfo();
  const displayName = stripEmployeeCodeFromName(
    userInfo?.name,
    userInfo?.username,
  );
  const navigation = useNavigation();
  const toggleMenu = () => navigation.dispatch(DrawerActions.toggleDrawer());

  const config = useConfig.use.config();
  const employeeRoles = config?.employeeRoles || [];
  const roleName = getConfigNameById(employeeRoles, userInfo?.role);

  const canAccessPickerShiftManagement = canManagePickerShift(userInfo?.role);
  const canManageEmployees = canManageStoreEmployees(userInfo?.role);
  const canManageTeleGroup = canManageStoreTeleGroup(userInfo?.role);

  const triggerSignOut = useSignOut();

  const navigateFromDrawer = (route: string) => {
    // Giữ drawer mở khi push: screen mới đè lên trên, lúc back về drawer vẫn
    // đang mở để chọn tiếp mục khác (không closeDrawer ở đây).
    router.push(route as any);
  };

  const MENU_ITEMS: DrawerMenuItem[] = [
    {
      label: 'Phiếu xử lý',
      icon: (
        <MaterialCommunityIcons
          name="clipboard-list-outline"
          size={20}
          color="black"
        />
      ),
      onPress: () => navigateFromDrawer(ROUTES.APP.PROCESSING_SLIPS),
      enable: true,
      show: true,
      badgeCount: DUMMY_PROCESSING_SLIP_COUNT,
    },
    {
      label: 'Trung tâm hỗ trợ',
      icon: (
        <Ionicons name="chatbubble-ellipses-outline" size={20} color="black" />
      ),
      onPress: () => navigateFromDrawer(ROUTES.APP.SUPPORT_CENTER),
      enable: true,
      show: true,
    },
    {
      label: 'Quản lý ca Picker',
      icon: <Ionicons name="calendar-outline" size={20} color="black" />,
      onPress: () => navigateFromDrawer(ROUTES.APP.PICKER_SHIFT_MANAGEMENT),
      enable: canAccessPickerShiftManagement,
      show: canAccessPickerShiftManagement,
    },
    {
      label: 'Quản lý nhân viên',
      icon: <Ionicons name="people-outline" size={20} color="black" />,
      onPress: () => navigateFromDrawer(ROUTES.APP.EMPLOYEE_MANAGEMENT),
      enable: canManageEmployees,
      show: canManageEmployees,
    },
    {
      label: 'Quản lý nhóm tele',
      icon: <Ionicons name="paper-plane-outline" size={20} color="black" />,
      onPress: () => navigateFromDrawer(ROUTES.APP.TELEGRAM_GROUP_MANAGEMENT),
      enable: canManageTeleGroup,
      show: canManageTeleGroup,
    },
    {
      label: 'Cài đặt',
      icon: <AntDesign name="setting" size={20} color="black" />,
      onPress: () => navigateFromDrawer(ROUTES.APP.SETTINGS),
      enable: true,
      show: true,
    },
    {
      label: 'Quyền ứng dụng',
      icon: <MaterialIcons name="privacy-tip" size={20} color="black" />,
      onPress: () => navigateFromDrawer(ROUTES.APP.PERMISSIONS),
      enable: true,
      show: true,
    },
  ];

  return (
    <View className="flex-1 overflow-hidden py-4">
      <View className="flex flex-row gap-2 items-center border-b border-gray-200 pb-2 px-3">
        <TouchableOpacity onPress={toggleMenu}>
          <Avatar>
            <AvatarFallback
              className="bg-blue-500"
              textClassname="text-sm font-bold text-white"
            >
              {stringUtils.getInitials(displayName || userInfo?.username)}
            </AvatarFallback>
          </Avatar>
        </TouchableOpacity>
        <View className="gap-1">
          <View
            className="w-full"
            style={{ maxWidth: Dimensions.get('window').width * 0.6 }}
          >
            <Text
              className="font-semibold text-lg"
              numberOfLines={1}
              ellipsizeMode="tail"
            >
              {displayName || userInfo?.name}
            </Text>
          </View>
          <Text className="font-medium text-gray-500" numberOfLines={1}>
            {userInfo?.username?.toUpperCase()} - {roleName || userInfo?.role}
          </Text>
        </View>
      </View>
      <SafeScrollView showsVerticalScrollIndicator={false}>
        {MENU_ITEMS.map((item) => {
          if (!item.show) return null;
          return (
            <Pressable
              onPress={item.onPress}
              key={item.label}
              disabled={!item.enable}
            >
              <View
                className={`flex flex-row items-center justify-between border-b border-gray-200 py-3 px-3 ${!item.enable ? 'opacity-50' : ''}`}
              >
                <View className="flex flex-row items-center gap-2 flex-1 min-w-0">
                  {item.icon}
                  <Text className="text-md flex-shrink" numberOfLines={2}>
                    {item.label}
                  </Text>
                </View>
                {!!item.badgeCount && item.badgeCount > 0 && (
                  <View className="min-w-[20px] h-5 rounded-full bg-red-500 items-center justify-center px-1.5 ml-2">
                    <Text className="text-[11px] font-bold text-white">
                      {item.badgeCount}
                    </Text>
                  </View>
                )}
              </View>
            </Pressable>
          );
        })}
      </SafeScrollView>
      <VersionDisplay />
      <Pressable onPress={triggerSignOut}>
        <View className="flex flex-row gap-2 items-center border-t border-gray-200 py-3 px-3 ml-3">
          <MaterialIcons name="logout" size={20} color={colors.black} />
          <Text className="text-md">Logout</Text>
        </View>
      </Pressable>
    </View>
  );
}

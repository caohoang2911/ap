import { useLogin } from '@/api/auth';
import { setRedirectUrl } from '@/core';
import { NavigationHelpers } from '@/core/utils/navigation';
import { Image } from 'expo-image';
import React, { useEffect, useRef } from 'react';
import {
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  View,
} from 'react-native';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import Feather from '@expo/vector-icons/Feather';
import { showMessage } from 'react-native-flash-message';
import { setLoading } from '../core/store/loading';

const blurhash =
  '|rF?hV%2WCj[ayj[a|j[az_NaeWBj@ayfRayfQfQM{M|azj[azf6fQfQfQIpWXofj[ayj[j[fQayWCoeoeaya}j[ayfQa{oLj?j[WVj[ayayj[fQoff7azayj[ayj[j[ayofayayayj[fQj[ayayj[ayfjj[j[ayjuayj[';

export default function Login() {
  const {
    mutate: login,
    data,
    isPending,
    reset: resetLoginMutation,
  } = useLogin();
  const loginTimeoutRef = useRef<NodeJS.Timeout>();
  useEffect(() => {
    if (data) {
      setRedirectUrl(data?.data as string);
      NavigationHelpers.toAuthorize();
    }
  }, [data]);

  useEffect(() => {
    setLoading(false);
  }, []);

  useEffect(() => {
    if (!isPending) {
      if (loginTimeoutRef.current) {
        clearTimeout(loginTimeoutRef.current);
      }
      return;
    }

    loginTimeoutRef.current = setTimeout(() => {
      resetLoginMutation();
      showMessage({
        message: 'Đăng nhập quá thời gian, vui lòng thử lại',
        type: 'danger',
      });
    }, 15000);

    return () => {
      if (loginTimeoutRef.current) {
        clearTimeout(loginTimeoutRef.current);
      }
    };
  }, [isPending, resetLoginMutation]);

  const handleLogin = () => {
    Keyboard.dismiss();
    login();
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 8 : 0}
    >
      <ScrollView
        contentContainerStyle={{ flexGrow: 1, justifyContent: 'center' }}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        bounces={false}
        className="bg-slate-50"
      >
        <Pressable
          style={{ flexGrow: 1, justifyContent: 'center' }}
          onPress={Keyboard.dismiss}
          accessible={false}
        >
          <View className="flex flex-col px-6 py-10" style={{ gap: 36 }}>
            <View className="w-full flex justify-center items-center">
              <Image
                placeholder={{ blurhash }}
                contentFit="contain"
                source={'logo'}
                style={{ width: 208, height: 42 }}
              />
            </View>

            <View className="w-full" style={{ gap: 18 }}>
              <Pressable
                onPress={handleLogin}
                disabled={isPending}
                className="w-full flex flex-row items-center justify-center bg-blue-500 rounded-xl active:opacity-80"
                style={{
                  height: 54,
                  gap: 10,
                  paddingHorizontal: 20,
                  opacity: isPending ? 0.65 : 1,
                  shadowColor: '#2563EB',
                  shadowOffset: { width: 0, height: 4 },
                  shadowOpacity: 0.18,
                  shadowRadius: 8,
                  elevation: 2,
                }}
              >
                <MaterialIcons name="work-outline" size={21} color="white" />
                <Text className="text-white text-base font-semibold">
                  Đăng nhập bằng Harawork
                </Text>
                <Feather name="external-link" size={16} color="white" />
              </Pressable>

              <View className="flex flex-row items-center" style={{ gap: 12 }}>
                <View className="flex-1 h-px bg-slate-200" />
                <Text className="text-sm text-gray-500">Hoặc</Text>
                <View className="flex-1 h-px bg-slate-200" />
              </View>

              <Pressable
                onPress={NavigationHelpers.toInternalLogin}
                className="w-full flex-row items-center rounded-xl border border-slate-300 bg-white px-4 active:bg-slate-100"
                style={{ height: 54 }}
              >
                <View className="h-9 w-9 items-center justify-center rounded-lg bg-blue-50">
                  <MaterialIcons name="groups" size={21} color="#3280F6" />
                </View>
                <Text className="flex-1 px-3 text-base text-gray-700 font-medium">
                  Đăng nhập bằng tài khoản OMS
                </Text>
                <Feather name="chevron-right" size={20} color="#64748B" />
              </Pressable>
            </View>
          </View>
        </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

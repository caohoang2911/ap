import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { Formik } from 'formik';
import React, { useState } from 'react';
import {
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  View,
} from 'react-native';
import { showMessage } from 'react-native-flash-message';
import * as Yup from 'yup';

import { authorizeAppPickClient } from '@/api/auth/use-authorize-app-pick-client';
import { useAuthorizeUserPassword } from '@/api/auth/use-authorize-user-password';
import { Button } from '@/components/Button';
import { Input } from '@/components/Input';
import { signIn } from '@/core';
import {
  consumePendingDeepLink,
  processDeepLink,
} from '@/core/hooks/useHandleDeepLink';
import { ROUTES } from '@/core/constants/routes';
import { NavigationHelpers } from '@/core/utils/navigation';
import { isAllowedAppPickRole } from '@/core/utils/employee';

type LoginValues = {
  username: string;
  password: string;
};

const validationSchema = Yup.object({
  username: Yup.string().required('Vui lòng nhập tên đăng nhập'),
  password: Yup.string().required('Vui lòng nhập mật khẩu'),
});

export default function InternalLogin() {
  const [isPasswordVisible, setIsPasswordVisible] = useState(false);
  const { mutate: login, isPending } = useAuthorizeUserPassword(
    async (data) => {
      if (data.error) {
        Keyboard.dismiss();
        showMessage({ message: data.error, type: 'danger' });
        return;
      }

      const userInfo = data.data || {};
      if (!isAllowedAppPickRole(userInfo.role)) {
        Keyboard.dismiss();
        showMessage({
          message: 'Tài khoản chưa được cấp quyền truy cập App Pick',
          type: 'danger',
        });
        return;
      }

      const { zas } = userInfo;
      if (!zas) return;

      try {
        const response = await authorizeAppPickClient({ zas });
        const authorizedZas = response?.data?.zas;

        if (!authorizedZas) {
          console.error(
            '[InternalLogin] Missing zas in authorization response',
          );
          return;
        }

        signIn({
          token: authorizedZas,
          userInfo: { ...userInfo, zas: authorizedZas },
        });

        const savedDeepLink = consumePendingDeepLink();
        if (typeof savedDeepLink === 'string') {
          setTimeout(() => {
            try {
              processDeepLink(savedDeepLink);
            } catch (error) {
              console.error(
                '[InternalLogin] Error processing deep link:',
                error,
              );
            }
          }, 500);
        }
      } catch (error) {
        console.error('[InternalLogin] Authorization failed:', error);
      }
    },
  );

  const handleSubmit = (values: LoginValues) => {
    Keyboard.dismiss();
    login(values);
  };

  return (
    <KeyboardAvoidingView
      className="flex-1 bg-slate-50"
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <View className="flex-1">
        <View className="h-12 flex-row items-center px-3">
          <Pressable
            onPress={() => NavigationHelpers.goBack(ROUTES.AUTH.LOGIN)}
            className="h-10 flex-row items-center justify-center px-2"
            style={{ gap: 4 }}
            accessibilityRole="button"
            accessibilityLabel="Quay lại"
            hitSlop={8}
          >
            <MaterialIcons name="chevron-left" size={23} color="#374151" />
            <Text className="text-base font-medium text-gray-700">
              Quay lại
            </Text>
          </Pressable>
        </View>

        <ScrollView
          contentContainerStyle={{ flexGrow: 1, paddingTop: 48 }}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          bounces={false}
        >
          <Pressable onPress={Keyboard.dismiss} accessible={false}>
            <View className="px-6 pb-16">
              <View className="items-center mb-7">
                <View className="h-14 w-14 rounded-2xl bg-blue-100 items-center justify-center mb-4">
                  <MaterialIcons name="groups" size={28} color="#3280F6" />
                </View>
                <Text className="text-2xl font-semibold text-gray-700">
                  Đăng nhập tài khoản OMS
                </Text>
                <Text className="text-sm text-gray-500 mt-2 text-center px-4">
                  Nhập thông tin tài khoản nội bộ Seedcom để tiếp tục
                </Text>
              </View>

              <Formik<LoginValues>
                initialValues={{ username: '', password: '' }}
                validateOnChange
                onSubmit={handleSubmit}
                validationSchema={validationSchema}
              >
                {({
                  values,
                  errors,
                  handleBlur,
                  setFieldValue,
                  handleSubmit: submitForm,
                }) => (
                  <View
                    className="gap-4 rounded-3xl border border-slate-200 bg-white p-5"
                    style={{
                      shadowColor: '#0F172A',
                      shadowOffset: { width: 0, height: 6 },
                      shadowOpacity: 0.06,
                      shadowRadius: 16,
                      elevation: 2,
                    }}
                  >
                    <Input
                      selectTextOnFocus
                      label="Tên đăng nhập"
                      labelClasses="text-sm font-medium text-gray-700"
                      inputClasses="rounded-xl border-slate-300"
                      style={{ height: 50 }}
                      prefix={
                        <MaterialIcons
                          name="person-outline"
                          size={20}
                          color="#94A3B8"
                        />
                      }
                      onChangeText={(value: string) =>
                        setFieldValue('username', value)
                      }
                      placeholder="Nhập tên đăng nhập"
                      error={errors.username}
                      name="username"
                      value={values.username}
                      onBlur={handleBlur('username')}
                    />
                    <Input
                      label="Mật khẩu"
                      labelClasses="text-sm font-medium text-gray-700"
                      inputClasses="rounded-xl border-slate-300"
                      style={{ height: 50 }}
                      prefix={
                        <MaterialIcons
                          name="lock-outline"
                          size={20}
                          color="#94A3B8"
                        />
                      }
                      secureTextEntry={!isPasswordVisible}
                      suffix={
                        <Pressable
                          onPress={() =>
                            setIsPasswordVisible((visible) => !visible)
                          }
                          accessibilityRole="button"
                          accessibilityLabel={
                            isPasswordVisible ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'
                          }
                          hitSlop={8}
                        >
                          <MaterialIcons
                            name={
                              isPasswordVisible
                                ? 'visibility-off'
                                : 'visibility'
                            }
                            size={20}
                            color="#64748B"
                          />
                        </Pressable>
                      }
                      placeholder="Nhập mật khẩu"
                      value={values.password}
                      keyboardType="default"
                      error={errors.password}
                      handleBlur={handleBlur('password')}
                      onChangeText={(value: string) =>
                        setFieldValue('password', value)
                      }
                    />
                    <View className="mt-2">
                      <Button
                        loading={isPending}
                        variant="default"
                        onPress={submitForm as any}
                        size="lg"
                        className="h-12 rounded-xl"
                        labelClasses="text-base font-semibold"
                        label="Đăng nhập"
                      />
                    </View>
                  </View>
                )}
              </Formik>
            </View>
          </Pressable>
        </ScrollView>
      </View>
    </KeyboardAvoidingView>
  );
}

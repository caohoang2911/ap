import { getItem, removeItem, setItem } from '@/core/storage';
import { Role } from '~/src/types/employee';

const TOKEN = 'token';
const USER_INFO = 'user_info';

export type UserInfo = {
  id?: string;
  name?: string;
  expired?: number;
  username?: string;
  company?: string;
  role?: Role;
  storeCode: string;
  storeName: string;
  zas?: string;
  tenant?: string;
  /** Telegram user id — lấy từ bot / profile nhân viên. */
  teleId?: string | number;
  kposShiftStatus?: 'ON_SHIFT' | 'OFF_SHIFF';
};

export type TokenType = {
  token: string;
  userInfo: UserInfo;
};

export const getToken = () => getItem<string>(TOKEN);
export const getUserInfo = () => getItem<UserInfo>(USER_INFO);
export const removeToken = () => {
  removeItem(TOKEN);
  removeItem(USER_INFO);
};
export const setToken = (value: string) => setItem<string>(TOKEN, value);
export const setUserInfo = (value: TokenType['userInfo']) =>
  setItem<TokenType['userInfo']>(USER_INFO, value);

export const removeUserInfo = () => removeItem(USER_INFO);

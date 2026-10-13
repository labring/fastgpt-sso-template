import type {
  AssertFn,
  CallbackFn,
  GetMetaDataFn,
  GetOrgListFn,
  GetUserInfoFn,
  GetUserListFn,
  RedirectFn
} from 'type';

import { test_getOrgList, test_GetUserList, test_getUserInfo, test_redirectFn } from './example';
import { oauth2_getUserInfo, oauth2_redirectFn } from './oauth2.example';

const providerMap: {
  [key: string]: {
    getUserInfo?: GetUserInfoFn;
    redirectFn?: RedirectFn;
    callbackFn?: CallbackFn;
    getMetaData?: GetMetaDataFn;
    assertFn?: AssertFn;
    getUserList?: GetUserListFn;
    getOrgList?: GetOrgListFn;
  };
} = {
  test: {
    redirectFn: test_redirectFn,
    getUserInfo: test_getUserInfo,
    getUserList: test_GetUserList,
    getOrgList: test_getOrgList
  },
  oauth2: {
    redirectFn: oauth2_redirectFn,
    getUserInfo: oauth2_getUserInfo
  }
};

export function getProvider() {
  const provider = process.env.SSO_PROVIDER;
  return (provider ? providerMap[provider] : undefined) || false;
}

export function getSyncProvider() {
  const provider = process.env.SSO_SYNC_PROVIDER;
  return provider ? providerMap[provider] || false : getProvider();
}

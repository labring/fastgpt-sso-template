import type {
  GetUserInfoFn,
  RedirectFn,
  CallbackFn,
  GetUserListFn,
  GetOrgListFn,
} from "../type";
import type { Login } from "../wecom/login";
import type { Directory } from "../wecom/directory";
export type Provider = {
  redirectFn: RedirectFn;
  callbackFn: CallbackFn;
  getUserInfo: GetUserInfoFn;
  getUserList: GetUserListFn;
  getOrgList: GetOrgListFn;
};
export function createProvider(login: Login, directory: Directory): Provider {
  return {
    redirectFn: async ({ redirect_uri, state }) => ({
      redirectUrl: login.start(redirect_uri, state),
    }),
    callbackFn: async ({ req }) => ({ redirectUrl: await login.callback(req) }),
    getUserInfo: async (code) => login.consumeCode(code),
    getUserList: async () => (await directory.get()).userList,
    getOrgList: async () => (await directory.get()).orgList,
  };
}

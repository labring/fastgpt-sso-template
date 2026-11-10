import type { RequestHandler } from "express";
import type { Provider } from "./provider";
import { queryString, type Login } from "./wecom/login";
// Express 4 does not forward rejected async handlers automatically.
export const handle =
  (fn: RequestHandler): RequestHandler =>
  (req, res, next) => {
    Promise.resolve()
      .then(() => fn(req, res, next))
      .catch(next);
  };
export function controllers(provider: Provider, login: Login) {
  return {
    authUrl: handle(async (req, res) => {
      const { redirectUrl } = await provider.redirectFn({
        req,
        redirect_uri: queryString(req, "redirect_uri"),
        state: queryString(req, "state", false),
      });
      res.json({ success: true, message: "", authURL: redirectUrl });
    }),
    callback: handle(async (req, res) => {
      const { redirectUrl } = await provider.callbackFn({ req });
      login.clearCallbackCookie(req, res);
      res.redirect(redirectUrl);
    }),
    userInfo: handle(async (req, res) => {
      res.json({
        success: true,
        message: "",
        ...(await provider.getUserInfo(queryString(req, "code"))),
      });
    }),
    userList: handle(async (_req, res) => {
      res.json({
        success: true,
        message: "",
        userList: await provider.getUserList(),
      });
    }),
    orgList: handle(async (_req, res) => {
      res.json({
        success: true,
        message: "",
        orgList: await provider.getOrgList(),
      });
    }),
  };
}

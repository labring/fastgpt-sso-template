import express from "express";
import type { ErrorRequestHandler } from "express";
import { type Config, HttpError } from "./wecom/config";
import { WeComClient } from "./wecom/client";
import { Directory, type Client } from "./wecom/directory";
import { Login } from "./wecom/login";
import { createProvider } from "./provider";
import { controllers, handle } from "./controllers";
import { auth } from "./middleware";
export function createApp(config: Config, client: Client = new WeComClient()) {
  const app = express();
  // A stale form POST redirects to the trusted FastGPT login page. Browsers
  // apply form-action to that redirect as well as the initial form action.
  const fastgptOrigin = new URL(config.redirects[0]).origin;
  app.disable("x-powered-by");
  app.set("query parser", "simple");
  app.use((_req, res, next) => {
    res.set({
      "Cache-Control": "no-store",
      // no-referrer makes native form POSTs send Origin:null. Keep same-origin
      // submissions verifiable while suppressing referrers to external sites.
      "Referrer-Policy": "same-origin",
      "X-Content-Type-Options": "nosniff",
      "Content-Security-Policy": `default-src 'none'; style-src 'unsafe-inline'; form-action 'self' https://login.work.weixin.qq.com ${fastgptOrigin}; frame-ancestors 'none'; base-uri 'none'`,
    });
    next();
  });
  app.use(express.urlencoded({ extended: false, limit: "8kb" }));
  app.use(express.json({ limit: "8kb" }));
  const login = new Login(config, client),
    directory = new Directory(config, client);
  const c = controllers(createProvider(login, directory), login);
  app.get("/login/oauth/getAuthURL", c.authUrl);
  app.get("/login/oauth/getUserInfo", c.userInfo);
  app.get("/login/oauth/callback", c.callback);
  app.get(
    "/login/wecom/select",
    handle((req, res) => login.selectPage(req, res)),
  );
  app.post(
    "/login/wecom/select",
    handle((req, res) => login.select(req, res)),
  );
  app.get("/user/list", auth(config.authToken), c.userList);
  app.get("/org/list", auth(config.authToken), c.orgList);
  app.get("/test", (_req, res) => {
    res.send("FastGPT-SSO-Service");
  });
  const errors: ErrorRequestHandler = (err, _req, res, _next) => {
    const status =
      err instanceof HttpError
        ? err.status
        : err?.type === "entity.parse.failed"
          ? 400
          : 500;
    res.status(status).json({
      success: false,
      message: err instanceof HttpError ? err.message : "Request failed",
    });
  };
  app.use(errors);
  return app;
}

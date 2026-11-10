import { test, expect } from "bun:test";
import { Login } from "../src/wecom/login";
import { loadConfig } from "../src/wecom/config";
import { env } from "./fixtures";
const config = loadConfig(env);
const member = { userid: "Alice", name: "张三", status: 1 };
const client = {
  get: async (_corp: any, path: string) =>
    path === "auth/getuserinfo" ? { userid: "Alice" } : member,
};
function response() {
  const cookies = new Map<string, string>();
  let location = "";
  return {
    cookies,
    get location() {
      return location;
    },
    cookie: (k: string, v: string) => {
      cookies.set(k, v);
    },
    type() {
      return this;
    },
    send() {},
    redirect(statusOrUrl: number | string, url?: string) {
      location = typeof statusOrUrl === "string" ? statusOrUrl : url!;
    },
  };
}
function flow(login: Login) {
  const url = new URL(login.start(config.redirects[0], "original"));
  const ticket = url.searchParams.get("ticket")!;
  const page = response();
  login.selectPage({ query: { ticket }, headers: {} } as any, page as any);
  const selection = response();
  login.select(
    {
      body: { ticket, corp: "a" },
      headers: {
        origin: config.publicUrl,
        cookie: `wecom_${ticket}=${page.cookies.get("wecom_" + ticket)}`,
      },
    } as any,
    selection as any,
  );
  const state = new URL(selection.location).searchParams.get("state")!;
  return {
    query: { state, code: "upstream" },
    headers: {
      cookie: `wecom_${state}=${selection.cookies.get("wecom_" + state)}`,
    },
  } as any;
}
test("login transactions and local exchange codes expire", async () => {
  let time = 0;
  const login = new Login(config, client, () => time);
  const callback = flow(login);
  time = 300_001;
  await expect(login.callback(callback)).rejects.toThrow("expired");
  time = 0;
  const next = flow(login);
  const redirect = new URL(await login.callback(next));
  time = 60_001;
  expect(() => login.consumeCode(redirect.searchParams.get("code")!)).toThrow(
    "expired",
  );
});
test("browser-bound selection rejects cross-origin requests and wrong cookies", () => {
  const login = new Login(config, client);
  const ticket = new URL(login.start(config.redirects[0], "")).searchParams.get(
    "ticket",
  )!;
  const page = response();
  login.selectPage({ query: { ticket }, headers: {} } as any, page as any);
  const wrongBrowser = response();
  login.selectPage(
    { query: { ticket }, headers: { cookie: "wrong" } } as any,
    wrongBrowser as any,
  );
  expect(wrongBrowser.location).toBe("https://fastgpt.example/login");
  const originalBrowser = response();
  login.selectPage(
    {
      query: { ticket },
      headers: {
        cookie: `wecom_${ticket}=${page.cookies.get("wecom_" + ticket)}`,
      },
    } as any,
    originalBrowser as any,
  );
  expect(originalBrowser.cookies.get("wecom_" + ticket)).toBe(
    page.cookies.get("wecom_" + ticket),
  );
  expect(() =>
    login.select(
      {
        body: { ticket, corp: "a" },
        headers: { origin: "https://evil.example" },
      } as any,
      response() as any,
    ),
  ).toThrow("origin");
  expect(() =>
    login.select(
      {
        body: { ticket, corp: "a" },
        headers: { origin: config.publicUrl, cookie: "wrong" },
      } as any,
      response() as any,
    ),
  ).toThrow();
});

test("expired and post-restart selection links return to configured login without reusing state", () => {
  let now = 0;
  const custom = loadConfig({
    ...env,
    FASTGPT_REDIRECT_URIS:
      '["https://fastgpt.example/base/login/provider?tenant=example","https://other.example/login/provider"]',
  });
  const login = new Login(custom, client, () => now);
  const ticket = new URL(
    login.start(custom.redirects[0], "sensitive-state"),
  ).searchParams.get("ticket")!;
  now = 300001;
  for (const instance of [login, new Login(custom, client)]) {
    const res = response();
    instance.selectPage(
      {
        query: { ticket, redirect_uri: "https://evil.example" },
        headers: {},
      } as any,
      res as any,
    );
    expect(res.location).toBe("https://fastgpt.example/base/login");
    expect(res.cookies.get("wecom_" + ticket)).toBe("");
  }
});

import { afterAll, beforeAll, expect, test } from "bun:test";
import type { Server } from "node:http";
import { createApp } from "../src/app";
import { loadConfig } from "../src/wecom/config";
import { WeComClient } from "../src/wecom/client";
import { env } from "./fixtures";
let server: Server, base: string;
let failCorp = false;
let refreshes = 0;
const mock = Bun.serve({
  port: 0,
  fetch(req) {
    const u = new URL(req.url);
    const token = u.searchParams.get("access_token") || "";
    if (u.pathname.endsWith("/gettoken")) {
      refreshes++;
      return Response.json({
        access_token: u.searchParams.get("corpid"),
        expires_in: 7200,
      });
    }
    if (failCorp && token === "wwc")
      return Response.json({
        errcode: 60011,
        errmsg: "sensitive response should not leak",
      });
    if (u.pathname.endsWith("/department/list"))
      return Response.json({
        errcode: 0,
        department: [
          { id: 1, name: "总部", parentid: 0 },
          { id: 2, name: "研发", parentid: 1 },
        ],
      });
    if (u.pathname.endsWith("/user/list"))
      return Response.json({
        errcode: 0,
        userlist: [
          { userid: "Alice", name: "张三", department: [1, 2], status: 1 },
        ],
      });
    if (u.pathname.endsWith("/auth/getuserinfo"))
      return Response.json({
        errcode: 0,
        ...(u.searchParams.get("code") === "outsider"
          ? { openid: "external" }
          : { userid: "Alice" }),
      });
    if (u.pathname.endsWith("/user/get"))
      return Response.json({
        errcode: 0,
        userid: "Alice",
        name: "张三",
        department: [1, 2],
        status: 1,
      });
    return Response.json({ errcode: 40014 });
  },
});
beforeAll(async () => {
  server = createApp(
    loadConfig(env),
    new WeComClient(`http://127.0.0.1:${mock.port}`),
  ).listen(0, "127.0.0.1");
  await new Promise<void>((resolve) => server.once("listening", resolve));
  base = `http://127.0.0.1:${(server.address() as any).port}`;
});
afterAll(() => {
  server.close();
  mock.stop(true);
});
const get = (path: string, headers: Record<string, string> = {}) =>
  fetch(base + path, { headers, redirect: "manual" });
async function begin(corp = "a") {
  const res = await get(
    "/login/oauth/getAuthURL?" +
      new URLSearchParams({
        redirect_uri: "https://fastgpt.example/login/provider",
        state: "fastgpt-state&x=1",
      }),
  );
  const data = await res.json();
  expect(data.success).toBe(true);
  const selection = new URL(data.authURL);
  const ticket = selection.searchParams.get("ticket")!;
  const page = await get(selection.pathname + selection.search);
  expect(page.status).toBe(200);
  expect(page.headers.get("referrer-policy")).toBe("same-origin");
  expect(page.headers.get("content-security-policy")).toContain(
    "form-action 'self' https://login.work.weixin.qq.com https://fastgpt.example;",
  );
  expect(await page.text()).toContain("企业");
  const cookie = page.headers.get("set-cookie")!.split(";")[0];
  const chosen = await fetch(base + "/login/wecom/select", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Cookie: cookie,
      Origin: "http://localhost:3000",
    },
    body: new URLSearchParams({ ticket, corp }),
    redirect: "manual",
  });
  expect(chosen.status).toBe(302);
  const target = new URL(chosen.headers.get("location")!);
  expect(target.searchParams.get("appid")).toBe("ww" + corp);
  expect(target.searchParams.get("login_type")).toBe("CorpApp");
  return {
    state: target.searchParams.get("state")!,
    cookie: chosen.headers
      .getSetCookie()
      .find((v) =>
        v.startsWith("wecom_" + target.searchParams.get("state") + "="),
      )!
      .split(";")[0],
  };
}
test("three corporations log in through one-use local codes with original state", async () => {
  for (const corp of ["a", "b", "c"]) {
    const flow = await begin(corp);
    expect(
      (await get(`/login/oauth/callback?code=upstream&state=${flow.state}`))
        .status,
    ).toBe(400);
    const callback = await get(
      `/login/oauth/callback?code=upstream&state=${flow.state}`,
      { Cookie: flow.cookie },
    );
    expect(callback.status).toBe(302);
    const target = new URL(callback.headers.get("location")!);
    expect(target.searchParams.get("state")).toBe("fastgpt-state&x=1");
    const code = target.searchParams.get("code")!;
    const identity = await (
      await get("/login/oauth/getUserInfo?code=" + code)
    ).json();
    expect(identity.username).toBe(`wecom-${corp}:alice`);
    expect((await get("/login/oauth/getUserInfo?code=" + code)).status).toBe(
      400,
    );
    expect(
      (
        await get(`/login/oauth/callback?code=upstream&state=${flow.state}`, {
          Cookie: flow.cookie,
        })
      ).status,
    ).toBe(400);
  }
});
test("rejects external identities, invalid callbacks and duplicate query parameters", async () => {
  const flow = await begin();
  expect(
    (
      await get(`/login/oauth/callback?code=outsider&state=${flow.state}`, {
        Cookie: flow.cookie,
      })
    ).status,
  ).toBe(403);
  for (const query of [
    "redirect_uri=https://evil.example/callback",
    "redirect_uri=https://fastgpt.example/login/provider&redirect_uri=https://evil.example",
    "redirect_uri=https://fastgpt.example/login/provider&state=a&state=b",
  ])
    expect((await get("/login/oauth/getAuthURL?" + query)).status).toBe(400);
  expect((await get("/login/oauth/getUserInfo?code=a&code=b")).status).toBe(
    400,
  );
});
test("sync endpoints require exact Bearer authentication and expose all corporations", async () => {
  for (const path of ["/user/list", "/org/list"]) {
    for (const auth of [
      "",
      "Bearer wrong",
      "Basic test-only-token",
      "Bearer test-only-token extra",
    ])
      expect(
        (await get(path, auth ? { Authorization: auth } : {})).status,
      ).toBe(401);
    const res = await get(path, { Authorization: "Bearer test-only-token" });
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.success).toBe(true);
    expect(data.userList?.length || data.orgList?.length).toBe(
      path === "/user/list" ? 3 : 10,
    );
  }
  expect(refreshes).toBe(6); // login and directory token caches are separate
});
test("upstream errors never become partial successful snapshots", async () => {
  failCorp = true;
  const app = createApp(
    loadConfig(env),
    new WeComClient(`http://127.0.0.1:${mock.port}`),
  );
  const s = app.listen(0, "127.0.0.1");
  await new Promise<void>((r) => s.once("listening", r));
  try {
    const r = await fetch(
      `http://127.0.0.1:${(s.address() as any).port}/user/list`,
      { headers: { Authorization: "Bearer test-only-token" } },
    );
    expect(r.status).toBe(502);
    const b = await r.json();
    expect(b.success).toBe(false);
    expect(b.userList).toBeUndefined();
    expect(JSON.stringify(b)).not.toContain("sensitive");
  } finally {
    s.close();
    failCorp = false;
  }
});

test("selection and authenticated sync follow the configured one to three corporations", async () => {
  for (const count of [1, 2, 3]) {
    const corps = JSON.parse(env.WECOM_CORPS).slice(0, count);
    const config = loadConfig({
      ...env,
      WECOM_CORPS: JSON.stringify(corps),
      ...(count === 2 ? { SSO_SYNC_PROVIDER: "wecom" } : {}),
    });
    const s = createApp(
      config,
      new WeComClient(`http://127.0.0.1:${mock.port}`),
    ).listen(0, "127.0.0.1");
    await new Promise<void>((resolve) => s.once("listening", resolve));
    const url = `http://127.0.0.1:${(s.address() as any).port}`;
    try {
      const auth = await (
        await fetch(
          url +
            "/login/oauth/getAuthURL?" +
            new URLSearchParams({ redirect_uri: config.redirects[0] }),
        )
      ).json();
      const selection = new URL(auth.authURL);
      const html = await (
        await fetch(url + selection.pathname + selection.search)
      ).text();
      expect((html.match(/<button /g) || []).length).toBe(count);
      for (const path of ["/user/list", "/org/list"]) {
        expect((await fetch(url + path)).status).toBe(401);
        expect(
          (
            await fetch(url + path, {
              headers: { Authorization: "Bearer wrong" },
            })
          ).status,
        ).toBe(401);
        const r = await fetch(url + path, {
          headers: { Authorization: `Bearer ${config.authToken}` },
        });
        expect(r.status).toBe(200);
        const data = await r.json();
        expect(data.success).toBe(true);
        expect(
          path === "/user/list" ? data.userList.length : data.orgList.length,
        ).toBe(path === "/user/list" ? count : count * 3 + 1);
      }
    } finally {
      s.close();
    }
  }
});

test("selection rejects null origins even with a valid browser-bound ticket", async () => {
  const auth = await (
    await get(
      "/login/oauth/getAuthURL?" +
        new URLSearchParams({
          redirect_uri: "https://fastgpt.example/login/provider",
        }),
    )
  ).json();
  const selection = new URL(auth.authURL);
  const page = await get(selection.pathname + selection.search);
  const cookie = page.headers.getSetCookie()[0].split(";")[0];
  const r = await fetch(base + "/login/wecom/select", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Origin: "null",
      Cookie: cookie,
    },
    body: new URLSearchParams({
      ticket: selection.searchParams.get("ticket")!,
      corp: "a",
    }),
    redirect: "manual",
  });
  expect(r.status).toBe(400);
  expect((await r.json()).message).toBe("Invalid request origin");
});

test("used and unknown selection links return to trusted FastGPT login instead of JSON", async () => {
  const auth = await (
    await get(
      "/login/oauth/getAuthURL?" +
        new URLSearchParams({
          redirect_uri: "https://fastgpt.example/login/provider",
        }),
    )
  ).json();
  const selection = new URL(auth.authURL);
  const path = selection.pathname + selection.search;
  const page = await get(path);
  const cookie = page.headers.getSetCookie()[0].split(";")[0];
  const request = {
    method: "POST",
    headers: {
      Origin: "http://localhost:3000",
      Cookie: cookie,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      ticket: selection.searchParams.get("ticket")!,
      corp: "a",
    }),
    redirect: "manual" as const,
  };
  expect((await fetch(base + selection.pathname, request)).status).toBe(302);
  const used = await get(path);
  expect(used.status).toBe(302);
  expect(used.headers.get("location")).toBe("https://fastgpt.example/login");
  const repeated = await fetch(base + selection.pathname, request);
  expect(repeated.status).toBe(303);
  expect(repeated.headers.get("location")).toBe(
    "https://fastgpt.example/login",
  );
  for (const query of [
    "",
    "?ticket=unknown",
    "?ticket=" + "f".repeat(64),
    "?ticket=a&ticket=b&redirect_uri=https://evil.example",
  ]) {
    const r = await get("/login/wecom/select" + query);
    expect(r.status).toBe(302);
    expect(r.headers.get("location")).toBe("https://fastgpt.example/login");
  }
});

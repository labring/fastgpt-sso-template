import { test, expect } from "bun:test";
import { WeComClient } from "../src/wecom/client";
import { env } from "./fixtures";
import { loadConfig } from "../src/wecom/config";
const corp = loadConfig(env).corps[0];
test("refreshes an expired token once and deduplicates concurrent token fetches", async () => {
  let tokens = 0,
    calls = 0;
  const mock = Bun.serve({
    port: 0,
    fetch(req) {
      const u = new URL(req.url);
      if (u.pathname.endsWith("gettoken"))
        return Response.json({
          access_token: `t${++tokens}`,
          expires_in: 7200,
        });
      calls++;
      return Response.json(
        u.searchParams.get("access_token") === "t1"
          ? { errcode: 42001 }
          : { errcode: 0, userid: "alice" },
      );
    },
  });
  try {
    const client = new WeComClient(`http://127.0.0.1:${mock.port}`);
    const results = await Promise.all([
      client.get(corp, "user/get"),
      client.get(corp, "user/get"),
    ]);
    expect(results.every((r) => r.userid === "alice")).toBe(true);
    expect(tokens).toBe(2);
    expect(calls).toBe(4);
  } finally {
    mock.stop(true);
  }
});
test("redacts upstream details and rejects timeout, invalid token and malformed response", async () => {
  let mode = "error";
  let calls = 0;
  const mock = Bun.serve({
    port: 0,
    async fetch(req) {
      calls++;
      const u = new URL(req.url);
      if (mode === "timeout") {
        await Bun.sleep(40);
        return Response.json({});
      }
      if (mode === "malformed") return new Response("not-json");
      if (mode === "token")
        return Response.json({ access_token: "secret", expires_in: 0 });
      if (u.pathname.endsWith("gettoken"))
        return Response.json({ access_token: "secret", expires_in: 7200 });
      return Response.json({ errcode: 42001, errmsg: "private-secret" });
    },
  });
  try {
    for (const m of ["error", "malformed", "token", "timeout"]) {
      mode = m;
      calls = 0;
      const client = new WeComClient(`http://127.0.0.1:${mock.port}`, 10);
      try {
        await client.get(corp, "user/get");
        throw Error("expected failure");
      } catch (e) {
        expect(String(e)).not.toContain("private-secret");
        expect(String(e)).not.toContain("expected failure");
      }
      if (m === "error") expect(calls).toBe(4);
    }
  } finally {
    mock.stop(true);
  }
});

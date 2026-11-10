import { expect, test } from "bun:test";
import { loadConfig, userId, departmentId } from "../src/wecom/config";
import { ExpiringStore } from "../src/wecom/store";
import { env } from "./fixtures";
test("validates three unique corporations and provider selection", () => {
  expect(loadConfig(env).corps).toHaveLength(3);
  expect(
    loadConfig({ ...env, SSO_PROVIDER: "wecom", SSO_SYNC_PROVIDER: "wecom" })
      .corps,
  ).toHaveLength(3);
  for (const extra of [
    { SSO_PROVIDER: "test" },
    { SSO_SYNC_PROVIDER: "other" },
    { WECOM_CORPS: "[]" },
    { AUTH_TOKEN: "" },
    { PUBLIC_URL: "https://host/path" },
  ])
    expect(() => loadConfig({ ...env, ...extra })).toThrow();
  const corps = JSON.parse(env.WECOM_CORPS);
  corps[1].key = "a";
  expect(() =>
    loadConfig({ ...env, WECOM_CORPS: JSON.stringify(corps) }),
  ).toThrow();
});
test("identity mapping isolates enterprises and respects case-insensitive WeCom user IDs", () => {
  expect(userId("a", "Alice")).toBe(userId("a", "alice"));
  expect(userId("a", "alice")).not.toBe(userId("b", "alice"));
  expect(userId("a", "a:b")).not.toBe(userId("a", "a%3Ab"));
  expect(departmentId("a", 1)).not.toBe(departmentId("b", 1));
});
test("expiring store consumes once, expires and bounds allocations", () => {
  let now = 0;
  const store = new ExpiringStore<string>(10, 2, () => now);
  const a = store.put("a");
  expect(store.take(a)).toBe("a");
  expect(store.take(a)).toBeUndefined();
  const b = store.put("b");
  now = 11;
  expect(store.get(b)).toBeUndefined();
  store.put("c");
  store.put("d");
  expect(() => store.put("e")).toThrow();
});

test("accepts one to three corporations and rejects counts outside the range", () => {
  const corps = JSON.parse(env.WECOM_CORPS);
  for (const count of [1, 2, 3]) {
    expect(
      loadConfig({ ...env, WECOM_CORPS: JSON.stringify(corps.slice(0, count)) })
        .corps,
    ).toHaveLength(count);
  }
  for (const list of [
    [],
    [...corps, { ...corps[0], key: "d", corpId: "wwd" }],
  ]) {
    expect(() =>
      loadConfig({ ...env, WECOM_CORPS: JSON.stringify(list) }),
    ).toThrow("between 1 and 3");
  }
});

test("all enterprise usernames share the original Pro sync prefix across repeated syncs", () => {
  const names = [userId("tjffy-a", "TJFFY"), userId("cui-a", "CuiJinRui")];
  expect(names).toEqual(["wecom-tjffy-a:tjffy", "wecom-cui-a:cuijinrui"]);
  for (const first of names) {
    const prefix = first.split("-")[0];
    expect(prefix).toBe("wecom");
    const existing = new Set(names.filter((n) => n.startsWith(prefix)));
    for (let repeat = 0; repeat < 3; repeat++)
      expect(names.filter((n) => !existing.has(n))).toEqual([]);
  }
});

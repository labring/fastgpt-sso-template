import { test, expect } from "bun:test";
import { loadConfig } from "../src/wecom/config";
import { Directory } from "../src/wecom/directory";
import { env } from "./fixtures";
const config = loadConfig(env);
function client(fail = false, cycle = false) {
  return {
    get: async (c: any, path: string) => {
      if (fail && c.key === "c") throw Error("upstream down");
      if (path === "department/list")
        return {
          department: [
            { id: 1, name: "总部", parentid: 0 },
            { id: 2, name: "研发", parentid: cycle ? 2 : 99 },
          ],
        };
      return {
        userlist: [
          { userid: "Alice", name: "Alice", department: [1, 2, 2], status: 1 },
          { userid: "alice", name: "Alice", department: [2], status: 1 },
          { userid: "disabled", name: "停用", department: [1], status: 2 },
        ],
      };
    },
  };
}
test("aggregates three corporations, deduplicates and attaches missing parents", async () => {
  const directory = new Directory(config, client());
  const result = await directory.get();
  expect(result.orgList).toHaveLength(10);
  expect(result.userList).toHaveLength(3);
  expect(new Set(result.userList.map((u) => u.username)).size).toBe(3);
  expect(result.userList[0].orgs).toHaveLength(2);
  for (const o of result.orgList)
    expect(!o.parentId || result.orgList.some((p) => p.id === o.parentId)).toBe(
      true,
    );
  expect(await directory.get()).toBe(result);
});
test("never publishes partial data and rejects cyclic organizations", async () => {
  await expect(new Directory(config, client(true)).get()).rejects.toThrow();
  await expect(
    new Directory(config, client(false, true)).get(),
  ).rejects.toThrow();
});
test("rejects malformed or empty department snapshots", async () => {
  await expect(
    new Directory(config, { get: async () => ({ department: [] }) }).get(),
  ).rejects.toThrow();
});

test("concurrent directory requests share a refresh and expired failures do not return old data", async () => {
  let reads = 0;
  let fail = false;
  const upstream = client();
  const directory = new Directory(
    config,
    {
      async get(c, path) {
        reads++;
        await Bun.sleep(1);
        if (fail && c.key === "b") throw Error("permission revoked");
        return upstream.get(c, path);
      },
    },
    0,
  );
  const [a, b] = await Promise.all([directory.get(), directory.get()]);
  expect(a).toBe(b);
  expect(reads).toBe(9);
  fail = true;
  await expect(directory.get()).rejects.toThrow("permission revoked");
});

test("failed refresh retains the shared task until every enterprise settles", async () => {
  let active = 0,
    peak = 0;
  const upstream = client();
  const directory = new Directory(config, {
    async get(c, path) {
      if (c.key === "a") throw Error("unavailable");
      active++;
      peak = Math.max(peak, active);
      try {
        await Bun.sleep(10);
        return await upstream.get(c, path);
      } finally {
        active--;
      }
    },
  });
  for (let i = 0; i < 4; i++)
    await expect(directory.get()).rejects.toThrow("unavailable");
  expect(peak).toBeLessThanOrEqual(3);
  expect(active).toBe(0);
});

test("all enterprises share exactly one root without changing member or department IDs", async () => {
  for (const count of [1, 2, 3]) {
    const subset = { ...config, corps: config.corps.slice(0, count) };
    const result = await new Directory(subset, client()).get();
    const roots = result.orgList.filter((o) => o.parentId === "");
    expect(roots).toHaveLength(1);
    expect(roots[0].id).toBe("wecom:root");
    for (const c of subset.corps) {
      expect(
        result.orgList.find((o) => o.id === `wecom:${c.key}:root`)?.parentId,
      ).toBe("wecom:root");
      expect(
        result.orgList.find((o) => o.id === `wecom:${c.key}:dept:1`)?.parentId,
      ).toBe(`wecom:${c.key}:root`);
      expect(
        result.userList.some((u) => u.username === `wecom-${c.key}:alice`),
      ).toBe(true);
    }
    for (const user of result.userList)
      for (const id of user.orgs || [])
        expect(result.orgList.some((o) => o.id === id)).toBe(true);
  }
});

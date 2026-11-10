import type { OrgListType, UserListType } from "../type";
import {
  type Config,
  type Corp,
  HttpError,
  rootId,
  departmentId,
  userId,
} from "./config";
import type { WeComClient, ApiData } from "./client";
export type Client = Pick<WeComClient, "get">;
type Snapshot = { orgList: OrgListType; userList: UserListType };
const invalid = (): never => {
  throw new HttpError(502, "Invalid WeCom directory response");
};
const deptNumber = (id: unknown): id is number =>
  Number.isSafeInteger(id) && Number(id) > 0;
export class Directory {
  private cache?: { value: Snapshot; expires: number };
  private pending?: Promise<Snapshot>;
  constructor(
    private config: Config,
    private client: Client,
    private ttl = 60_000,
  ) {}
  async get(): Promise<Snapshot> {
    if (this.cache && this.cache.expires > Date.now()) return this.cache.value;
    if (this.pending) return this.pending;
    this.pending = (async () => {
      // At most three enterprises in flight; each enterprise reads departments sequentially.
      const settled = await Promise.allSettled(
        this.config.corps.map((c) => this.read(c)),
      );
      // Retain the shared task until healthy corporations also finish on failure.
      const failure = settled.find((part) => part.status === "rejected");
      if (failure?.status === "rejected") throw failure.reason;
      const parts = settled.map((part) => {
        if (part.status === "rejected") throw part.reason;
        return part.value;
      });
      const value = {
        // FastGPT accepts exactly one root, including when multiple enterprises
        // are configured. Enterprise and department IDs remain stable.
        orgList: [
          { id: "wecom:root", name: "企业通讯录", parentId: "" },
          ...parts.flatMap((p) => p.orgList),
        ],
        userList: parts.flatMap((p) => p.userList),
      };
      this.cache = { value, expires: Date.now() + this.ttl };
      return value;
    })();
    try {
      return await this.pending;
    } finally {
      this.pending = undefined;
    }
  }
  private async read(c: Corp): Promise<Snapshot> {
    const body = await this.client.get(c, "department/list", {}, true);
    if (!Array.isArray(body.department) || !body.department.length) invalid();
    const departments = new Map<number, ApiData>();
    for (const d of body.department) {
      if (
        !d ||
        !deptNumber(d.id) ||
        typeof d.name !== "string" ||
        !d.name.trim() ||
        !Number.isSafeInteger(d.parentid) ||
        d.parentid < 0 ||
        departments.has(d.id)
      )
        invalid();
      departments.set(d.id, d);
    }
    for (const d of departments.values()) {
      const seen = new Set<number>();
      let id = d.id;
      while (departments.has(id)) {
        if (seen.has(id)) invalid();
        seen.add(id);
        id = departments.get(id)!.parentid;
      }
    }
    const orgList: OrgListType = [
      { id: rootId(c.key), name: c.name, parentId: "wecom:root" },
    ];
    for (const d of departments.values())
      orgList.push({
        id: departmentId(c.key, d.id),
        name: d.name,
        parentId: departments.has(d.parentid)
          ? departmentId(c.key, d.parentid)
          : rootId(c.key),
      });
    const users = new Map<string, UserListType[number]>();
    // user/list is not paginated. Read each visible department without recursively fetching children.
    for (const d of departments.values()) {
      const data = await this.client.get(
        c,
        "user/list",
        { department_id: String(d.id), fetch_child: "0" },
        true,
      );
      if (!Array.isArray(data.userlist)) invalid();
      for (const u of data.userlist) {
        if (
          !u ||
          typeof u.userid !== "string" ||
          !u.userid.trim() ||
          typeof u.name !== "string" ||
          !u.name.trim() ||
          !Array.isArray(u.department) ||
          !u.department.every(deptNumber)
        )
          invalid();
        if (u.status !== undefined && ![1, 2, 4, 5].includes(u.status))
          invalid();
        if (u.status !== undefined && u.status !== 1) continue;
        const username = userId(c.key, u.userid);
        const orgs = u.department
          .filter((id: number) => departments.has(id))
          .map((id: number) => departmentId(c.key, id));
        // The requested department is a reliable membership even if the response hides other departments.
        orgs.push(departmentId(c.key, d.id));
        const previous = users.get(username);
        users.set(username, {
          username,
          memberName: u.name,
          avatar: typeof u.avatar === "string" ? u.avatar : "",
          contact: typeof u.mobile === "string" ? u.mobile : "",
          orgs: [...new Set([...(previous?.orgs || []), ...orgs])],
        });
      }
    }
    return { orgList, userList: [...users.values()] };
  }
}

import { timingSafeEqual } from "node:crypto";
import type { RequestHandler } from "express";
export function auth(token: string): RequestHandler {
  return (req, res, next) => {
    const actual = Buffer.from(req.headers.authorization || "");
    const expected = Buffer.from(`Bearer ${token}`);
    if (
      actual.length !== expected.length ||
      !timingSafeEqual(actual, expected)
    ) {
      res.status(401).json({ success: false, error: "Unauthorized" });
      return;
    }
    next();
  };
}

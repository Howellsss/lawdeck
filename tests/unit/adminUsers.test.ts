import { describe, expect, it } from "vitest";
import { signInMethodLabel, timeAgo, usersHref } from "@/lib/adminUsers";
import { userFilterSchema } from "@/schemas/adminUsers";

// The admin Users dashboard (migration 34). Database rules: tests/permissions/sql/9m_admin_users_test.sql.

describe("the people filters", () => {
  it("read the page address, tidying the search words", () => {
    expect(userFilterSchema.parse({ q: "  ada   obi ", plan: "Free", payment: "paid", page: "3" })).toEqual({ q: "ada obi", plan: "Free", payment: "paid", sort: "newest", page: 3 });
  });

  it("fall back to no filter when the address has something unexpected", () => {
    expect(userFilterSchema.parse({ q: "x".repeat(101), payment: "free", page: "-2" })).toEqual({ q: null, plan: null, payment: null, sort: "newest", page: 1 });
    expect(userFilterSchema.parse({})).toEqual({ q: null, plan: null, payment: null, sort: "newest", page: 1 });
    expect(userFilterSchema.parse({ q: ["first", "second"], page: "abc" })).toEqual({ q: "first", plan: null, payment: null, sort: "newest", page: 1 });
    expect(userFilterSchema.parse({ sort: "random" }).sort).toBe("newest");
  });

  it("make addresses that keep the filters and leave out empty ones", () => {
    expect(usersHref({})).toBe("/admin/users");
    expect(usersHref({ q: "ada obi", plan: null, payment: "unpaid", page: 2 })).toBe("/admin/users?q=ada+obi&payment=unpaid&page=2");
    expect(usersHref({ q: null, page: 1 })).toBe("/admin/users");
  });

  it("order the list by cost, questions or activity, and keep the order in addresses (migration 42)", () => {
    expect(userFilterSchema.parse({ sort: "cost" }).sort).toBe("cost");
    expect(userFilterSchema.parse({ sort: ["questions"] }).sort).toBe("questions");
    expect(usersHref({ sort: "cost", page: 2 })).toBe("/admin/users?sort=cost&page=2");
    expect(usersHref({ sort: "newest" })).toBe("/admin/users");
  });
});

describe("dashboard words", () => {
  it("name the sign-in method", () => {
    expect(signInMethodLabel("google")).toBe("Google");
    expect(signInMethodLabel("email")).toBe("Email");
    expect(signInMethodLabel("apple")).toBe("Apple");
  });

  it("say how long ago something happened, for the last month", () => {
    const now = new Date("2026-10-24T12:00:00Z");
    expect(timeAgo("2026-10-24T11:59:40Z", now)).toBe("Just now");
    expect(timeAgo("2026-10-24T11:57:00Z", now)).toBe("3 minutes ago");
    expect(timeAgo("2026-10-24T11:00:00Z", now)).toBe("1 hour ago");
    expect(timeAgo("2026-10-23T10:00:00Z", now)).toBe("Yesterday");
    expect(timeAgo("2026-10-19T12:00:00Z", now)).toBe("5 days ago");
    expect(timeAgo("2026-08-01T12:00:00Z", now)).toBeNull();
    expect(timeAgo(null, now)).toBeNull();
    expect(timeAgo("not a date", now)).toBeNull();
  });
});

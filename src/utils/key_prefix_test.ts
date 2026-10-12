import { assertEquals } from "jsr:@std/assert";
import {
  applyKeyPrefix,
  findOverlongKeys,
  remapPrerequisites,
  remapRuleSegmentReferences,
  validateKeyPrefix,
} from "./key_prefix.ts";

Deno.test("validateKeyPrefix accepts valid and null prefixes", () => {
  assertEquals(validateKeyPrefix(null), null);
  assertEquals(validateKeyPrefix(undefined), null);
  assertEquals(validateKeyPrefix("my-other_project."), null);
});

Deno.test("validateKeyPrefix rejects invalid prefixes", () => {
  for (const bad of ["", "has space", "slash/", "emoji🚀", "a:b"]) {
    assertEquals(typeof validateKeyPrefix(bad), "string", bad);
  }
  assertEquals(validateKeyPrefix("a".repeat(99)), null);
  assertEquals(typeof validateKeyPrefix("a".repeat(100)), "string");
});

Deno.test("applyKeyPrefix prepends once and passes null through", () => {
  assertEquals(applyKeyPrefix("flag", "fe-"), "fe-flag");
  assertEquals(applyKeyPrefix("fe-flag", "fe-"), "fe-flag");
  assertEquals(applyKeyPrefix("flag", null), "flag");
  assertEquals(applyKeyPrefix("Flag Name", "fe-"), "fe-Flag Name");
});

Deno.test("findOverlongKeys enforces the 100 character limit", () => {
  const prefix = "p-";
  assertEquals(findOverlongKeys(["a".repeat(98)], prefix), []);
  assertEquals(findOverlongKeys(["a".repeat(99)], prefix).length, 1);
  assertEquals(findOverlongKeys(["a".repeat(98)], prefix, "x-").length, 1);
});

Deno.test("remapPrerequisites only rewrites migrated flags", () => {
  const result = remapPrerequisites(
    [{ key: "a", variation: 0 }, { key: "external", variation: 1 }],
    { flagKeys: new Set(["a"]), keyPrefix: "p-" },
  );
  assertEquals(result.map((r) => r.key), ["p-a", "external"]);
});

Deno.test("remapRuleSegmentReferences only rewrites segmentMatch values", () => {
  const rules = [{
    clauses: [
      { op: "segmentMatch", values: ["seg", "other"] },
      { op: "in", values: ["seg"] },
    ],
  }];
  const result = remapRuleSegmentReferences(rules, {
    segmentKeys: new Set(["seg"]),
    keyPrefix: "p-",
  });
  assertEquals((result[0].clauses[0] as { values: unknown[] }).values, [
    "p-seg",
    "other",
  ]);
  assertEquals((result[0].clauses[1] as { values: unknown[] }).values, ["seg"]);
});

Deno.test("remap helpers prefer resolved (conflict-renamed) keys", () => {
  const prereqs = remapPrerequisites(
    [{ key: "a" }, { key: "b" }],
    {
      flagKeys: new Set(["a", "b"]),
      keyPrefix: "p-",
      resolved: new Map([["a", "c-p-a"]]),
    },
  );
  assertEquals(prereqs.map((r) => r.key), ["c-p-a", "p-b"]);

  const rules = remapRuleSegmentReferences(
    [{ clauses: [{ op: "segmentMatch", values: ["seg"] }] }],
    {
      segmentKeys: new Set(["seg"]),
      keyPrefix: "p-",
      resolved: new Map([["seg", "c-p-seg"]]),
    },
  );
  assertEquals((rules[0].clauses[0] as { values: unknown[] }).values, [
    "c-p-seg",
  ]);
});

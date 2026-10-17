import test from "node:test";
import assert from "node:assert/strict";
import { existsSync } from "node:fs";

test("the unmodified source portrait is never shipped from the public directory", () => {
  assert.equal(existsSync("public/images/test0123-removebg-preview.png"), false);
});

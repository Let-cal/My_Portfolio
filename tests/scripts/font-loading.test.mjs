import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import ts from "typescript";

test("optional web fonts do not compete with the Hero image through eager preloads", () => {
  const source = ts.createSourceFile("layout.tsx", readFileSync("src/app/[locale]/layout.tsx", "utf8"), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const faces = new Set(["Inter", "Space_Grotesk", "Instrument_Serif"]);
  let count = 0;
  function visit(node) {
    if (ts.isCallExpression(node) && ts.isIdentifier(node.expression) && faces.has(node.expression.text)) {
      count++;
      const options = node.arguments[0];
      assert.ok(options && ts.isObjectLiteralExpression(options));
      const preload = options.properties.find(property => ts.isPropertyAssignment(property) && property.name.getText(source) === "preload");
      assert.equal(preload?.initializer.kind, ts.SyntaxKind.FalseKeyword, `${node.expression.text} should use browser font discovery`);
    }
    ts.forEachChild(node, visit);
  }
  visit(source);
  assert.equal(count, 3);
});

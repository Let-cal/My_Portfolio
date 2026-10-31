import { readFileSync } from "node:fs";
import ts from "typescript";
import { clsx } from "clsx";
import { twMerge } from "tailwind-merge";
import { describe, expect, it } from "vitest";

// Exercise the actual JSX class expressions, including both sides of each branch.
// Indices include retained cn calls, so external overrides/conflicts stay covered.
const cases = [
  { file: "site/LanguageSwitch.tsx", eligible: [1], retained: [0] },
  { file: "site/PillNav.tsx", eligible: [0], retained: [] },
  // The side rail is server markup styled by ink-thread.css; it has no conditional class joins.
  { file: "site/SideRail.tsx", eligible: [], retained: [] },
  {
    file: "sections/certificates/CertificatesBoard.tsx",
    eligible: [0, 1, 2, 3],
    retained: [],
  },
  { file: "sections/skills/SkillMap.tsx", eligible: [1, 2], retained: [0, 3] },
];

function readCalls(file: string) {
  const source = ts.createSourceFile(
    file,
    readFileSync(`src/components/${file}`, "utf8"),
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TSX,
  );
  const calls: ts.CallExpression[] = [];
  let grid = "";
  function visit(node: ts.Node) {
    if (
      ts.isVariableDeclaration(node) &&
      node.name.getText(source) === "GRID" &&
      node.initializer &&
      ts.isStringLiteral(node.initializer)
    ) {
      grid = node.initializer.text;
    }
    if (
      ts.isJsxAttribute(node) &&
      node.name.getText(source) === "className" &&
      node.initializer &&
      ts.isJsxExpression(node.initializer)
    ) {
      const expression = node.initializer.expression;
      if (
        expression &&
        ts.isCallExpression(expression) &&
        ["cn", "clsx"].includes(expression.expression.getText(source))
      )
        calls.push(expression);
    }
    ts.forEachChild(node, visit);
  }
  visit(source);
  return { source, calls, grid };
}

describe.each(cases)(
  "controlled startup classes: $file",
  ({ file, eligible, retained }) => {
    const { source, calls, grid } = readCalls(file);

    it("joins eligible internal classes without runtime conflict resolution", () => {
      expect(calls).toHaveLength(eligible.length + retained.length);
      for (const index of eligible)
        expect(calls[index].expression.getText(source)).toBe("clsx");
      for (const index of retained)
        expect(calls[index].expression.getText(source)).toBe("cn");
    });

    it.each([false, true])(
      "preserves twMerge output for branch=%s",
      (state) => {
        for (const index of eligible) {
          const call = calls[index];
          const args = call.arguments
            .map((arg) => arg.getText(source))
            .join(",");
          const inputs = new Function(
            "active",
            "current",
            "selected",
            "checked",
            "GRID",
            `return [${args}];`,
          )(state, state, state, state, grid);
          expect(clsx(inputs), `class expression ${index}`).toBe(
            twMerge(clsx(inputs)),
          );
        }
      },
    );
  },
);

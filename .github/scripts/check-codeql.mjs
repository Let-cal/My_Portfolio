import { readFileSync, readdirSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

export function reviewCodeql(sarif) {
  if (!Array.isArray(sarif.runs) || sarif.runs.length === 0)
    throw new Error("CodeQL analysis is missing");
  const findings = [];
  for (const run of sarif.runs) {
    const rules = [run.tool?.driver, ...(run.tool?.extensions ?? [])].flatMap(
      (component) => component?.rules ?? [],
    );
    if (!Array.isArray(run.results))
      throw new Error("CodeQL analysis results are missing");
    for (const result of run.results) {
      const matches = rules.filter((rule) => rule.id === result.ruleId);
      if (matches.length !== 1)
        throw new Error(`Missing or ambiguous CodeQL rule: ${result.ruleId}`);
      const rule = matches[0];
      const hasSeverity = Object.hasOwn(
        rule.properties ?? {},
        "security-severity",
      );
      const rawScore = rule.properties?.["security-severity"];
      if (
        hasSeverity &&
        !(
          typeof rawScore === "number" ||
          (typeof rawScore === "string" && /^\d+(\.\d+)?$/.test(rawScore))
        )
      )
        throw new Error("Invalid CodeQL severity");
      const score = hasSeverity ? Number(rawScore) : 0;
      if (!Number.isFinite(score) || score < 0 || score > 10)
        throw new Error("Invalid CodeQL severity");
      const level =
        result.level ?? rule.defaultConfiguration?.level ?? "warning";
      findings.push({
        ruleId: result.ruleId,
        severity: score,
        level,
        location: result.locations?.[0]?.physicalLocation,
      });
    }
  }
  return {
    findings,
    blocking: findings.filter(
      (result) => result.level === "error" || result.severity >= 7,
    ),
  };
}

if (
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  const directory = process.argv[2] ?? "codeql-results";
  const files = readdirSync(directory).filter((file) =>
    file.endsWith(".sarif"),
  );
  if (files.length === 0)
    throw new Error("CodeQL did not produce SARIF results");
  let blocking = 0;
  for (const file of files) {
    const review = reviewCodeql(
      JSON.parse(readFileSync(join(directory, file), "utf8")),
    );
    console.log(JSON.stringify({ file, ...review }));
    blocking += review.blocking.length;
  }
  console.log(`CodeQL blocking findings: ${blocking}`);
  process.exitCode = blocking ? 1 : 0;
}

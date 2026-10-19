import { describe, expect, it } from "vitest";
import type { ZodObject } from "zod";
import {
  certificateSchema,
  contentSchema,
  projectSchema,
  whyCardSchema,
} from "@/content/schema";
import seed from "@/content/seed.json";
import { emptyItem } from "@/lib/admin/empty-item";
import { resources } from "@/lib/admin/resources";
import { describeIssues, isRequired } from "@/lib/admin/validation";

const content = contentSchema.parse(seed);
const certFields = resources.certificates.fields;

function errorsFor(
  schema: ZodObject,
  fields = certFields,
  values: Record<string, unknown>,
) {
  const result = schema.omit({ sortIndex: true } as never).safeParse(values);
  if (result.success) return {};
  return Object.fromEntries(
    describeIssues(result.error.issues, fields, values).map((e) => [
      e.path,
      e.message,
    ]),
  );
}

describe("describeIssues", () => {
  it("names every missing required field of a new certificate, and only those", () => {
    const errors = errorsFor(
      certificateSchema,
      certFields,
      emptyItem("certificates"),
    );
    expect(errors).toEqual({
      id: "Nhập ID",
      name: "Nhập tên chứng chỉ",
      organization: "Nhập tổ chức cấp",
      issueDate: "Chọn ngày cấp",
      "description.en": "Nhập mô tả (EN)",
    });
  });

  it("explains format problems", () => {
    const { sortIndex: _s, ...cert } = content.certificates[0];
    void _s;
    expect(
      errorsFor(certificateSchema, certFields, { ...cert, id: "AWS SAA" }).id,
    ).toBe(
      "ID chỉ gồm chữ thường không dấu, số và dấu gạch ngang (ví dụ: aws-saa)",
    );
    expect(
      errorsFor(certificateSchema, certFields, {
        ...cert,
        credentialUrl: "abc",
      }).credentialUrl,
    ).toBe("Link xác minh phải là đường dẫn đầy đủ, bắt đầu bằng https://");
    expect(
      errorsFor(certificateSchema, certFields, {
        ...cert,
        issueDate: "30/09/2026",
      }).issueDate,
    ).toBe("Ngày cấp phải có dạng ngày/tháng/năm");
  });

  it("points nested errors at the input that holds the value", () => {
    const fields = resources.projects.fields;
    const { sortIndex: _s, ...project } = content.projects.find(
      (p) => p.caseStudy,
    )!;
    void _s;
    const broken = {
      ...project,
      start: "2026",
      caseStudy: {
        ...project.caseStudy!,
        result: { ...project.caseStudy!.result, en: "" },
      },
      links: [{ label: "", url: "x" }],
    };
    const errors = errorsFor(projectSchema, fields, broken as never);
    expect(errors["caseStudy.result.en"]).toBe(
      "Nhập Kết quả của case study (EN)",
    );
    expect(errors.start).toBe("Chọn tháng bắt đầu");
  });

  it("explains why card links and colors", () => {
    const fields = resources.why_cards.fields;
    const { sortIndex: _s, ...card } = content.whyCards[0];
    void _s;
    const errors = errorsFor(whyCardSchema, fields, {
      ...card,
      evidenceLink: "x",
      colors: ["red", "#000000"],
    });
    expect(errors.evidenceLink).toBe(
      "Chọn một kinh nghiệm hoặc dự án làm bằng chứng",
    );
    expect(errors["colors.0"]).toBe("Màu phải có dạng #RRGGBB");
  });

  it("explains link rows", () => {
    const fields = resources.experiences.fields;
    const { sortIndex: _s, ...exp } = content.experiences[0];
    void _s;
    const result = contentSchema.shape.experiences.element
      .omit({ sortIndex: true })
      .safeParse({ ...exp, links: [{ label: "", url: "x" }] });
    const errors = Object.fromEntries(
      describeIssues(result.error!.issues, fields, {
        ...exp,
        links: [{ label: "", url: "x" }],
      }).map((e) => [e.path, e.message]),
    );
    expect(errors["links.0.label"]).toBe("Nhập nhãn liên kết");
    expect(errors["links.0.url"]).toBe(
      "URL của liên kết phải bắt đầu bằng https://",
    );
  });

  it("returns errors in the form's field order", () => {
    const result = certificateSchema
      .omit({ sortIndex: true })
      .safeParse(emptyItem("certificates"));
    const paths = describeIssues(
      result.error!.issues,
      certFields,
      emptyItem("certificates"),
    ).map((e) => e.path);
    expect(paths).toEqual([
      "id",
      "name",
      "organization",
      "issueDate",
      "description.en",
    ]);
  });
});

describe("isRequired", () => {
  const field = (name: string) => certFields.find((f) => f.name === name)!;
  it("marks text the visitor must provide", () => {
    expect(isRequired(field("name"))).toBe(true);
    expect(isRequired(field("description"))).toBe(true);
  });
  it("leaves optional fields unmarked", () => {
    for (const name of [
      "credentialUrl",
      "credentialId",
      "fileUrl",
      "published",
      "skills",
    ])
      expect(isRequired(field(name)), name).toBe(false);
    expect(
      isRequired(
        resources.projects.fields.find((f) => f.name === "caseStudy")!,
      ),
    ).toBe(false);
  });
});

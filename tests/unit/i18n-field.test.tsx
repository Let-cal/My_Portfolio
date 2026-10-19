import { fireEvent, render, screen, within } from "@testing-library/react";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { I18nField, LocaleModeProvider, LocaleModeSwitch, type I18nValue } from "@/components/admin/I18nField";

function Field({ mode = "all" as const, initial = { en: "Hello", ja: "", vi: "" }, onChange = vi.fn(), errors = {} }: {
  mode?: "all" | "en" | "ja" | "vi";
  initial?: I18nValue;
  onChange?: (v: I18nValue) => void;
  errors?: Partial<Record<"en" | "ja" | "vi", string>>;
}) {
  const [value, setValue] = useState(initial);
  return (
    <LocaleModeProvider initialMode={mode}>
      <LocaleModeSwitch errorLocales={new Set(Object.keys(errors))} />
      <I18nField
        label="Mô tả"
        idPrefix="description"
        multiline
        required
        value={value}
        errors={errors}
        onChange={(v) => {
          setValue(v);
          onChange(v);
        }}
      />
    </LocaleModeProvider>
  );
}

describe("translation editing", () => {
  it("shows all three languages by default", () => {
    render(<Field />);
    for (const l of ["en", "ja", "vi"]) expect(document.getElementById(`field-description.${l}`)).not.toBeNull();
  });

  it("shows one language at a time, with the English text as a reference", () => {
    render(<Field mode="ja" />);
    expect(document.getElementById("field-description.ja")).not.toBeNull();
    expect(document.getElementById("field-description.en")).toBeNull();
    expect(screen.getByText("Hello")).toBeTruthy();
  });

  it("switches language from the switch", () => {
    render(<Field />);
    fireEvent.click(screen.getByRole("radio", { name: "VI" }));
    expect(document.getElementById("field-description.vi")).not.toBeNull();
    expect(document.getElementById("field-description.ja")).toBeNull();
  });

  it("flags a language that has an error while another one is shown", () => {
    render(<Field mode="en" errors={{ ja: "Nhập mô tả (JA)" }} />);
    const switcher = screen.getByRole("radiogroup", { name: "Ngôn ngữ đang sửa" });
    expect(within(switcher).getByLabelText("JA có lỗi")).toBeTruthy();
  });

  it("copies English into an empty translation as a draft", () => {
    const onChange = vi.fn();
    render(<Field onChange={onChange} />);
    fireEvent.click(screen.getByRole("button", { name: "Chép từ EN sang JA" }));
    expect(onChange).toHaveBeenLastCalledWith({ en: "Hello", ja: "Hello", vi: "" });
  });

  it("lets text areas grow with their content", () => {
    render(<Field />);
    expect(document.getElementById("field-description.en")!.className).toContain("field-sizing-content");
  });
});

import { fireEvent, render, screen, within } from "@testing-library/react";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { SkillPicker } from "@/components/admin/SkillPicker";
import { TagCombobox } from "@/components/admin/TagCombobox";

const options = [
  { id: "react", label: "React", group: "frameworks" as const },
  { id: "rtl", label: "React Testing Library", group: "testing" as const },
  { id: "ts", label: "TypeScript", group: "languages" as const },
];

function Picker({ initial = [] as string[], onChange = vi.fn() }) {
  const [value, setValue] = useState(initial);
  return (
    <SkillPicker
      label="Skills dùng ở đây"
      value={value}
      options={options}
      onChange={(v) => {
        setValue(v);
        onChange(v);
      }}
    />
  );
}

describe("SkillPicker", () => {
  it("finds skills by name, grouped, and adds the chosen one as a chip", () => {
    const onChange = vi.fn();
    render(<Picker initial={["ts"]} onChange={onChange} />);
    fireEvent.change(screen.getByRole("combobox", { name: "Skills dùng ở đây" }), { target: { value: "rea" } });
    const list = screen.getByRole("listbox");
    expect(within(list).getByText("frameworks")).toBeTruthy();
    expect(within(list).getByText("testing")).toBeTruthy();
    fireEvent.click(within(list).getByRole("option", { name: "React" }));
    expect(onChange).toHaveBeenLastCalledWith(["ts", "react"]);
    expect(screen.getByRole("button", { name: "Bỏ React" })).toBeTruthy();
  });

  it("removes a chip", () => {
    const onChange = vi.fn();
    render(<Picker initial={["ts", "react"]} onChange={onChange} />);
    fireEvent.click(screen.getByRole("button", { name: "Bỏ TypeScript" }));
    expect(onChange).toHaveBeenLastCalledWith(["react"]);
  });

  it("does not offer skills already chosen", () => {
    render(<Picker initial={["react"]} />);
    fireEvent.change(screen.getByRole("combobox", { name: "Skills dùng ở đây" }), { target: { value: "rea" } });
    expect(within(screen.getByRole("listbox")).queryByRole("option", { name: "React" })).toBeNull();
  });
});

describe("TagCombobox", () => {
  function Tags({ onChange = vi.fn() }) {
    const [value, setValue] = useState<string[]>([]);
    return (
      <TagCombobox
        label="Kỹ năng liên quan"
        value={value}
        suggestions={["TypeScript", "React"]}
        onChange={(v) => {
          setValue(v);
          onChange(v);
        }}
      />
    );
  }

  it("suggests existing skill names", () => {
    const onChange = vi.fn();
    render(<Tags onChange={onChange} />);
    fireEvent.change(screen.getByRole("combobox", { name: "Kỹ năng liên quan" }), { target: { value: "type" } });
    fireEvent.click(screen.getByRole("option", { name: "TypeScript" }));
    expect(onChange).toHaveBeenLastCalledWith(["TypeScript"]);
  });

  it("keeps free text on Enter", () => {
    const onChange = vi.fn();
    render(<Tags onChange={onChange} />);
    const input = screen.getByRole("combobox", { name: "Kỹ năng liên quan" });
    fireEvent.change(input, { target: { value: "User Research" } });
    fireEvent.keyDown(input, { key: "Enter" });
    expect(onChange).toHaveBeenLastCalledWith(["User Research"]);
  });
});

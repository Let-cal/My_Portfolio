"use client";

import { PrinterIcon } from "lucide-react";
import { Button } from "@/components/ui/button";

/** Opens the browser print dialog. The only script the 60-second view adds besides the shared site chrome. */
export function PrintButton({ label }: { label: string }) {
  return (
    <Button type="button" variant="outline" onClick={() => window.print()}>
      <PrinterIcon aria-hidden="true" />
      {label}
    </Button>
  );
}

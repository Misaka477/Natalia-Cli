import type { RuntimeModelCatalogEntry } from "@natalia/contracts";
import { createMemo } from "solid-js";
import { DialogSelect } from "../dialog/DialogSelect";
import { useDialog } from "../dialog/provider";

export function buildVariantOptions(
  model: RuntimeModelCatalogEntry,
  current?: string,
) {
  return [
    {
      title: "Default variant",
      value: "",
      footer: current ? undefined : "current",
    },
    ...model.variants.map((variant) => ({
      title: variant,
      value: variant,
      footer: variant === current ? "current" : undefined,
    })),
  ];
}

export function DialogVariant(props: {
  model: RuntimeModelCatalogEntry;
  current?: string;
  select(variant?: string): Promise<void>;
}) {
  const dialog = useDialog();
  const options = createMemo(() =>
    buildVariantOptions(props.model, props.current),
  );
  return (
    <DialogSelect
      title={`Select variant: ${props.model.name}`}
      renderFilter={false}
      options={options()}
      current={props.current ?? ""}
      onSelect={(option) =>
        void props.select(option.value || undefined).then(() => dialog.pop())
      }
    />
  );
}

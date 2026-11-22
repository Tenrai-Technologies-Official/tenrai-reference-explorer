import { createElement as h, type ReactNode } from "react";
import type { InputView } from "@tenrai/sdk";
import { nativeAuthorizationConditions, type NativeAuthorization } from "../../shared/native-locks.ts";

/** Use plain React elements so Node can render the view in tests. */
export function NativeLockAuthorizationFacts({ authorization, inputs }: { authorization: NativeAuthorization; inputs: readonly InputView[] }) {
  try {
    const details = nativeAuthorizationConditions(authorization, inputs);
    const address = (value: string) => h("a", { className: "link mono", href: `/address/${value}` }, value);
    const rows: [string, ReactNode][] = [
      ["Input", String(authorization.input_index + 1)],
      ["Lock", `${details.type}, ${authorization.branch}`],
      ...(details.owner ? [["Owner address", address(details.owner)] as [string, ReactNode]] : []),
      ...(details.claimOwner ? [["Claim owner", address(details.claimOwner)] as [string, ReactNode]] : []),
      ...(details.refundOwner ? [["Refund owner", address(details.refundOwner)] as [string, ReactNode]] : []),
      ...(details.hash ? [["SHA-256 hash", h("span", { className: "mono" }, details.hash)] as [string, ReactNode]] : []),
      ...(details.unlockHeight ? [["Unlock from finalized cut height", details.unlockHeight] as [string, ReactNode]] : []),
      ...(details.refundHeight ? [["Claim before finalized cut height", details.refundHeight] as [string, ReactNode], ["Refund from finalized cut height", details.refundHeight] as [string, ReactNode]] : []),
      ["Descriptor", h("span", { className: "mono" }, authorization.descriptor_hex)],
      ...(authorization.preimage_hex ? [["Revealed preimage", h("span", { className: "mono" }, authorization.preimage_hex)] as [string, ReactNode]] : []),
    ];
    return h("dl", { className: "kv" }, rows.map(([label, value]) => h("div", { key: label, className: "kv__item kv__item--wide", "data-fact": label }, h("dt", {}, label), h("dd", {}, value))));
  } catch {
    return h("p", { className: "notice error", role: "status" }, "Native lock conditions are unavailable: the node metadata is inconsistent or unsupported.");
  }
}

import type { AtomAmount, TransactionLifecycle, TransactionStatus } from "@tenrai/sdk";
import { useState } from "react";
import { ago, shortAddress, shortId, trai } from "../format.ts";
import { Link } from "../router.tsx";
import { Icon } from "./icons.tsx";

export function Hash({ id, to }: { id: string; to?: string }) {
  if (to === undefined) {
    return (
      <span className="mono" title={id}>
        {shortId(id)}
      </span>
    );
  }
  return (
    <Link className="link mono" to={to} title={id}>
      {shortId(id)}
    </Link>
  );
}

export function FullId({ id }: { id: string }) {
  return (
    <span className="copyable">
      <span className="mono">{id}</span>
      <Copy text={id} />
    </span>
  );
}

export function AddressLink({ address, full = false }: { address: string; full?: boolean }) {
  return (
    <Link className="link mono" to={`/address/${address}`} title={address}>
      {full ? address : shortAddress(address)}
    </Link>
  );
}

export function CutLink({ height }: { height: number }) {
  return (
    <Link className="link" to={`/cuts/${height}`}>
      {height.toLocaleString("en-US")}
    </Link>
  );
}

export function Amount({ atoms }: { atoms: AtomAmount | bigint | null }) {
  return atoms === null ? <span>–</span> : <span className="amount">{trai(atoms)}</span>;
}

export function Ago({ millis }: { millis: number | null }) {
  if (millis === null) {
    return <span>–</span>;
  }
  const at = new Date(millis);
  return (
    <time dateTime={at.toISOString()} title={at.toLocaleString()}>
      {ago(millis)}
    </time>
  );
}

const STAGES = ["processing", "receiving", "registered", "finalized"] as const;
const LIFECYCLE: Record<TransactionLifecycle, string> = {
  processing: "In mempool",
  receiving: "Mined",
  registered: "Registered",
  finalized: "Finalized",
  failed: "Failed",
};

export function Badge({ tone, children }: { tone?: "good" | "bad" | "wait" | "later"; children: string }) {
  return <span className={tone ? `badge ${tone}` : "badge"}>{children}</span>;
}

export function Lifecycle({ status }: { status: Pick<TransactionStatus, "lifecycle" | "failure"> }) {
  if (status.lifecycle === "failed") {
    return <Badge tone="bad">{status.failure ? `Failed: ${status.failure.replace("_", " ")}` : "Failed"}</Badge>;
  }
  return <Badge tone={status.lifecycle === "finalized" ? "good" : "wait"}>{LIFECYCLE[status.lifecycle]}</Badge>;
}

export const PRIVATE_KINDS: Record<string, string> = {
  transfer: "Private transfer",
  enter: "Into private (ENTER)",
  exit: "Out of private (EXIT)",
};

export const PRIVATE_PATH = "Directly in a cut: no miner and no block take part";

/** Private transactions move from the pool directly to a finalized cut. */
export function PrivateStages({ final }: { final: boolean }) {
  return (
    <span className="stages">
      <Badge tone={final ? "good" : "wait"}>In private pool</Badge>
      <Badge tone={final ? "good" : "later"}>{LIFECYCLE.finalized}</Badge>
    </span>
  );
}

export function Stages({ status }: { status: Pick<TransactionStatus, "lifecycle" | "failure"> }) {
  if (status.lifecycle === "failed") {
    return <Lifecycle status={status} />;
  }
  const reached = STAGES.indexOf(status.lifecycle);
  return (
    <span className="stages">
      {STAGES.map((stage, index) => (
        <Badge key={stage} tone={index < reached || status.lifecycle === "finalized" ? "good" : index === reached ? "wait" : "later"}>
          {LIFECYCLE[stage]}
        </Badge>
      ))}
    </span>
  );
}

export function Copy({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  const [failed, setFailed] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      setFailed(true);
    }
  };
  const title = failed ? "Select the text to copy it" : copied ? "Copied" : "Copy to the clipboard";
  return (
    <button type="button" className={copied ? "copy done" : "copy"} onClick={copy} title={title} aria-label="Copy">
      <Icon name={copied ? "check" : "copy"} />
    </button>
  );
}

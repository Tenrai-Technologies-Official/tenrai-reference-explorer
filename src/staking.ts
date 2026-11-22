import type { StakePositionView, ValidatorView } from "@tenrai/sdk";
import { count } from "./format.ts";
import { useLive } from "./live.tsx";

const REFRESH_TICKS = 5;

export function useStakingRefresh(): number {
  return Math.floor(useLive().tick / REFRESH_TICKS);
}

export function commissionText(validator: ValidatorView): string {
  return `${(validator.commission_bps / 100).toFixed(1)}%`;
}

export function pendingCommissionText(validator: ValidatorView): string {
  const pending = validator.pending_commission;
  return pending === null
    ? "None"
    : `${(pending.bps / 100).toFixed(1)}% from epoch ${pending.activate_after_epoch}, cut ${pending.activate_after_height}`;
}

export function activityText(validator: ValidatorView): string {
  return validator.is_active ? "Active" : validator.inactive_reasons.join(", ");
}

export function heartbeatText(validator: ValidatorView): string {
  return `Epoch ${count(validator.last_heartbeat_epoch)}`;
}

export function attendanceText(validator: ValidatorView): string {
  return validator.last_attendance_epoch === null ? "Not recorded yet" : `Epoch ${count(validator.last_attendance_epoch)}`;
}

export function jailText(validator: ValidatorView): string {
  return validator.jailed_until_epoch === null ? "Not jailed" : `Eligible from epoch ${count(validator.jailed_until_epoch)}`;
}

export function pendingKeyRotationText(validator: ValidatorView): string {
  return validator.pending_key_activation_epoch === null ? "None" : `Activates in epoch ${count(validator.pending_key_activation_epoch)}`;
}

export function pendingEndpointText(validator: ValidatorView): string {
  const pending = validator.pending_endpoint;
  return pending === null ? "None" : `Activates in epoch ${count(pending.activate_after_epoch)}, cut ${count(pending.activate_after_height)}`;
}

export function positionStateText(position: StakePositionView): string {
  switch (position.state) {
    case "bonded":
      return "Bonded";
    case "exit_requested":
      return "Exit requested";
    case "unbonding":
      return "Unbonding";
    case "withdrawable":
      return "Withdrawable";
  }
}

import { formatTrai, type AtomAmount, type UtxoSource } from "@tenrai/sdk";

const whole = new Intl.NumberFormat("en-US");
const decimal = new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 });
const RATE_UNITS = ["H/s", "kH/s", "MH/s", "GH/s", "TH/s", "PH/s", "EH/s"];
const SOURCES: Record<UtxoSource, string> = {
  regular: "Transfer",
  genesis: "Genesis",
  work_reward: "Mining reward",
  stake_reward: "Staking reward",
  private_exit: "Private exit",
};

export function sum(amounts: AtomAmount[]): bigint {
  return amounts.reduce((total, amount) => total + BigInt(amount), 0n);
}

/** Total miner and stake rewards, when both are available. */
export function cutRewards(miners: AtomAmount | bigint | null, stakers: AtomAmount | null): bigint | null {
  return miners === null || stakers === null ? null : BigInt(miners) + BigInt(stakers);
}

export function count(value: number): string {
  return whole.format(value);
}

export function number(value: number): string {
  return decimal.format(value);
}

export function trai(atoms: AtomAmount | bigint): string {
  const [integer = "0", fraction] = formatTrai(atoms, { fixed: true }).split(".");
  return `${BigInt(integer).toLocaleString("en-US")}.${fraction} TRAI`;
}

export function atoms(value: AtomAmount): string {
  return plural(BigInt(value), "atom");
}

export function plural(value: number | bigint, word: string): string {
  return `${value.toLocaleString("en-US")} ${word}${value === 1 || value === 1n ? "" : "s"}`;
}

export function shortId(id: string): string {
  return `${id.slice(0, 10)}…${id.slice(-6)}`;
}

export function shortAddress(address: string): string {
  return address.length > 24 ? `${address.slice(0, 14)}…${address.slice(-6)}` : address;
}

export function source(value: UtxoSource): string {
  return SOURCES[value];
}

export function hashRate(perSecond: number): string {
  let value = perSecond;
  let unit = 0;
  while (value >= 1000 && unit < RATE_UNITS.length - 1) {
    value /= 1000;
    unit += 1;
  }
  return `${number(value)} ${RATE_UNITS[unit]}`;
}

export function bytes(value: number): string {
  if (value < 1024) {
    return `${count(value)} B`;
  }
  return value < 1024 * 1024 ? `${number(value / 1024)} KiB` : `${number(value / 1024 / 1024)} MiB`;
}

export function percent(part: number, total: number): string {
  return total > 0 ? `${number((part / total) * 100)} %` : "0 %";
}

export function duration(millis: number): string {
  if (millis < 10_000) {
    return `${number(Math.round(millis / 100) / 10)} s`;
  }
  const minutes = Math.round(millis / 60_000);
  if (minutes < 1) {
    return `${Math.round(millis / 1000)} s`;
  }
  if (minutes < 120) {
    return `${minutes} min`;
  }
  const hours = Math.round(minutes / 60);
  return hours < 48 ? `${hours} h` : `${Math.round(hours / 24)} days`;
}

export function ago(millis: number, now = Date.now()): string {
  const seconds = Math.round((now - millis) / 1000);
  if (seconds < 5) {
    return "just now";
  }
  return seconds < 60 ? `${seconds} s ago` : `${duration(now - millis)} ago`;
}

import type {
  PrivateCutItems,
  AddressBalance,
  AddressHistoryPage,
  AtomAmount,
  BlockSummary,
  BlockView,
  ChainRates,
  CoinSupply,
  CutSummary,
  CutTransactions,
  CutView,
  EpochInfo,
  FeeEstimate,
  MempoolEntries,
  MempoolInfo,
  Network,
  NodeInfo,
  TransactionLifecycle,
  TransactionSummary,
  TransactionView,
  CompactTransactionView,
  ValidatorDetail,
  ValidatorPositionList,
  ValidatorSlashStatus,
} from "@tenrai/sdk";

export const PAGE_ROWS = 50;
export const OVERVIEW_ROWS = 10;
/** Retain a three-second window at 100 blocks per second for live tables. */
export const LIVE_BLOCKS = 300;

/** `GET /api/status` */
export interface Status {
  network: Network;
  height: number;
  nodeVersion: string;
  /** Null when upstream sync status is unavailable. */
  sync: { synced: boolean; behindBy: number; peers: number } | null;
}

/** `GET /api/overview` */
export interface Overview {
  node: NodeInfo;
  rates: ChainRates;
  mempool: MempoolInfo;
  epoch: EpochInfo;
  supply: CoinSupply;
  cuts: CutSummary[];
  /** Live block buffer. The overview displays the first `OVERVIEW_ROWS`. */
  blocks: BlockSummary[];
  transactions: TransactionSummary[];
}

/** `GET /api/blocks?page=` */
export interface RecentBlocks {
  /** The first page includes extra rows for live updates. */
  blocks: BlockSummary[];
  page: number;
  older: boolean;
}

/** `GET /api/transactions?page=` */
export interface RecentTransactions {
  transactions: TransactionSummary[];
  page: number;
  older: boolean;
}

/** `GET /api/cuts/:height`, with the first page of its transactions. */
export interface CutPage {
  cut: CutView;
  transactions: CutTransactions;
  /** Reward recipients keyed by `transaction_id:output_index`. */
  paidTo: Record<string, string>;
  /** Null when private items are unavailable. */
  privateItems: PrivateCutItems | null;
  /** Cut that pays the stake reward accrued here. */
  payoutFrom: number | null;
}

/** `GET /api/blocks/:id`, with the cut that paid its reward once it is paid. */
export interface BlockPage {
  block: BlockView;
  /** Null until paid. A string explains an unavailable payout cut. */
  paidIn: PaidIn | string | null;
}

export interface PaidIn {
  height: number;
  amount: AtomAmount;
  stakeRewards: AtomAmount | null;
}

/** Full transaction or compact record, depending on upstream retention. */
export type TransactionHistoryRecord = (
  | (TransactionView & { retention: "full" })
  | (CompactTransactionView & { retention: "compact" })
);

export type TransactionPage = TransactionHistoryRecord & {
  /** Render messenger frames by name and hide their raw payload. */
  messenger: boolean;
  payload_text: string | null;
  recipient_payloads: { output: number; payload_hex: string; text: string | null }[] | null;
};

/** `GET /api/mempool` */
export interface MempoolPage {
  info: MempoolInfo;
  fees: FeeEstimate;
  pool: MempoolEntries;
}

/** `GET /api/validators/:id`, with the first page of current positions. */
export interface ValidatorPage {
  detail: ValidatorDetail;
  positions: ValidatorPositionList;
  slash: ValidatorSlashStatus;
}

/** `GET /api/address/:address`, with unconfirmed payments on the first page. */
export interface AddressPage {
  balance: AddressBalance;
  history: AddressHistoryPage;
  unconfirmed: UnconfirmedPayment[];
  /** Bonded and exiting principal when available on the first page. */
  staked: AtomAmount | null;
}

export interface UnconfirmedPayment {
  transaction_id: string;
  amount: AtomAmount;
  lifecycle: TransactionLifecycle;
}

/** `GET /api/search?q=` */
export interface SearchResult {
  path: string;
}

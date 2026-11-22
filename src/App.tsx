import type { ReactNode } from "react";
import { Footer, Header } from "./components/layout.tsx";
import { Address } from "./pages/Address.tsx";
import { Block } from "./pages/Block.tsx";
import { Blocks } from "./pages/Blocks.tsx";
import { Cut } from "./pages/Cut.tsx";
import { Cuts } from "./pages/Cuts.tsx";
import { Mempool } from "./pages/Mempool.tsx";
import { NotFound } from "./pages/NotFound.tsx";
import { Overview } from "./pages/Overview.tsx";
import { Transaction } from "./pages/Transaction.tsx";
import { PrivateStatement } from "./pages/PrivateStatement.tsx";
import { Transactions } from "./pages/Transactions.tsx";
import { Validator } from "./pages/Validator.tsx";
import { Validators } from "./pages/Validators.tsx";
import { usePlace } from "./router.tsx";

// Remount the page when its entity ID changes.
const ROUTES: [RegExp, (param: string) => ReactNode][] = [
  [/^\/$/, () => <Overview />],
  [/^\/cuts$/, () => <Cuts />],
  [/^\/cuts\/(\d{1,15})$/, (height) => <Cut key={height} height={Number(height)} />],
  [/^\/blocks$/, () => <Blocks />],
  [/^\/blocks\/([0-9a-f]{96})$/, (id) => <Block key={id} id={id} />],
  [/^\/transactions$/, () => <Transactions />],
  [/^\/transactions\/([0-9a-f]{96})$/, (id) => <Transaction key={id} id={id} />],
  [/^\/private\/([0-9a-f]{96})$/, (digest) => <PrivateStatement key={digest} digest={digest} />],
  [/^\/mempool$/, () => <Mempool />],
  [/^\/validators$/, () => <Validators />],
  [/^\/validators\/([0-9a-f]{96})$/, (id) => <Validator key={id} id={id} />],
  [/^\/address\/([a-z0-9]{8,128})$/, (address) => <Address key={address} address={address} />],
];

export function App() {
  const { path } = usePlace();
  return (
    <>
      <Header />
      <main className="layout wrap">{page(path)}</main>
      <Footer />
    </>
  );
}

function page(path: string): ReactNode {
  for (const [pattern, render] of ROUTES) {
    const match = pattern.exec(path);
    if (match) {
      return render(match[1] ?? "");
    }
  }
  return <NotFound />;
}

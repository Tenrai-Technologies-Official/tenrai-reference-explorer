import { Title } from "../components/page.tsx";
import { Link } from "../router.tsx";

export function NotFound() {
  return (
    <>
      <Title eyebrow="404" title="No such page" />
      <p className="notice">
        This page does not exist. <Link className="link" to="/">Back to the overview</Link>
      </p>
    </>
  );
}

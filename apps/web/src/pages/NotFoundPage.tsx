import { Link } from "react-router";
export function NotFoundPage() {
  return <section><h1 className="text-4xl font-semibold">Page not found</h1><Link className="mt-5 inline-block underline" to="/">Return home</Link></section>;
}

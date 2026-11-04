import { useEffect, useState } from "react";

import { SiteLayout } from "../layouts/SiteLayout";
import { PageSeo } from "./PageSeo";

export function SiteRoot() {
  const [mainHref, setMainHref] = useState<string | null>(null);

  useEffect(() => {
    // Reuse the existing semantic <main> element
    // from SiteLayout rather than inserting
    // another, nested main landmark.
    const main = document.querySelector("main");

    if (!main) {
      return;
    }

    if (!main.id) {
      main.id = "main-content";
    }

    setMainHref(`#${main.id}`);
  }, []);

  return (
    <>
      <PageSeo />

      {mainHref && (
        <a href={mainHref} className="forma-skip-link">
          Skip to main content
        </a>
      )}

      <SiteLayout />
    </>
  );
}

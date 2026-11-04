import { useEffect } from "react";
import { useLocation } from "react-router";

import { getPageSeo } from "../lib/seo";

function updateMeta(
  attribute: "name" | "property",
  key: string,
  content: string,
) {
  const selector = `meta[${attribute}="${key}"]`;

  let element = document.head.querySelector<HTMLMetaElement>(selector);

  if (!element) {
    element = document.createElement("meta");
    element.setAttribute(attribute, key);
    document.head.appendChild(element);
  }

  element.setAttribute("content", content);
}

export function PageSeo() {
  const location = useLocation();

  useEffect(() => {
    const seo = getPageSeo(location.pathname);

    document.title = seo.title;

    updateMeta("name", "description", seo.description);

    updateMeta(
      "name",
      "robots",
      seo.indexable ? "index, follow" : "noindex, nofollow",
    );

    updateMeta("property", "og:title", seo.title);

    updateMeta("property", "og:description", seo.description);

    updateMeta("property", "og:type", "website");

    updateMeta("name", "twitter:card", "summary");

    const existingCanonical = document.head.querySelector<HTMLLinkElement>(
      'link[rel="canonical"]',
    );

    const existingOpenGraphUrl = document.head.querySelector<HTMLMetaElement>(
      'meta[property="og:url"]',
    );

    if (seo.indexable && seo.canonicalPath) {
      const canonicalUrl = new URL(
        seo.canonicalPath,
        window.location.origin,
      ).toString();

      const canonical = existingCanonical ?? document.createElement("link");

      canonical.rel = "canonical";
      canonical.href = canonicalUrl;

      if (!existingCanonical) {
        document.head.appendChild(canonical);
      }

      updateMeta("property", "og:url", canonicalUrl);
    } else {
      existingCanonical?.remove();
      existingOpenGraphUrl?.remove();
    }
  }, [location.pathname]);

  return null;
}

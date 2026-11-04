import { useEffect, type RefObject } from "react";

export function useHomeAnimations(rootRef: RefObject<HTMLElement | null>) {
  useEffect(() => {
    let cancelled = false;
    let cleanupAnimations: (() => void) | undefined;

    async function initializeAnimations() {
      const [{ gsap }, { ScrollTrigger }] = await Promise.all([
        import("gsap"),
        import("gsap/ScrollTrigger"),
      ]);

      const root = rootRef.current;

      if (cancelled || !root) return;

      gsap.registerPlugin(ScrollTrigger);

      const media = gsap.matchMedia();

      const context = gsap.context(() => {
        // Animations only run when the operating system
        // does not request reduced motion.
        media.add("(prefers-reduced-motion: no-preference)", () => {
          const heroElements =
            root.querySelectorAll<HTMLElement>("[data-hero-reveal]");

          gsap.from(heroElements, {
            y: 28,
            autoAlpha: 0,
            duration: 0.75,
            stagger: 0.14,
            ease: "power2.out",
            clearProps: "all",
          });

          const sections = root.querySelectorAll<HTMLElement>(
            "[data-scroll-reveal]",
          );

          sections.forEach((section) => {
            gsap.from(section, {
              y: 30,
              autoAlpha: 0,
              duration: 0.8,
              ease: "power2.out",
              clearProps: "all",

              scrollTrigger: {
                trigger: section,
                start: "top 88%",
                once: true,
              },
            });
          });
        });
      }, root);

      cleanupAnimations = () => {
        media.revert();
        context.revert();
      };
    }

    void initializeAnimations().catch(() => {
      // Animations are progressive enhancement.
      // The page must remain usable if they fail.
    });

    return () => {
      cancelled = true;
      cleanupAnimations?.();
    };
  }, [rootRef]);
}

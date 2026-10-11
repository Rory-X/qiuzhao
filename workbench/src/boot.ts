type Timeline = {
  to(target: string | Element, vars: Record<string, unknown>, position?: string): Timeline;
  add(callback: () => void): Timeline;
};

type Gsap = {
  timeline(options: { onComplete: () => void }): Timeline;
};

let revealScheduled = false;

export function revealApp() {
  if (revealScheduled) return;
  revealScheduled = true;

  const html = document.documentElement;
  const root = document.getElementById("root");
  const screen = document.getElementById("boot-screen");
  const showContent = () => {
    root?.removeAttribute("inert");
    root?.removeAttribute("aria-hidden");
    html.classList.add("app-ready");
  };

  if (!screen || window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    showContent();
    screen?.remove();
    return;
  }

  // Let the opening sequence finish, then pause briefly even when data was slow.
  const delay = Math.max(250, 1000 - performance.now());
  window.setTimeout(() => {
    const status = screen.querySelector<HTMLElement>(html.dataset.bootView === "portfolio" ? ".boot-description .boot-portfolio" : ".boot-description .boot-workbench");
    if (status) status.textContent = "准备就绪，即将进入";

    const cleanup = () => {
      showContent();
      screen.remove();
    };
    // A stalled animation must never leave the app covered.
    window.setTimeout(() => {
      if (screen.isConnected) cleanup();
    }, 2200);
    const gsap = (window as Window & { gsap?: Gsap }).gsap;

    if (gsap?.timeline) {
      try {
        html.classList.add("gsap-exit");
        gsap.timeline({ onComplete: cleanup })
          .to(".boot-progress-complete", { scaleX: 1, duration: 0.32, ease: "power2.out" })
          .to(".boot-center", { y: -20, opacity: 0, duration: 0.32, ease: "power2.inOut" }, "-=0.04")
          .to(".boot-top, .boot-bottom", { opacity: 0, duration: 0.25 }, "<")
          .add(showContent)
          .to(screen, { yPercent: -100, duration: 0.78, ease: "power3.inOut" });
        return;
      } catch {
        html.classList.remove("gsap-exit");
      }
    }

    // The CDN is optional: keep the same staged reveal if it is unavailable.
    html.classList.add("app-exiting");
    window.setTimeout(() => {
      showContent();
      html.classList.add("app-revealing");
      window.setTimeout(cleanup, 850);
    }, 420);
  }, delay);
}

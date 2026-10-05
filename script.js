const root = document.documentElement;
const themeButton = document.querySelector(".theme-toggle");
const themeIcon = document.querySelector(".theme-icon");
const readMoreButton = document.querySelector(".read-more");
const aboutExtra = document.querySelector("#about-extra");
const announcement = document.querySelector(".announcement");

const sunIcon = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="12" r="3.7"></circle><path d="M12 2v2.2M12 19.8V22M4.93 4.93l1.56 1.56m11.02 11.02 1.56 1.56M2 12h2.2m15.6 0H22M4.93 19.07l1.56-1.56M17.51 6.49l1.56-1.56"></path></svg>';
const moonIcon = '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M20.2 15.2A8.5 8.5 0 0 1 8.8 3.8a8.7 8.7 0 1 0 11.4 11.4Z"></path></svg>';

function setTheme(theme) {
  root.dataset.theme = theme;
  const nextTheme = theme === "dark" ? "light" : "dark";
  themeButton.setAttribute("aria-label", "Switch to " + nextTheme + " mode");
  themeIcon.innerHTML = theme === "dark" ? sunIcon : moonIcon;

  try {
    localStorage.setItem("kupidura-theme", theme);
  } catch (error) {}
}

function switchTheme(theme) {
  const canReveal = typeof document.startViewTransition === "function";
  const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  if (!canReveal || prefersReducedMotion) {
    setTheme(theme);
    return;
  }

  const buttonRect = themeButton.getBoundingClientRect();
  const x = buttonRect.left + buttonRect.width / 2;
  const y = buttonRect.top + buttonRect.height / 2;
  const corners = [
    [0, 0],
    [window.innerWidth, 0],
    [0, window.innerHeight],
    [window.innerWidth, window.innerHeight]
  ];
  const radius = Math.ceil(Math.max(...corners.map(function (corner) {
    return Math.hypot(corner[0] - x, corner[1] - y);
  })));

  root.style.setProperty("--theme-reveal-x", x + "px");
  root.style.setProperty("--theme-reveal-y", y + "px");
  root.style.setProperty("--theme-reveal-radius", radius + "px");
  root.classList.add("theme-changing");

  let transition;
  try {
    transition = document.startViewTransition(function () {
      setTheme(theme);
    });
  } catch (error) {
    root.classList.remove("theme-changing");
    setTheme(theme);
    return;
  }

  function finishTransition() {
    root.classList.remove("theme-changing");
  }

  transition.finished.then(finishTransition, finishTransition);
}

setTheme(root.dataset.theme === "light" ? "light" : "dark");

themeButton.addEventListener("click", function () {
  switchTheme(root.dataset.theme === "dark" ? "light" : "dark");
});

readMoreButton.addEventListener("click", function () {
  const expanded = readMoreButton.getAttribute("aria-expanded") === "true";
  readMoreButton.setAttribute("aria-expanded", String(!expanded));
  aboutExtra.hidden = expanded;
  readMoreButton.textContent = expanded ? "READ MORE" : "READ LESS";
});

let announcementTimer;
document.querySelectorAll("[data-coming-soon]").forEach(function (link) {
  link.addEventListener("click", function (event) {
    event.preventDefault();
    announcement.textContent = link.dataset.comingSoon + " — this section will be added next.";
    announcement.hidden = false;
    window.clearTimeout(announcementTimer);
    announcementTimer = window.setTimeout(function () {
      announcement.hidden = true;
    }, 2600);
  });
});

const revealItems = document.querySelectorAll("[data-reveal]");
if ("IntersectionObserver" in window) {
  const revealObserver = new IntersectionObserver(function (entries, observer) {
    entries.forEach(function (entry) {
      if (entry.isIntersecting) {
        entry.target.classList.add("is-visible");
        observer.unobserve(entry.target);
      }
    });
  }, { threshold: 0.16 });

  revealItems.forEach(function (item) {
    revealObserver.observe(item);
  });
} else {
  revealItems.forEach(function (item) {
    item.classList.add("is-visible");
  });
}

function setupScrollMotion() {
  const hero = document.querySelector(".hero");
  const textElements = document.querySelectorAll('[data-scroll-motion="text"]');
  const photo = document.querySelector('[data-scroll-motion="photo"]');
  const scrollTargets = [document.querySelector(".site-header"), document.querySelector("main")].filter(Boolean);
  const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

  if (!hero || !photo || !scrollTargets.length || prefersReducedMotion.matches) {
    return;
  }

  let targetScrollY = window.scrollY;
  let smoothScrollY = targetScrollY;
  let heroTop = hero.offsetTop;
  let heroHeight = hero.offsetHeight || window.innerHeight;
  let frameId = 0;
  let previousFrameTime = 0;
  let scrollVelocity = 0;

  function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
  }

  function renderMotion(timestamp) {
    frameId = 0;
    const elapsedSeconds = (previousFrameTime ? clamp(timestamp - previousFrameTime, 0, 50) : 16.7) / 1000;
    previousFrameTime = timestamp;

    // Critically damped motion keeps the page moving as one continuous surface:
    // no instant stop followed by a separate element animation.
    const omega = 18;
    const displacement = smoothScrollY - targetScrollY;
    const springStep = (scrollVelocity + omega * displacement) * elapsedSeconds;
    const decay = Math.exp(-omega * elapsedSeconds);
    const nextDisplacement = (displacement + springStep) * decay;
    scrollVelocity = (scrollVelocity - omega * springStep) * decay;
    smoothScrollY = targetScrollY + nextDisplacement;

    const scrollOffset = targetScrollY - smoothScrollY;
    scrollTargets.forEach(function (element) {
      element.style.setProperty("--page-scroll-offset", scrollOffset.toFixed(2) + "px");
    });

    textElements.forEach(function (element) {
      const section = element.closest(".hero, .about");
      if (!section) return;
      const sectionTop = section.offsetTop;
      const sectionHeight = section.offsetHeight || window.innerHeight;
      const motionStart = Math.max(0, sectionTop - window.innerHeight * 0.5);
      const textTravel = clamp(smoothScrollY - motionStart, 0, sectionHeight);
      // Give the typography a clearly faster, but still continuous, glide.
      element.style.setProperty("--scroll-motion-y", (-textTravel * 0.55).toFixed(2) + "px");
    });

    // Counter-move the portrait by part of the page's travel. Its frame therefore
    // crosses the viewport more slowly than the text and stays visible longer.
    const parallaxLimit = Math.min(heroHeight * 0.42, window.innerHeight * 0.44);
    const parallax = clamp((smoothScrollY - heroTop) * 0.42, 0, parallaxLimit);
    photo.style.setProperty("--scroll-motion-y", parallax.toFixed(2) + "px");

    const stillMoving = Math.abs(targetScrollY - smoothScrollY) > 0.08 || Math.abs(scrollVelocity) > 0.08;

    if (stillMoving) {
      frameId = window.requestAnimationFrame(renderMotion);
    } else {
      smoothScrollY = targetScrollY;
      scrollVelocity = 0;
      scrollTargets.forEach(function (element) {
        element.style.setProperty("--page-scroll-offset", "0px");
      });
      previousFrameTime = 0;
    }
  }

  function scheduleMotion() {
    targetScrollY = window.scrollY;
    if (!frameId) {
      frameId = window.requestAnimationFrame(renderMotion);
    }
  }

  function updateHeroSize() {
    heroTop = hero.offsetTop;
    heroHeight = hero.offsetHeight || window.innerHeight;
    scheduleMotion();
  }

  window.addEventListener("scroll", scheduleMotion, { passive: true });
  window.addEventListener("resize", updateHeroSize, { passive: true });

  if ("ResizeObserver" in window) {
    const heroObserver = new ResizeObserver(updateHeroSize);
    heroObserver.observe(hero);
  }

  scheduleMotion();
}

setupScrollMotion();

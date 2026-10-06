// Zdjecie hero zaczyna animacje dopiero, gdy jest wczytane i zdekodowane,
// zeby nie "dojezdzalo" jako pusta szara ramka.
(function revealHeroPhoto() {
  const figure = document.querySelector(".hero-photo");
  if (!figure) return;
  const image = figure.querySelector("img");
  let done = false;

  function reveal() {
    if (done) return;
    done = true;
    figure.classList.add("is-ready");
  }

  window.setTimeout(reveal, 3000); // zabezpieczenie przy bardzo wolnym lacu

  if (!image) {
    reveal();
  } else if (typeof image.decode === "function") {
    image.decode().then(reveal, reveal);
  } else if (image.complete) {
    reveal();
  } else {
    image.addEventListener("load", reveal, { once: true });
    image.addEventListener("error", reveal, { once: true });
  }
})();

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
  const textElements = Array.from(document.querySelectorAll('[data-scroll-motion="text"]'));
  const photo = document.querySelector('[data-scroll-motion="photo"]');
  const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

  if (!hero || !photo || !textElements.length || prefersReducedMotion.matches) {
    return;
  }

  // --- Ustawienia do dostrojenia -------------------------------------------
  const followTime = 0.16;       // sekundy; wieksza wartosc = bardziej "bezwladne" przewijanie
  const wheelSpeed = 0.55;       // mnoznik kroku kolka myszy (1 = tak jak w przegladarce)
  const maxWheelStep = 90;       // maksymalny krok na jedno zdarzenie kolka, w px
  const textTravelRate = 0.55;   // dodatkowy ruch tekstu wzgledem przewijania
  const photoCounterMotion = 0.30; // o tyle zdjecie jedzie wolniej (paralaksa)
  // -------------------------------------------------------------------------

  let current = window.scrollY;  // pozycja faktycznie ustawiana na stronie
  let target = current;          // pozycja, do ktorej dazymy
  let frameId = 0;
  let previousTime = 0;
  let renderQueued = false;
  let heroTop = 0;
  let textMetrics = [];

  function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
  }

  function maxScroll() {
    return Math.max(0, root.scrollHeight - root.clientHeight);
  }

  function measure() {
    heroTop = hero.offsetTop;
    textMetrics = textElements.map(function (element) {
      const section = element.closest(".hero, .about");
      if (!section) return null;
      return {
        element: element,
        start: Math.max(0, section.offsetTop - window.innerHeight * 0.5),
        height: section.offsetHeight || window.innerHeight
      };
    }).filter(Boolean);
  }

  // Paralaksa jest czysta funkcja pozycji przewijania. Nie ma tu zadnego
  // "doganiania" ani kompensacji, wiec nie ma czego cofac.
  function renderMotion(y) {
    textMetrics.forEach(function (item) {
      const travel = clamp(y - item.start, 0, item.height);
      item.element.style.setProperty("--scroll-motion-y", (-travel * textTravelRate).toFixed(2) + "px");
    });
    const parallax = Math.max(0, y - heroTop) * photoCounterMotion;
    photo.style.setProperty("--scroll-motion-y", parallax.toFixed(2) + "px");
  }

  function requestRender() {
    if (renderQueued || frameId) return;
    renderQueued = true;
    window.requestAnimationFrame(function () {
      renderQueued = false;
      renderMotion(window.scrollY);
    });
  }

  // Jedna petla: wygladza pozycje przewijania, ustawia ja na stronie
  // i w tej samej klatce przelicza paralaksę z faktycznej pozycji.
  function tick(timestamp) {
    const elapsed = previousTime ? clamp((timestamp - previousTime) / 1000, 0, 0.05) : 1 / 60;
    previousTime = timestamp;

    current += (target - current) * (1 - Math.exp(-elapsed / followTime));
    if (Math.abs(target - current) < 0.2) current = target;

    window.scrollTo(0, current);
    renderMotion(window.scrollY);

    if (current !== target) {
      frameId = window.requestAnimationFrame(tick);
    } else {
      frameId = 0;
      previousTime = 0;
    }
  }

  function startLoop() {
    if (!frameId) {
      previousTime = 0;
      frameId = window.requestAnimationFrame(tick);
    }
  }

  function scrollToPosition(y) {
    if (!frameId) current = window.scrollY;
    target = clamp(y, 0, maxScroll());
    startLoop();
  }

  window.addEventListener("wheel", function (event) {
    if (event.ctrlKey || event.defaultPrevented) return;          // zoom gestem / Ctrl+kolko
    if (Math.abs(event.deltaX) > Math.abs(event.deltaY)) return;  // przewijanie poziome
    let delta = event.deltaY;
    if (event.deltaMode === 1) delta *= 16;
    else if (event.deltaMode === 2) delta *= window.innerHeight;
    delta = clamp(delta * wheelSpeed, -maxWheelStep, maxWheelStep);
    event.preventDefault();
    if (!frameId) current = target = window.scrollY;
    scrollToPosition(target + delta);
  }, { passive: false });

  // Przewijanie spoza naszej petli (dotyk, klawiatura, pasek przewijania):
  // przejmujemy pozycje przegladarki, zeby niczego nie "dociagac" w tle.
  window.addEventListener("scroll", function () {
    const y = window.scrollY;
    if (frameId && Math.abs(y - current) <= 2) return;
    current = target = y;
    requestRender();
  }, { passive: true });

  window.addEventListener("touchstart", function () {
    target = current;
  }, { passive: true });

  // Dokad przewinac po kliknieciu linku kotwicowego. HOME to sam gora strony,
  // a tekst sekcji z paralaksa ustawiamy tak, by byl widoczny, nie "uciekl" w gore.
  function anchorPosition(destination) {
    if (destination === hero) return 0;
    const margin = parseFloat(window.getComputedStyle(destination).scrollMarginTop) || 0;
    const natural = destination.getBoundingClientRect().top + window.scrollY - margin;
    const item = textMetrics.find(function (metric) {
      return destination.contains(metric.element);
    });
    return item ? Math.min(natural, item.start + window.innerHeight * 0.1) : natural;
  }

  // Linki kotwicowe (np. HOME, ABOUT) przewijaja plynnie.
  document.addEventListener("click", function (event) {
    const link = event.target.closest('a[href^="#"]');
    if (!link || link.classList.contains("skip-link") || link.hash.length < 2) return;
    const destination = document.getElementById(decodeURIComponent(link.hash.slice(1)));
    if (!destination) return;
    event.preventDefault();
    scrollToPosition(anchorPosition(destination));
    try {
      history.replaceState(null, "", link.hash);
    } catch (error) {}
  });

  function handleResize() {
    measure();
    target = clamp(target, 0, maxScroll());
    requestRender();
  }

  window.addEventListener("resize", handleResize, { passive: true });

  if ("ResizeObserver" in window) {
    new ResizeObserver(handleResize).observe(document.body);
  }

  measure();
  renderMotion(window.scrollY);
}

setupScrollMotion();

// ---------------------------------------------------------------------------
// MUSIC: kafelki z utworami, gramofon, jeden utwor naraz
// ---------------------------------------------------------------------------
function setupMusicPlayer() {
  const trackElements = Array.from(document.querySelectorAll(".track[data-audio]"));
  if (!trackElements.length) return;

  const vinylMarkup =
    '<svg viewBox="0 0 64 64" focusable="false">' +
      '<g class="vinyl-disc">' +
        '<circle cx="28" cy="36" r="26" fill="#0b0b0b" stroke="#3b3b3b" stroke-width="0.8"/>' +
        '<circle cx="28" cy="36" r="22" fill="none" stroke="#fff" stroke-opacity="0.1" stroke-width="0.6"/>' +
        '<circle cx="28" cy="36" r="18" fill="none" stroke="#fff" stroke-opacity="0.1" stroke-width="0.6"/>' +
        '<circle cx="28" cy="36" r="14" fill="none" stroke="#fff" stroke-opacity="0.1" stroke-width="0.6"/>' +
        '<path d="M28 10A26 26 0 0 1 46.4 17.6L28 36Z" fill="#fff" fill-opacity="0.08"/>' +
        '<path d="M28 62A26 26 0 0 1 9.6 54.4L28 36Z" fill="#fff" fill-opacity="0.08"/>' +
        '<circle cx="28" cy="36" r="8.5" fill="#ececec"/>' +
        '<circle cx="28" cy="30" r="1.7" fill="#0b0b0b"/>' +
        '<circle cx="28" cy="36" r="1.5" fill="#0b0b0b"/>' +
      '</g>' +
      '<g class="vinyl-arm">' +
        '<path d="M58 6V44l-3.5 6" fill="none" stroke="#0b0b0b" stroke-width="4.6" stroke-linecap="round" stroke-linejoin="round"/>' +
        '<path d="M58 6V44l-3.5 6" fill="none" stroke="#f2f2f2" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/>' +
        '<circle cx="58" cy="12" r="4.4" fill="#0b0b0b"/>' +
        '<circle cx="58" cy="12" r="2.1" fill="#f2f2f2"/>' +
      '</g>' +
    '</svg>';

  const players = [];

  function pauseAllExcept(current) {
    players.forEach(function (player) {
      if (player !== current) player.pause();
    });
  }

  trackElements.forEach(function (track) {
    const button = track.querySelector(".track-main");
    const titleElement = track.querySelector(".track-title");
    const vinylSlot = track.querySelector(".vinyl");
    if (!button || !titleElement) return;

    const title = titleElement.textContent.trim();
    let audio = null;

    if (vinylSlot) vinylSlot.innerHTML = vinylMarkup;

    function setPlaying(isPlaying) {
      track.classList.toggle("is-playing", isPlaying);
      button.setAttribute("aria-label", (isPlaying ? "Pause: " : "Play: ") + title);
    }

    // Audio tworzymy dopiero po pierwszym kliknieciu, zeby strona nie pobierala
    // wszystkich plikow MP3 przy wejsciu.
    function ensureAudio() {
      if (audio) return audio;
      audio = new Audio();
      audio.preload = "auto";
      audio.src = track.dataset.audio;
      audio.addEventListener("play", function () {
        pauseAllExcept(player);   // tez gdy start przyszedl z klawiszy multimedialnych
        setPlaying(true);
      });
      audio.addEventListener("pause", function () { setPlaying(false); });
      audio.addEventListener("ended", function () {
        audio.currentTime = 0;
        setPlaying(false);
      });
      audio.addEventListener("error", function () { setPlaying(false); });
      return audio;
    }

    const player = {
      pause: function () {
        if (audio && !audio.paused) audio.pause();
      }
    };
    players.push(player);

    button.addEventListener("click", function () {
      const element = ensureAudio();
      if (element.paused) {
        pauseAllExcept(player);
        const attempt = element.play();
        if (attempt && typeof attempt.catch === "function") {
          attempt.catch(function () { setPlaying(false); });
        }
      } else {
        element.pause();
      }
    });
  });

  // Linki do serwisow bez adresu (href="#") nie robia nic, dopoki nie wpiszesz URL.
  document.querySelectorAll('.stream-link[href="#"]').forEach(function (link) {
    link.addEventListener("click", function (event) {
      event.preventDefault();
    });
  });
}

setupMusicPlayer();

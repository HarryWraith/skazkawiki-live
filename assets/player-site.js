
function rel(href) {
  const base = "/skazkawiki-live";
  if (href.startsWith("/") && base) {
    return (base === "/" ? "" : base) + href;
  }
  const depth = Number(document.body.dataset.depth || 0);
  const prefix = depth === 0 ? "." : Array.from({ length: depth }, () => "..").join("/");
  return href.startsWith("/") ? prefix + href : href;
}

function esc(value) {
  return String(value || "").replace(/[&<>"']/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  }[character]));
}


function normalizeSearchText(value) {
  return String(value || "").normalize("NFKC").toLocaleLowerCase();
}

function focusableItems(container, selector) {
  return Array.from(container.querySelectorAll(selector)).filter(
    (item) => !item.hidden,
  );
}

function wireSearchKeyboard(input, container, selector, options = {}) {
  input.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      if (options.onEscape) {
        event.preventDefault();
        options.onEscape();
      }
      return;
    }

    if (event.key !== "ArrowDown") {
      return;
    }

    const first = focusableItems(container, selector)[0];
    if (first) {
      event.preventDefault();
      first.focus();
    }
  });

  container.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      if (options.onEscape) {
        event.preventDefault();
        options.onEscape();
      }
      return;
    }

    if (event.key !== "ArrowDown" && event.key !== "ArrowUp") {
      return;
    }

    const items = focusableItems(container, selector);
    const index = items.indexOf(document.activeElement);
    if (index < 0) {
      return;
    }

    event.preventDefault();
    if (event.key === "ArrowUp" && index === 0) {
      input.focus();
      return;
    }

    const nextIndex =
      event.key === "ArrowDown"
        ? Math.min(items.length - 1, index + 1)
        : Math.max(0, index - 1);
    items[nextIndex].focus();
  });
}


function initGlobalSearch(input) {
  if (input.dataset.staticSearchInitialized === "true") {
    return;
  }
  input.dataset.staticSearchInitialized = "true";

  const results = document.querySelector("[data-search-results]");
  if (!results) {
    return;
  }

  fetch(input.dataset.searchIndexHref || rel("/data/search-index.json"))
    .then((response) => response.json())
    .then((docs) => {
      function linkFor(href) {
        return rel(href);
      }

      function resultHtml(document) {
        const facts = (document.facts || [])
          .slice(0, 3)
          .map((fact) => "<span><b>" + esc(fact.label) + "</b> " + esc(fact.value) + "</span>")
          .join("");
        return (
          '<a class="search-result theme-' +
          esc(document.visualIdentityKey || document.sectionKey || "world") +
          '" href="' +
          linkFor(document.href) +
          '">' +
          (document.iconSvg || "") +
          '<span class="search-result-body"><strong>' +
          esc(document.name) +
          "</strong><small>" +
          esc(document.summary || "No summary is available yet.") +
          "</small>" +
          (facts ? '<span class="search-result-facts">' + facts + "</span>" : "") +
          '</span><span class="chip">' +
          esc(document.typeLabel) +
          "</span></a>"
        );
      }

      function currentLinks() {
        return Array.from(results.querySelectorAll("a.search-result"));
      }

      function render() {
        const query = normalizeSearchText(input.value.trim());
        const matches = (
          query
            ? docs.filter(
                (document) =>
                  normalizeSearchText(document.searchText).includes(query) ||
                  normalizeSearchText(document.name).includes(query),
              )
            : docs.slice(0, 8)
        ).slice(0, 20);
        results.innerHTML = matches.length
          ? matches.map(resultHtml).join("")
          : '<p class="empty-inline" role="status">No results matched your search.</p>';
      }

      input.addEventListener("input", render);
      input.addEventListener("keydown", (event) => {
        const links = currentLinks();
        if (!links.length) {
          return;
        }

        if (event.key === "ArrowDown" || event.key === "ArrowUp") {
          event.preventDefault();
          const nextIndex = event.key === "ArrowDown" ? 0 : links.length - 1;
          links[nextIndex].focus();
          return;
        }

        if (event.key === "Enter" && document.activeElement !== input) {
          event.preventDefault();
          document.activeElement.click();
        }
      });
      wireSearchKeyboard(input, results, "a.search-result");
      render();
    });
}


function initEventsSearch(root) {
  if (root.dataset.eventSectionSearchInitialized === "true") {
    return;
  }

  const input = root.querySelector("[data-event-section-search-input]");
  const clearButton = root.querySelector("[data-event-section-search-clear]");
  const panel = root.querySelector("[data-event-section-search-panel]");
  const results = root.querySelector("[data-event-section-search-results]");
  const status = root.querySelector("[data-event-section-search-status]");
  const dataElement = root.querySelector("[data-event-section-search-data]");
  const grid = document.querySelector("[data-event-section-search-grid]");
  if (!input || !clearButton || !panel || !results || !status || !dataElement || !grid) {
    return;
  }
  root.dataset.eventSectionSearchInitialized = "true";

  let events = [];
  try {
    events = JSON.parse(dataElement.textContent || "[]");
  } catch {
    events = [];
  }

  function resultHtml(event) {
    const meta = [event.date, event.category].filter(Boolean).join(" - ");
    return (
      '<a class="event-search-result theme-events" data-event-section-search-result href="' +
      event.href +
      '" role="listitem"><strong>' +
      esc(event.name) +
      "</strong>" +
      (meta ? "<small>" + esc(meta) + "</small>" : "") +
      (event.summary ? "<em>" + esc(event.summary) + "</em>" : "") +
      "</a>"
    );
  }

  function resetSearch() {
    input.value = "";
    render();
    input.focus();
  }

  function render() {
    const query = normalizeSearchText(input.value.trim());
    const active = query.length > 0;
    const matches = active
      ? events.filter(
          (event) =>
            normalizeSearchText(event.name).includes(query) ||
            normalizeSearchText(event.searchText).includes(query),
        )
      : [];

    panel.hidden = !active;
    clearButton.hidden = !active;
    grid.hidden = active;

    if (!active) {
      results.innerHTML = "";
      status.textContent = "";
      return;
    }

    if (!matches.length) {
      results.innerHTML = '<p class="empty-inline" role="status">No Events match this search.</p>';
      status.textContent = "No Events match this search.";
      return;
    }

    results.innerHTML = matches.slice(0, 20).map(resultHtml).join("");
    status.textContent =
      matches.length === 1 ? "1 matching event." : matches.length + " matching events.";
  }

  input.addEventListener("input", render);
  clearButton.addEventListener("click", resetSearch);
  wireSearchKeyboard(input, results, "[data-event-section-search-result]", {
    onEscape: resetSearch,
  });
  render();
}


function initTimelineSearch(timeline) {
  if (timeline.dataset.staticTimelineInitialized === "true") {
    return;
  }
  timeline.dataset.staticTimelineInitialized = "true";

  const input = timeline.querySelector("[data-static-timeline-search]");
  const results = timeline.querySelector("[data-static-timeline-results]");
  const scroller = timeline.querySelector("[data-static-timeline-scroller]");
  const dataElement = timeline.querySelector("[data-static-timeline-events]");
  if (!input || !results || !dataElement) {
    return;
  }

  let events = [];
  try {
    events = JSON.parse(dataElement.textContent || "[]");
  } catch {
    events = [];
  }

  function select(id) {
    const event = events.find((item) => item.id === id);
    timeline.querySelectorAll(".timeline-event,.timeline-result").forEach((item) =>
      item.classList.toggle("is-selected", item.dataset.timelineId === id),
    );
    if (event && scroller) {
      scroller.scrollTo({
        behavior: "smooth",
        left: Math.max(0, Number(event.x) - scroller.clientWidth / 2),
      });
    }
  }

  function clearSearch() {
    input.value = "";
    render();
    input.focus();
  }

  function render() {
    const query = normalizeSearchText(input.value || "");
    const matches = query
      ? events
          .filter((event) => normalizeSearchText(event.name).includes(query))
          .slice(0, 20)
      : [];
    results.innerHTML = matches
      .map(
        (event) =>
          '<button class="timeline-result" type="button" data-timeline-id="' +
          esc(event.id) +
          '"><strong>' +
          esc(event.name) +
          "</strong><small>" +
          esc(event.date) +
          " - " +
          esc(event.category) +
          "</small></button>",
      )
      .join("");
    if (query && !matches.length) {
      results.innerHTML = '<p class="empty-inline" role="status">No Events match this Timeline search.</p>';
    }
    results.querySelectorAll("[data-timeline-id]").forEach((button) =>
      button.addEventListener("click", () => select(button.dataset.timelineId)),
    );
  }

  input.addEventListener("input", render);
  wireSearchKeyboard(input, results, "[data-timeline-id]", {
    onEscape: clearSearch,
  });
  timeline.querySelectorAll(".timeline-event a").forEach((link) =>
    link.addEventListener("focus", () =>
      select(link.closest(".timeline-event")?.dataset.timelineId || ""),
    ),
  );
  render();
}


function initPublishedMap(map) {
  if (map.dataset.publishedMapInitialized === "true") {
    return;
  }
  map.dataset.publishedMapInitialized = "true";

  const viewport = map.querySelector(".map-viewport");
  const plane = map.querySelector(".map-plane");
  const width = Number(map.dataset.width);
  const height = Number(map.dataset.height);
  if (!viewport || !plane || !width || !height) {
    return;
  }

  const zoomLevels = [0.25, 0.5, 1, 2, 4, 8];
  let view = { scale: 1, x: 0, y: 0 };
  let drag = null;

  function apply() {
    plane.style.width = width + "px";
    plane.style.height = height + "px";
    plane.style.transform =
      "translate3d(" + view.x + "px," + view.y + "px,0) scale(" + view.scale + ")";
    map.querySelectorAll(".marker").forEach((marker) => {
      marker.style.setProperty("--map-marker-target-scale", String(1 / view.scale));
      marker.style.setProperty("--map-marker-artwork-scale", String(view.scale));
    });
  }

  function centered(scale) {
    const rect = viewport.getBoundingClientRect();
    view = {
      scale,
      x: (rect.width - width * scale) / 2,
      y: (rect.height - height * scale) / 2,
    };
    apply();
  }

  function fit() {
    const rect = viewport.getBoundingClientRect();
    const raw = Math.min(rect.width / width, rect.height / height);
    const scale = [...zoomLevels].reverse().find((value) => value <= raw) || zoomLevels[0];
    centered(scale);
  }

  function closestIndex() {
    return zoomLevels.reduce(
      (best, value, index) =>
        Math.abs(value - view.scale) < Math.abs(zoomLevels[best] - view.scale)
          ? index
          : best,
      0,
    );
  }

  function zoomAt(scale, clientX, clientY) {
    const rect = viewport.getBoundingClientRect();
    const px = clientX - rect.left;
    const py = clientY - rect.top;
    const imageX = (px - view.x) / view.scale;
    const imageY = (py - view.y) / view.scale;
    view = { scale, x: px - imageX * scale, y: py - imageY * scale };
    apply();
  }

  function zoomCenter(scale) {
    const rect = viewport.getBoundingClientRect();
    zoomAt(scale, rect.left + rect.width / 2, rect.top + rect.height / 2);
  }

  function step(direction) {
    const index = Math.min(
      zoomLevels.length - 1,
      Math.max(0, closestIndex() + direction),
    );
    return zoomLevels[index];
  }

  map.querySelectorAll("[data-zoom]").forEach((button) =>
    button.addEventListener("click", () => zoomCenter(Number(button.dataset.zoom))),
  );
  map.querySelector("[data-fit]")?.addEventListener("click", fit);
  map.querySelector("[data-reset]")?.addEventListener("click", () => centered(1));
  map.querySelector("[data-fullscreen]")?.addEventListener("click", () =>
    document.fullscreenElement ? document.exitFullscreen() : map.requestFullscreen(),
  );
  viewport.addEventListener(
    "wheel",
    (event) => {
      if (event.ctrlKey) {
        return;
      }
      event.preventDefault();
      zoomAt(step(event.deltaY > 0 ? -1 : 1), event.clientX, event.clientY);
    },
    { passive: false },
  );
  viewport.addEventListener("pointerdown", (event) => {
    if (event.button !== 0 || event.target.closest(".marker")) {
      return;
    }
    viewport.setPointerCapture(event.pointerId);
    drag = {
      id: event.pointerId,
      x: event.clientX,
      y: event.clientY,
      start: { ...view },
    };
    viewport.classList.add("is-dragging");
  });
  viewport.addEventListener("pointermove", (event) => {
    if (!drag || drag.id !== event.pointerId) {
      return;
    }
    view = {
      ...drag.start,
      x: drag.start.x + event.clientX - drag.x,
      y: drag.start.y + event.clientY - drag.y,
    };
    apply();
  });

  function end(event) {
    if (!drag || (event && drag.id !== event.pointerId)) {
      return;
    }
    drag = null;
    viewport.classList.remove("is-dragging");
  }

  viewport.addEventListener("pointerup", end);
  viewport.addEventListener("pointercancel", end);
  viewport.addEventListener("dblclick", (event) => {
    if (event.target.closest(".marker")) {
      return;
    }
    zoomAt(step(1), event.clientX, event.clientY);
  });
  viewport.addEventListener("keydown", (event) => {
    const pan = 72;
    if (event.key === "+" || event.key === "=") {
      event.preventDefault();
      zoomCenter(step(1));
      return;
    }
    if (event.key === "-" || event.key === "_") {
      event.preventDefault();
      zoomCenter(step(-1));
      return;
    }
    if (event.key === "0") {
      event.preventDefault();
      centered(1);
      return;
    }
    const moves = {
      ArrowDown: [0, -pan],
      ArrowLeft: [pan, 0],
      ArrowRight: [-pan, 0],
      ArrowUp: [0, pan],
    };
    const move = moves[event.key];
    if (!move) {
      return;
    }
    event.preventDefault();
    view = { ...view, x: view.x + move[0], y: view.y + move[1] };
    apply();
  });
  new ResizeObserver(fit).observe(viewport);
  fit();
}


function initMobileNavigation() {
  document.documentElement.classList.add("player-site-js");
  document.body.classList.add("player-site-js");

  const button = document.querySelector(".mobile-menu-button");
  const closeButton = document.querySelector(".mobile-menu-close");
  const panel = document.querySelector("[data-mobile-nav-panel]");
  const backdrop = document.querySelector("[data-mobile-nav-backdrop]");
  const main = document.querySelector(".page-main");
  const mobileHeaderLinks = Array.from(document.querySelectorAll(".mobile-header a"));
  const mobileQuery = window.matchMedia("(max-width: 1023px)");

  if (!button || !panel) {
    return;
  }

  let lastFocused = null;

  function isVisibleControl(item) {
    const style = window.getComputedStyle(item);
    return item.getClientRects().length > 0 && style.visibility !== "hidden" && style.display !== "none";
  }

  function focusablePanelControls() {
    return Array.from(
      panel.querySelectorAll('a[href],button:not([disabled]),[tabindex]:not([tabindex="-1"])'),
    ).filter(isVisibleControl);
  }

  function moveFocusIntoPanel() {
    const controls = focusablePanelControls();
    const target =
      controls[0] || (closeButton && isVisibleControl(closeButton) ? closeButton : panel);

    if (target && typeof target.focus === "function") {
      target.focus({ preventScroll: true });
    }
  }

  function setBackgroundInert(isOpen) {
    if (main) {
      main.inert = isOpen;
    }

    mobileHeaderLinks.forEach((link) => {
      if (isOpen) {
        link.dataset.previousTabIndex = link.getAttribute("tabindex") || "";
        link.setAttribute("tabindex", "-1");
      } else if ("previousTabIndex" in link.dataset) {
        if (link.dataset.previousTabIndex) {
          link.setAttribute("tabindex", link.dataset.previousTabIndex);
        } else {
          link.removeAttribute("tabindex");
        }
        delete link.dataset.previousTabIndex;
      }
    });
  }

  function closeMenu(restoreFocus) {
    document.body.classList.remove("player-nav-open");
    button.setAttribute("aria-expanded", "false");
    button.setAttribute("aria-label", "Open navigation menu");
    if (backdrop) {
      backdrop.hidden = true;
    }
    if (mobileQuery.matches) {
      panel.setAttribute("aria-hidden", "true");
    } else {
      panel.removeAttribute("aria-hidden");
    }
    setBackgroundInert(false);
    if (restoreFocus && lastFocused && typeof lastFocused.focus === "function") {
      lastFocused.focus();
    }
  }

  function openMenu() {
    if (!mobileQuery.matches) {
      return;
    }

    lastFocused =
      document.activeElement && document.activeElement !== document.body
        ? document.activeElement
        : button;
    document.body.classList.add("player-nav-open");
    button.setAttribute("aria-expanded", "true");
    button.setAttribute("aria-label", "Close navigation menu");
    panel.removeAttribute("aria-hidden");
    if (backdrop) {
      backdrop.hidden = false;
    }
    setBackgroundInert(true);
    moveFocusIntoPanel();

    window.requestAnimationFrame(() => {
      if (!panel.contains(document.activeElement)) {
        moveFocusIntoPanel();
      }
    });
  }

  function syncForViewport() {
    if (mobileQuery.matches) {
      closeMenu(false);
    } else {
      document.body.classList.remove("player-nav-open");
      button.setAttribute("aria-expanded", "false");
      panel.removeAttribute("aria-hidden");
      if (backdrop) {
        backdrop.hidden = true;
      }
      setBackgroundInert(false);
    }
  }

  button.addEventListener("click", () => {
    if (document.body.classList.contains("player-nav-open")) {
      closeMenu(true);
    } else {
      openMenu();
    }
  });

  closeButton?.addEventListener("click", () => closeMenu(true));
  backdrop?.addEventListener("click", () => closeMenu(true));

  panel.addEventListener("click", (event) => {
    const target = event.target;
    const link = target && typeof target.closest === "function" ? target.closest("a[href]") : null;
    if (link && mobileQuery.matches) {
      closeMenu(false);
    }
  });

  document.addEventListener("keydown", (event) => {
    if (!document.body.classList.contains("player-nav-open")) {
      return;
    }

    if (event.key === "Escape") {
      event.preventDefault();
      closeMenu(true);
      return;
    }

    if (event.key !== "Tab") {
      return;
    }

    const controls = focusablePanelControls();
    if (!controls.length) {
      event.preventDefault();
      return;
    }

    const first = controls[0];
    const last = controls[controls.length - 1];

    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  });

  if (typeof mobileQuery.addEventListener === "function") {
    mobileQuery.addEventListener("change", syncForViewport);
  } else if (typeof mobileQuery.addListener === "function") {
    mobileQuery.addListener(syncForViewport);
  }
  syncForViewport();
}

function bootstrapPlayerSite() {
  try {
    const worldSlug = document.querySelector('meta[name="player-site-world-slug"]')?.getAttribute("content");
    if (worldSlug) {
      window.localStorage.setItem("world-codex:last-world", worldSlug);
    }
  } catch {
  }
  initMobileNavigation();
  document.querySelectorAll("[data-static-search]").forEach(initGlobalSearch);
  document.querySelectorAll("[data-event-section-search]").forEach(initEventsSearch);
  document.querySelectorAll("[data-static-timeline]").forEach(initTimelineSearch);
  document.querySelectorAll(".published-map").forEach(initPublishedMap);
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", bootstrapPlayerSite, { once: true });
} else {
  bootstrapPlayerSite();
}

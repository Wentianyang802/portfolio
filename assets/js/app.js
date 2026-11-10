/* global SITE, WORKS, CATEGORIES */
(function () {
  "use strict";

  const $ = (sel, root) => (root || document).querySelector(sel);
  const $$ = (sel, root) => Array.from((root || document).querySelectorAll(sel));
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const finePointer = window.matchMedia("(pointer: fine)").matches;

  const site = typeof SITE !== "undefined" ? SITE : {
    name: "科杰 Kevin",
    title: "全能影视编导",
    email: "",
    phone: "19875770473",
    wechat: "19875770473",
    about: "",
    tags: [],
    resumeReady: false,
    resumePath: "assets/简历.pdf"
  };

  function cursorStateFor(target) {
    if (!(target instanceof Element)) return "";
    if (target.closest("[data-cursor='text'], .hero-title, .section-title, .about-bio")) return "text";
    if (target.closest("[data-cursor='card'], .work-card")) return "card";
    if (target.closest("a, button, .filter-btn, .scroll-cue")) return "link";
    return "";
  }

  if (typeof WORKS === "undefined" || !Array.isArray(WORKS)) {
    console.error("作品数据没有加载：请确认 assets/js/works-data.js 存在。");
    return;
  }

  const workBySlug = new Map(WORKS.map((work) => [work.slug, work]));
  const featuredWorks = WORKS
    .filter((work) => work.featured)
    .sort((a, b) => a.featuredOrder - b.featuredOrder)
    .slice(0, 8);

  const archiveWorks = WORKS.slice().sort((a, b) => {
    if (a.featured !== b.featured) return a.featured ? -1 : 1;
    if (a.featured && b.featured) return a.featuredOrder - b.featuredOrder;
    const ai = CATEGORIES.findIndex((category) => category.key === a.category);
    const bi = CATEGORIES.findIndex((category) => category.key === b.category);
    return ai - bi || a.durationSec - b.durationSec;
  });

  let activeFilter = "all";
  let lastTrigger = null;
  let dialogOpen = false;

  const dialog = $("#player");
  const playerVideo = $("#player-video");
  const playerTitle = $("#player-title");
  const playerIndex = $("#player-index");
  const playerInfo = $("#player-info");
  const playerSummary = $("#player-summary");
  const archiveGrid = $("[data-archive-grid]");
  const featuredGrid = $("[data-featured-grid]");

  /* ---------------- 站点信息 ---------------- */

  function setupSite() {
    document.title = site.name + " — " + site.title;
    const description = document.querySelector('meta[name="description"]');
    if (description) {
      description.setAttribute("content", site.name + " · " + site.title + " · 个人商业作品集");
    }

    $$("[data-site-name]").forEach((el) => { el.textContent = site.name; });
    $$("[data-site-title]").forEach((el) => { el.textContent = site.title; });
    $$("[data-site-about]").forEach((el) => { el.textContent = site.about; });
    $$("[data-site-wechat]").forEach((el) => { el.textContent = site.wechat; });
    $$("[data-site-phone]").forEach((el) => { el.textContent = site.phone; });

    const phoneLink = $("[data-site-phone-link]");
    if (phoneLink) {
      phoneLink.textContent = site.phone || "";
      phoneLink.href = "tel:" + String(site.phone || "").replace(/[^\d+]/g, "");
    }

    const emailEl = $("[data-site-email]");
    const emailRow = $("[data-email-row]");
    const contactLines = $("[data-contact-lines]");
    const emailValid = Boolean(site.email) && !/待填写|待补|your@|example\.com/i.test(site.email);

    if (emailEl) {
      if (emailValid) {
        emailEl.textContent = site.email;
        emailEl.href = "mailto:" + site.email;
        emailEl.removeAttribute("aria-disabled");
        emailEl.classList.remove("is-placeholder");
      } else {
        emailEl.textContent = "";
        emailEl.removeAttribute("href");
        emailEl.setAttribute("aria-disabled", "true");
        emailEl.classList.add("is-placeholder");
      }
    }
    if (emailRow) emailRow.hidden = !emailValid;
    if (contactLines) contactLines.classList.toggle("is-empty", !emailValid);

    const tagsEl = $("[data-site-tags]");
    if (tagsEl) {
      tagsEl.innerHTML = "";
      (site.tags || []).forEach((tag) => {
        const li = document.createElement("li");
        li.textContent = tag;
        tagsEl.appendChild(li);
      });
    }

    const yearEl = $("[data-year]");
    if (yearEl) yearEl.textContent = String(new Date().getFullYear());

    setupResume();
  }

  function setupResume() {
    const btn = $("[data-resume]");
    const note = $("[data-resume-note]");
    if (!btn) return;
    if (site.resumeReady && site.resumePath) {
      btn.href = site.resumePath;
      btn.setAttribute("download", "文科杰_简历2026_横.pdf");
      btn.removeAttribute("aria-disabled");
      btn.classList.remove("is-disabled");
      btn.textContent = "下载简历 / RESUME ↓";
      if (note) note.textContent = "PDF · 点击下载";
    } else {
      btn.href = "#";
      btn.removeAttribute("download");
      btn.setAttribute("aria-disabled", "true");
      btn.classList.add("is-disabled");
      btn.textContent = "下载简历 / RESUME";
      if (note) note.textContent = "简历制作中 · PDF 就位后开启";
      btn.addEventListener("click", (event) => event.preventDefault());
    }
  }

  /* ---------------- 卡片 ---------------- */

  function makeCard(work, index, variant) {
    const card = document.createElement("article");
    card.className = "work-card " + (variant === "featured" ? "featured-card" : "archive-card");
    card.classList.add(work.format === "portrait" ? "is-portrait" : "is-landscape");
    if (work.featured) card.classList.add("is-featured");
    card.dataset.slug = work.slug;
    card.tabIndex = 0;
    card.setAttribute("role", "button");
    card.setAttribute(
      "aria-label",
      "播放 " + work.title + "，" + work.categoryLabel + "，" + work.durationText
    );

    const media = document.createElement("div");
    media.className = "card-media";

    const poster = document.createElement("img");
    poster.className = "card-poster";
    poster.src = work.cover;
    poster.alt = work.title + " 封面";
    poster.loading = index < 3 ? "eager" : "lazy";
    poster.decoding = "async";
    media.appendChild(poster);

    let video = null;
    if (variant === "featured" && work.preview && !reducedMotion) {
      video = document.createElement("video");
      video.className = "card-video";
      video.muted = true;
      video.loop = true;
      video.playsInline = true;
      video.preload = "none";
      video.poster = work.cover;
      video.setAttribute("muted", "");
      video.setAttribute("playsinline", "");
      video.setAttribute("aria-hidden", "true");
      video.setAttribute("tabindex", "-1");
      video.dataset.src = work.preview;
      media.appendChild(video);
    }

    const play = document.createElement("span");
    play.className = "card-play";
    play.setAttribute("aria-hidden", "true");
    play.textContent = "▶";
    media.appendChild(play);

    const caption = document.createElement("div");
    caption.className = "card-caption" + (variant === "archive" ? " is-compact" : "");

    const head = document.createElement("div");
    head.className = "card-caption-head";

    const indexEl = document.createElement("span");
    indexEl.className = "card-index";
    indexEl.textContent = String(index + 1).padStart(2, "0");

    const state = document.createElement("span");
    state.className = "card-preview-state";
    const dot = document.createElement("i");
    dot.setAttribute("aria-hidden", "true");
    state.appendChild(dot);
    state.appendChild(document.createTextNode(
      variant === "featured"
        ? (reducedMotion ? "静态预览" : "静音预览")
        : "点击播放"
    ));

    head.appendChild(indexEl);
    head.appendChild(state);

    const title = document.createElement("h3");
    title.className = "card-title";
    title.textContent = work.title;
    title.dataset.cursor = "text";

    const meta = document.createElement("p");
    meta.className = "card-meta";
    meta.textContent = [work.categoryLabel, work.client, work.durationText]
      .filter(Boolean)
      .join(" / ");

    const summary = document.createElement("p");
    summary.className = "card-summary";
    summary.textContent = work.summary || "";

    caption.appendChild(head);
    caption.appendChild(title);
    caption.appendChild(meta);
    if (variant === "featured") caption.appendChild(summary);

    card.dataset.cursor = "card";
    card.appendChild(media);
    card.appendChild(caption);

    const activate = () => openPlayer(work, card);
    card.addEventListener("click", activate);
    card.addEventListener("keydown", (event) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        activate();
      }
    });

    return card;
  }

  function renderWorks() {
    const featuredCount = $("[data-featured-count]");
    if (featuredCount) featuredCount.textContent = String(featuredWorks.length).padStart(2, "0");

    if (featuredGrid) {
      featuredGrid.innerHTML = "";
      featuredWorks.forEach((work, index) => {
        featuredGrid.appendChild(makeCard(work, index, "featured"));
      });
    }

    if (archiveGrid) {
      archiveGrid.innerHTML = "";
      archiveWorks.forEach((work, index) => {
        archiveGrid.appendChild(makeCard(work, index, "archive"));
      });
    }
  }

  /* ---------------- 筛选 ---------------- */

  function renderFilters() {
    const wrap = $("[data-filters]");
    if (!wrap) return;
    wrap.innerHTML = "";

    const items = [
      { key: "all", label: "全部", count: WORKS.length },
      ...CATEGORIES.map((category) => ({
        key: category.key,
        label: category.label,
        count: WORKS.filter((work) => work.category === category.key).length
      }))
    ];

    items.forEach((item) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "filter-btn" + (item.key === "all" ? " is-active" : "");
      btn.dataset.filter = item.key;
      btn.setAttribute("aria-pressed", item.key === "all" ? "true" : "false");

      const label = document.createElement("span");
      label.textContent = item.label;
      const count = document.createElement("b");
      count.textContent = String(item.count).padStart(2, "0");
      btn.appendChild(label);
      btn.appendChild(count);

      btn.addEventListener("click", () => {
        if (activeFilter === item.key) return;
        activeFilter = item.key;
        $$(".filter-btn", wrap).forEach((other) => {
          const current = other.dataset.filter === activeFilter;
          other.classList.toggle("is-active", current);
          other.setAttribute("aria-pressed", current ? "true" : "false");
        });
        applyFilter();
      });

      wrap.appendChild(btn);
    });
  }

  let filterTimer = null;

  function applyFilter() {
    if (!archiveGrid) return;
    const cards = $$(".archive-card", archiveGrid);
    archiveGrid.classList.add("is-fading");
    window.clearTimeout(filterTimer);
    filterTimer = window.setTimeout(() => {
      cards.forEach((card) => {
        const work = workBySlug.get(card.dataset.slug);
        card.hidden = !(activeFilter === "all" || (work && work.category === activeFilter));
        // 筛选后立即结束“显影”，避免刚切出来的卡片又经历一次模糊入场
        card.classList.add("is-in");
      });
      window.requestAnimationFrame(() => archiveGrid.classList.remove("is-fading"));
    }, reducedMotion ? 0 : 160);
  }

  /* ---------------- 播放弹层 ---------------- */

  function openPlayer(work, trigger) {
    if (!dialog || !playerVideo || !work) return;
    lastTrigger = trigger || null;

    dialog.classList.toggle("is-portrait", work.format === "portrait");
    dialog.classList.toggle("is-landscape", work.format !== "portrait");

    if (playerTitle) playerTitle.textContent = work.title;
    if (playerIndex) {
      playerIndex.textContent = work.featured
        ? String(work.featuredOrder).padStart(2, "0") + " / 08 · 精选"
        : work.categoryEn || work.categoryLabel;
    }
    if (playerInfo) {
      playerInfo.textContent = [work.categoryLabel, work.client, work.durationText]
        .filter(Boolean)
        .join(" / ");
    }
    if (playerSummary) playerSummary.textContent = work.summary || "";

    playerVideo.poster = work.cover;
    playerVideo.src = work.video;
    playerVideo.load();

    dialogOpen = true;
    pauseAllPreviews();
    document.body.classList.add("modal-open");
    if (typeof dialog.showModal === "function" && !dialog.open) {
      dialog.showModal();
    } else if (!dialog.open) {
      dialog.setAttribute("open", "");
    }

    const playPromise = playerVideo.play();
    if (playPromise && typeof playPromise.catch === "function") {
      playPromise.catch(() => {});
    }
  }

  function closePlayer() {
    if (!dialog || !dialog.open) return;
    dialog.close();
  }

  function setupDialog() {
    if (!dialog || !playerVideo) return;
    const closeBtn = $("[data-player-close]");
    if (closeBtn) closeBtn.addEventListener("click", closePlayer);

    dialog.addEventListener("click", (event) => {
      if (event.target === dialog) closePlayer();
    });

    dialog.addEventListener("close", () => {
      playerVideo.pause();
      playerVideo.removeAttribute("src");
      playerVideo.load();
      dialogOpen = false;
      document.body.classList.remove("modal-open");
      if (lastTrigger && typeof lastTrigger.focus === "function") lastTrigger.focus();
      resumeVisiblePreviews();
    });
  }

  /* ---------------- 静音预览播放管理 ---------------- */

  const previewState = new Map();
  const visiblePreviewVideos = new Set();
  const activePreviewVideos = new Set();
  const MAX_PREVIEWS = 4;
  let previewObserver = null;

  function playPreview(video) {
    if (dialogOpen || reducedMotion) return;
    const state = previewState.get(video);
    if (!state) return;
    if (!video.getAttribute("src") && video.dataset.src) {
      video.src = video.dataset.src;
      video.load();
    }
    const promise = video.play();
    if (promise && typeof promise.catch === "function") {
      promise.catch(() => {
        state.card.classList.add("is-blocked");
      });
    }
  }

  function pauseAllPreviews() {
    activePreviewVideos.forEach((video) => video.pause());
    activePreviewVideos.clear();
    $$(".card-video").forEach((video) => video.pause());
  }

  function resumeVisiblePreviews() {
    if (dialogOpen || reducedMotion) return;
    let count = 0;
    for (const video of visiblePreviewVideos) {
      if (count >= MAX_PREVIEWS) break;
      playPreview(video);
      count += 1;
    }
  }

  function initPreviews() {
    const videos = $$(".card-video[data-src]");
    if (!videos.length || reducedMotion) return;

    videos.forEach((video) => {
      const card = video.closest(".work-card");
      previewState.set(video, { card, visible: false });

      video.addEventListener("playing", () => {
        card.classList.add("is-playing");
        card.classList.remove("is-blocked");
        activePreviewVideos.add(video);
        if (activePreviewVideos.size > MAX_PREVIEWS) {
          for (const other of activePreviewVideos) {
            if (other !== video) {
              other.pause();
              break;
            }
          }
        }
      });

      video.addEventListener("pause", () => {
        card.classList.remove("is-playing");
        activePreviewVideos.delete(video);
      });

      video.addEventListener("error", () => {
        card.classList.add("is-blocked");
      });
    });

    previewObserver = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        const video = entry.target;
        const state = previewState.get(video);
        if (!state) return;
        state.visible = entry.isIntersecting && entry.intersectionRatio >= 0.25;
        if (state.visible) {
          visiblePreviewVideos.add(video);
          playPreview(video);
        } else {
          visiblePreviewVideos.delete(video);
          video.pause();
        }
      });
    }, { threshold: [0.1, 0.25, 0.5] });

    videos.forEach((video) => previewObserver.observe(video));

    document.addEventListener("visibilitychange", () => {
      if (document.hidden) {
        pauseAllPreviews();
      } else {
        resumeVisiblePreviews();
      }
    });
  }

  /* ---------------- 滚动显影 ---------------- */

  function setupReveal() {
    const elements = $$(".reveal, .work-card");
    if (reducedMotion || !("IntersectionObserver" in window)) {
      elements.forEach((el) => el.classList.add("is-in"));
      return;
    }

    elements.forEach((el, index) => {
      el.style.transitionDelay = String(Math.min(index % 6, 5) * 70) + "ms";
    });

    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        entry.target.classList.add("is-in");
        observer.unobserve(entry.target);
      });
    }, { threshold: 0.12, rootMargin: "0px 0px -6% 0px" });

    elements.forEach((el) => observer.observe(el));
  }

  /* ---------------- 首页氛围动效 ---------------- */

  function setupHeaderAndScroll() {
    const header = $("[data-header]");
    const hero = $(".hero");
    let ticking = false;

    function update() {
      const y = window.scrollY || window.pageYOffset || 0;
      if (header) header.classList.toggle("is-scrolled", y > 40);
      const max = document.documentElement.scrollHeight - window.innerHeight;
      document.documentElement.style.setProperty("--scroll", max > 0 ? Math.min(1, y / max).toFixed(4) : "0");
      if (hero && !reducedMotion) {
        hero.style.setProperty("--hero-shift", (Math.min(y, window.innerHeight) * 0.06).toFixed(1) + "px");
      }
      ticking = false;
    }

    window.addEventListener("scroll", () => {
      if (ticking) return;
      ticking = true;
      window.requestAnimationFrame(update);
    }, { passive: true });

    update();
  }

  function setupCursorGlow() {
    const glow = $(".cursor-glow");
    if (!glow) return;
    if (reducedMotion || !finePointer) {
      glow.remove();
      return;
    }

    let targetX = window.innerWidth / 2;
    let targetY = window.innerHeight / 2;
    let currentX = targetX;
    let currentY = targetY;
    let active = false;
    let heroActive = true;
    let cursorState = "";

    // 微光只属于首屏，离开引言后让作品自己说话
    const hero = $(".hero");
    if (hero && "IntersectionObserver" in window) {
      const observer = new IntersectionObserver((entries) => {
        heroActive = entries[0].isIntersecting;
        if (!heroActive) {
          active = false;
          glow.classList.remove("is-on");
        }
      }, { threshold: 0.05 });
      observer.observe(hero);
    }

    window.addEventListener("pointermove", (event) => {
      if (event.pointerType && event.pointerType !== "mouse") return;
      if (!heroActive) return;
      targetX = event.clientX;
      targetY = event.clientY;
      if (!active) {
        active = true;
        glow.classList.add("is-on");
      }
      const nextState = cursorStateFor(event.target);
      if (nextState !== cursorState) {
        cursorState = nextState;
        if (nextState) glow.dataset.state = nextState;
        else delete glow.dataset.state;
      }
    }, { passive: true });

    window.addEventListener("mouseleave", () => {
      active = false;
      glow.classList.remove("is-on");
      delete glow.dataset.state;
      cursorState = "";
    });

    function frame() {
      currentX += (targetX - currentX) * 0.06;
      currentY += (targetY - currentY) * 0.06;
      glow.style.transform = "translate3d(" + currentX + "px," + currentY + "px,0) translate(-50%,-50%)";
      window.requestAnimationFrame(frame);
    }

    frame();
  }

  function setupMagneticText() {
    if (reducedMotion || !finePointer) return;
    const targets = $$(".hero-title, .section-title, .contact-primary");
    targets.forEach((el) => {
      el.classList.add("liftable", "magnetic");
      el.addEventListener("pointermove", (event) => {
        const rect = el.getBoundingClientRect();
        if (!rect.width || !rect.height) return;
        const nx = (event.clientX - (rect.left + rect.width / 2)) / (rect.width / 2);
        const ny = (event.clientY - (rect.top + rect.height / 2)) / (rect.height / 2);
        el.style.setProperty("--mx", (nx * 4).toFixed(2) + "px");
        el.style.setProperty("--my", (ny * 3).toFixed(2) + "px");
      });
      el.addEventListener("pointerleave", () => {
        el.style.setProperty("--mx", "0px");
        el.style.setProperty("--my", "0px");
      });
    });
  }

  function smoothScrollTo(targetY, duration) {
    const startY = window.scrollY || window.pageYOffset || 0;
    const distance = targetY - startY;
    const startTime = performance.now();
    function frame(now) {
      const progress = Math.min(1, (now - startTime) / duration);
      const eased = progress < 0.5
        ? 4 * progress * progress * progress
        : 1 - Math.pow(-2 * progress + 2, 3) / 2;
      window.scrollTo(0, startY + distance * eased);
      if (progress < 1) window.requestAnimationFrame(frame);
    }
    window.requestAnimationFrame(frame);
  }

  function setupScrollCue() {
    const cue = $("[data-scroll-cue]");
    if (!cue) return;

    const go = () => {
      const target = $("#featured");
      if (!target) return;
      const header = $("[data-header]");
      const offset = (header ? header.getBoundingClientRect().height : 72) + 16;
      const targetY = target.getBoundingClientRect().top + window.scrollY - offset;
      if (reducedMotion) {
        window.scrollTo(0, targetY);
        return;
      }
      smoothScrollTo(targetY, 1100);
    };

    cue.addEventListener("click", (event) => {
      event.preventDefault();
      go();
    });
    cue.addEventListener("keydown", (event) => {
      if (event.key === " ") {
        event.preventDefault();
        go();
      }
    });
  }

  function setupDust() {
    const canvas = $("#dust");
    if (!canvas) return;
    if (reducedMotion || !finePointer) {
      canvas.style.display = "none";
      return;
    }

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let width = 0;
    let height = 0;
    let dpr = 1;
    let particles = [];
    let running = false;
    let rafId = null;
    let last = 0;

    function makeParticles() {
      const count = Math.max(24, Math.min(44, Math.round(width / 28)));
      particles = Array.from({ length: count }, () => ({
        x: Math.random() * width,
        y: Math.random() * height,
        r: 0.5 + Math.random() * 0.9,
        vy: 2 + Math.random() * 5,
        phase: Math.random() * Math.PI * 2,
        drift: 0.15 + Math.random() * 0.4,
        alpha: 0.035 + Math.random() * 0.075
      }));
    }

    function resize() {
      const rect = canvas.parentElement.getBoundingClientRect();
      dpr = Math.min(2, window.devicePixelRatio || 1);
      width = rect.width;
      height = rect.height;
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
      canvas.style.width = width + "px";
      canvas.style.height = height + "px";
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      makeParticles();
    }

    function frame(time) {
      if (!running) {
        rafId = null;
        return;
      }
      if (time - last < 33) {
        rafId = window.requestAnimationFrame(frame);
        return;
      }
      const dt = Math.min(50, time - last);
      last = time;
      ctx.clearRect(0, 0, width, height);
      particles.forEach((particle) => {
        particle.y -= particle.vy * dt / 1000;
        particle.x += Math.sin(time / 6000 + particle.phase) * particle.drift * dt / 1000;
        if (particle.y < -10) {
          particle.y = height + 10;
          particle.x = Math.random() * width;
        }
        if (particle.x < -10) particle.x = width + 10;
        if (particle.x > width + 10) particle.x = -10;
        ctx.beginPath();
        ctx.arc(particle.x, particle.y, particle.r, 0, Math.PI * 2);
        ctx.fillStyle = "rgba(201,162,107," + particle.alpha + ")";
        ctx.fill();
      });
      rafId = window.requestAnimationFrame(frame);
    }

    function start() {
      if (running) return;
      running = true;
      last = 0;
      if (!rafId) rafId = window.requestAnimationFrame(frame);
    }

    function stop() {
      running = false;
      if (rafId) {
        window.cancelAnimationFrame(rafId);
        rafId = null;
      }
      ctx.clearRect(0, 0, width, height);
    }

    resize();
    window.addEventListener("resize", resize);

    if ("IntersectionObserver" in window) {
      const observer = new IntersectionObserver((entries) => {
        if (entries[0].isIntersecting && !document.hidden) start();
        else stop();
      }, { threshold: 0 });
      observer.observe(canvas.parentElement);
    } else {
      start();
    }

    document.addEventListener("visibilitychange", () => {
      if (document.hidden) stop();
      else start();
    });
  }

  function setupHero() {
    const hero = $(".hero");
    if (!hero) return;
    if (reducedMotion) {
      hero.classList.add("is-loaded");
      return;
    }
    window.setTimeout(() => hero.classList.add("is-loaded"), 80);
  }

  /* ---------------- 启动 ---------------- */

  setupSite();
  renderWorks();
  renderFilters();
  setupDialog();
  initPreviews();
  setupReveal();
  setupHeaderAndScroll();
  setupCursorGlow();
  setupMagneticText();
  setupScrollCue();
  setupDust();
  setupHero();

  document.documentElement.setAttribute("data-ready", "true");
  window.__PORTFOLIO__ = {
    WORKS,
    CATEGORIES,
    SITE: site,
    featured: featuredWorks,
    openPlayer
  };
})();

(function () {
  const CATS = [
    { key: "learnedmen", en: "Learned Men", zh: "士" },
    { key: "teachers", en: "Teachers", zh: "師" },
    { key: "artists", en: "Artists", zh: "藝" },
    { key: "craftspeople", en: "Craftpeople", zh: "工" },
    { key: "merchants", en: "Merchants", zh: "商" }
  ];
  const COPY = {
    en: {
      back: "Back to Previous",
      home: "Back to Homepage",
      empty: "No alumni in this category yet.",
      fail: "The alumni list could not be loaded.",
      loading: "Loading…"
    },
    zh: {
      back: "回到上一頁",
      home: "回到首頁",
      empty: "這一類別暫時沒有校友。",
      fail: "校友資料暫時無法讀取。",
      loading: "正在讀取…"
    }
  };
  const INTRO = {
    teachers: {
      en: [
        "\u2018For I know the plans I have for you\u2019, declares the Lord, \u2018plans to prosper you and not to harm you, plans to give you hope and a future. Then you will call on me and come and pray to me, and I will listen to you.\u2019 \u2014 Jeremiah 29:11\u201312.",
        "Teachers and preachers may have different syllabuses, but they converge on one goal: for the benefit of future generations. The history of St. Paul\u2019s College is inseparable from that of Hong Kong Sheng Kung Hui \u2014 as men of faith have inspired our past students to follow in their footsteps for the greater good, within and without the church, so too shall we find their names here as tribute."
      ],
      zh: [
        "「耶和華曰：我爲爾所存之念，我自知之，乃平康之念，非災害之念也，俾爾終有所望，爾必籲我，往而禱我，我必垂聽。」（耶利米書第二十九章十一至十二節）",
        "敎師、牧師，課程內容雖異，卻皆以育才為目標。本校歷史與香港聖公會的歷史密不可分，保羅舊生受前賢啟發，跟隨其步伐，在敎會內外弘揚其信念，造福人羣。謹此向前賢致敬！"
      ]
    },
    learnedmen: {
      en: [
        "The learned man must not be insular, nor shall he yield; his mission is serious, his path arduous. \u2014 Zengzi",
        "The modern learned man is not only knowledgeable, but serves with magnanimity and steely determination. Within China\u2019s long path of modernisation, our alumni have left their mark. While their work differs in ideal, focus, and form, it all stems from the four College watchwords: justice, honour, truth, and virtue."
      ],
      zh: [
        "曾子曰：「士不可以不弘毅，任重而道遠。」",
        "學識淵博、胸襟廣闊、堅毅不屈，可謂今「士」之本質。在中國現代化的道路上，保羅舊生作出了重大貢獻。他們的理想、重點、形式各異，其初衷卻同源於本校格言——義、榮、誠、德。"
      ]
    },
    artists: {
      en: [
        "\u2018All for each and each for all.\u2019 \u2014 Leung Wai (Ng Cho Fan), In the Face of Demolition",
        "The twentieth century saw the advent of audio recording and film; East-West cultural exchange was in full swing, and vernacular Chinese was becoming the new norm. Modernist literature, art, music, and movies sprang across Asia, just as it did in the West. Among various industries\u2019 pioneers were some of our old boys, seeking to encapsulate and innovate upon traditional Chinese culture in new forms of media. As Hong Kong\u2019s arts and entertainment industries matured, our alumni have found success at home and abroad, contributing back to our traditions."
      ],
      zh: [
        "「人人爲我，我爲人人」——梁威（吳楚帆飾），《危樓春曉》",
        "二十世紀初，錄音、錄影初現，東西文化交流甚廣，白話文日漸普及。亞洲現代文學、藝術、音樂及電影業與歐美同步迅速發展。行業先驅者不乏保羅舊生，他們把握先機，盼以嶄新媒體呈現中國傳統文化。香港藝術及娛樂發展漸趨成熟，保羅舊生成就卓越，並以不同形式回饋母校。"
      ]
    },
    craftspeople: {
      en: [
        "If I have seen further it is by standing on the shoulders of giants. \u2014 Isaac Newton",
        "Masters of their craft demand perfection. Their practice shall stand the test of the public and time, without falling into the pit of self-indulgence. Here we find alumni who have dedicated their lives to their respective crafts, who stood on the shoulders of giants as they carve their way to greater heights."
      ],
      zh: [
        "「若我得以高瞻遠矚，多賴立足偉人肩上。」——牛頓",
        "工者，擇善固執，凡事力臻完美，其工作不容自滿，須經得起大眾及時代的考驗。保羅舊生投身不同工藝事業，猶如立於巨人之肩，冀盼再創高峯。"
      ]
    },
    merchants: {
      en: [
        "Audentes fortuna iuvat \u2014 fortune favours the bold.",
        "The city\u2019s history as a trading port means it has long attracted prospective entrepreneurs. With our founding emphasis on Anglo-Chinese education, St. Paul\u2019s College has produced businessmen renowned both here and abroad, adroit and well-versed in local and foreign wants. Upon success, these men have generously given back to their homeland."
      ],
      zh: [
        "「勇能得福。」——拉丁文古諺",
        "香港作爲轉口貿易的樞紐，向來深得準企業家的靑睞。聖保羅書院自創校起中英敎育並重，培育了不少聞名中外、深知大眾需求的成功商人。他們事業成功，不忘回饋社會，貢獻國家。"
      ]
    }
  };

  let records = null;
  let loadError = "";

  function plain(value) {
    const doc = new DOMParser().parseFromString(String(value || ""), "text/html");
    return doc.body.textContent.replace(/\u3000/g, " ").replace(/\s+/g, " ").trim();
  }

  function fillBio(container, html) {
    const doc = new DOMParser().parseFromString(String(html || ""), "text/html");
    const blocks = [];
    function current() {
      const last = blocks[blocks.length - 1];
      if (last && last.open) return last;
      const block = { open: true, parts: [] };
      blocks.push(block);
      return block;
    }
    function walk(node) {
      if (node.nodeType === 3) {
        const text = node.textContent.replace(/\s+/g, " ");
        if (text) current().parts.push({ kind: "text", text });
        return;
      }
      if (node.nodeType !== 1) return;
      const tag = node.tagName.toLowerCase();
      if (tag === "br") {
        current().parts.push({ kind: "br" });
        return;
      }
      if (tag === "a") {
        const href = node.getAttribute("href") || "";
        const text = node.textContent.replace(/\s+/g, " ").trim();
        if (text) current().parts.push({ kind: "link", href: /^https?:\/\//i.test(href) ? href : "", text });
        return;
      }
      const block = tag === "p" || tag === "li" || tag === "blockquote" || tag === "div";
      if (block) {
        const last = blocks[blocks.length - 1];
        if (last) last.open = false;
        blocks.push({ open: true, parts: [] });
      }
      node.childNodes.forEach(walk);
      if (block) {
        const last = blocks[blocks.length - 1];
        if (last) last.open = false;
      }
    }
    doc.body.childNodes.forEach(walk);
    blocks.forEach((block) => {
      const paragraph = document.createElement("p");
      block.parts.forEach((part) => {
        if (part.kind === "br") paragraph.append(document.createElement("br"));
        else if (part.kind === "link" && part.href) {
          const link = document.createElement("a");
          link.href = part.href;
          link.target = "_blank";
          link.rel = "noopener noreferrer";
          link.textContent = part.text;
          paragraph.append(link);
        } else if (part.kind !== "br") paragraph.append(document.createTextNode(part.text));
      });
      if (paragraph.textContent.trim()) container.append(paragraph);
    });
  }

  function yearOf(person) {
    const year = parseInt(person.grad_year, 10);
    return Number.isFinite(year) ? year : 9999;
  }

  function people(cat, lang) {
    const rows = (records && records[cat] ? records[cat] : []).filter((row) => !row.status || row.status === "A");
    return rows.slice().sort((a, b) => {
      const byYear = yearOf(a) - yearOf(b);
      if (byYear) return byYear;
      const left = plain(lang === "zh" ? a.alumni_name_chi : a.alumni_name);
      const right = plain(lang === "zh" ? b.alumni_name_chi : b.alumni_name);
      return left.localeCompare(right, lang === "zh" ? "zh" : "en");
    });
  }

  function problem(lang) {
    if (loadError) return COPY[lang].fail;
    if (!records) return COPY[lang].loading;
    return "";
  }

  async function load() {
    if (window.Boot) await Boot.whenReady();
    try {
      let payload = null;
      if (window.Update) {
        try { payload = await Update.current(); } catch (error) { payload = null; }
      }
      if ((!payload || !payload.data) && window.__ALUMNI_BUNDLE__ && window.__ALUMNI_BUNDLE__.data) {
        payload = window.__ALUMNI_BUNDLE__;
      }
      if (!payload || !payload.data) {
        const urls = [];
        if (window.Nav && Nav.resolve) {
          urls.push(Nav.resolve("../data/alumni.json"));
        }
        try {
          const script = document.querySelector("script[src*='alumni.js']");
          if (script && script.src) urls.push(new URL("../data/alumni.json", script.src.replace(/\\/g, "/")).href);
        } catch (error) { /* ignore */ }
        urls.push("../data/alumni.json");
        let lastError = null;
        for (let i = 0; i < urls.length; i += 1) {
          try {
            const response = await fetch(urls[i], { cache: "no-store" });
            if (!response.ok) throw new Error(String(response.status));
            payload = await response.json();
            lastError = null;
            break;
          } catch (error) {
            lastError = error;
          }
        }
        if (lastError) throw lastError;
      }
      records = payload.data || {};
      loadError = "";
    } catch (error) {
      loadError = error && error.message ? error.message : "error";
    }
  }

  function displayName(person, lang) {
    const primary = plain(lang === "zh" ? person.alumni_name_chi : person.alumni_name);
    const secondary = plain(lang === "zh" ? person.alumni_name : person.alumni_name_chi);
    return primary || secondary;
  }

  function lifeText(person, lang) {
    const life = plain(person.lifespan).replace(/[()（）]/g, "").replace(/(\d)\s*[-–]\s*(\d)/g, "$1–$2");
    if (!life) return "";
    return lang === "zh" ? "（" + life + "）" : "(" + life + ")";
  }

  function metaText(person, lang) {
    const year = plain(person.grad_year);
    const alias = plain(lang === "zh" ? person.chi_alias : person.eng_alias);
    if (lang === "zh") {
      const parts = [];
      if (year) parts.push(year + "屆畢業");
      if (alias) parts.push(alias);
      return parts.join(" — ");
    }
    return { year: year ? "Class of " + year : "", alias: alias };
  }

  function fillIdentity(box, person, lang) {
    const name = document.createElement("h2");
    name.className = "name";
    name.textContent = displayName(person, lang);
    box.append(name);
    const life = lifeText(person, lang);
    if (life) {
      const line = document.createElement("p");
      line.className = "life";
      line.textContent = life;
      box.append(line);
    }
    const meta = metaText(person, lang);
    if (lang === "zh") {
      if (meta) {
        const line = document.createElement("p");
        line.className = "meta";
        line.textContent = meta;
        box.append(line);
      }
    } else {
      [meta.year, meta.alias].filter(Boolean).forEach((text) => {
        const line = document.createElement("p");
        line.className = "meta";
        line.textContent = text;
        box.append(line);
      });
    }
    return name;
  }

  function photoOf(person, options) {
    const frame = document.createElement("div");
    frame.className = "frame";
    const preferVideo = options && options.preferVideo;
    const videoUrl = preferVideo ? plain(person.exhibition_video) : "";
    if (videoUrl) {
      const video = document.createElement("video");
      video.src = videoUrl;
      video.muted = true;
      video.loop = true;
      video.autoplay = true;
      video.playsInline = true;
      video.setAttribute("playsinline", "");
      video.setAttribute("webkit-playsinline", "");
      video.preload = "metadata";
      video.draggable = false;
      if (person.exhibition_thumbnail) video.poster = person.exhibition_thumbnail;
      frame.append(video);
      const tryPlay = () => { video.play().catch(() => {}); };
      video.addEventListener("loadeddata", tryPlay, { once: true });
      tryPlay();
      return frame;
    }
    const photo = document.createElement("img");
    photo.alt = "";
    photo.draggable = false;
    photo.src = person.exhibition_thumbnail || "";
    frame.append(photo);
    return frame;
  }

  function pill(label, className, onClick) {
    const el = document.createElement("button");
    el.type = "button";
    el.className = "pill " + className;
    el.textContent = label;
    el.addEventListener("click", onClick);
    return el;
  }

  function arrow(direction, label, onClick) {
    const el = document.createElement("button");
    el.type = "button";
    el.className = "arrow " + direction;
    el.setAttribute("aria-label", label);
    el.innerHTML = direction === "prev"
      ? '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M14.8 4.8 L7.2 12 L14.8 19.2" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg>'
      : '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9.2 4.8 L16.8 12 L9.2 19.2" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg>';
    el.addEventListener("click", onClick);
    return el;
  }

  function mountRail(scroller) {
    const rail = document.createElement("div");
    rail.className = "rail";
    const thumb = document.createElement("div");
    thumb.className = "thumb";
    thumb.innerHTML = '<i class="up"></i><i class="down"></i>';
    rail.append(thumb);
    let dragging = false;

    function metrics() {
      const max = Math.max(0, scroller.scrollHeight - scroller.clientHeight);
      const span = rail.clientHeight || 1;
      const ratio = scroller.clientHeight / Math.max(scroller.scrollHeight, 1);
      const size = Math.max(span * 0.28, Math.min(span * 0.62, span * Math.max(ratio, 0.28)));
      const travel = Math.max(1, span - size);
      return { max: max, size: size, travel: travel };
    }

    function place() {
      if (dragging) return;
      const box = metrics();
      thumb.style.height = box.size + "px";
      thumb.style.top = (box.max > 0 ? (scroller.scrollTop / box.max) * box.travel : 0) + "px";
    }

    function moveThumb(top) {
      const box = metrics();
      const next = Math.max(0, Math.min(box.travel, top));
      thumb.style.height = box.size + "px";
      thumb.style.top = next + "px";
      scroller.scrollTop = box.max > 0 ? (next / box.travel) * box.max : 0;
    }

    thumb.addEventListener("pointerdown", (event) => {
      dragging = true;
      thumb.setPointerCapture(event.pointerId);
      const startY = event.clientY;
      const startTop = parseFloat(thumb.style.top) || 0;
      function onMove(ev) {
        moveThumb(startTop + (ev.clientY - startY));
      }
      function onUp(ev) {
        dragging = false;
        try { thumb.releasePointerCapture(ev.pointerId); } catch (error) { /* ignore */ }
        thumb.removeEventListener("pointermove", onMove);
        thumb.removeEventListener("pointerup", onUp);
        thumb.removeEventListener("pointercancel", onUp);
        place();
      }
      thumb.addEventListener("pointermove", onMove);
      thumb.addEventListener("pointerup", onUp);
      thumb.addEventListener("pointercancel", onUp);
      event.preventDefault();
      event.stopPropagation();
    });

    rail.addEventListener("pointerdown", (event) => {
      if (event.target === thumb || thumb.contains(event.target)) return;
      const box = metrics();
      const rect = rail.getBoundingClientRect();
      moveThumb(event.clientY - rect.top - box.size / 2);
    });

    scroller.addEventListener("scroll", place, { passive: true });
    requestAnimationFrame(place);
    return rail;
  }

  function heading(meta, lang) {
    const title = document.createElement("h1");
    title.className = "title";
    title.textContent = lang === "zh" ? meta.zh : meta.en.toUpperCase();
    return title;
  }

  window.Alumni = {
    CATS: CATS,
    COPY: COPY,
    intro: function (cat, lang) {
      const item = INTRO[cat];
      return item && item[lang] ? item[lang].slice() : [];
    },
    plain: plain,
    fillBio: fillBio,
    people: people,
    problem: problem,
    load: load,
    fillIdentity: fillIdentity,
    photoOf: photoOf,
    pill: pill,
    arrow: arrow,
    mountRail: mountRail,
    heading: heading
  };
})();

const $ = (sel) => document.querySelector(sel);

function escapeHtml(text) {
  const span = document.createElement("span");
  span.textContent = text;
  return span.innerHTML;
}

// Base64 -> UTF-8 字符串（避免中文/特殊字符在构建时丢失）
function decodeBase64Utf8(b64) {
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new TextDecoder("utf-8").decode(bytes);
}

function categorize(name) {
  const n = name.toLowerCase();
  // 周历设计等含「设计」但不应进策划案，需优先判断
  if (n.includes("周历")) return "其它";
  if (n.includes("拆解")) return "拆解案";
  if (n.includes("复盘") || n.includes("分析")) return "拆解案";
  if (n.includes("策划") || n.includes("方案") || n.includes("设计")) return "策划案";
  return "其它";
}

function normalize(s) {
  return (s || "").toString().trim().toLowerCase();
}

function fileUrl(filename) {
  // 关键点：文件名可能包含中文/特殊字符，所以使用 encodeURIComponent
  return `Data/${encodeURIComponent(filename)}`;
}

function extLabel(ext) {
  const e = (ext || "").toLowerCase();
  if (e === ".pdf") return "PDF";
  if (e) return e.replace(".", "").toUpperCase();
  return "文件";
}

async function main() {
  const searchEl = $("#search");
  const listEl = $("#list");
  const metaEl = $("#meta");
  const sideCatsEl = $("#sideCats");

  const modalEl = $("#modal");
  const closeBtn = $("#closeModal");
  const previewFrame = $("#previewFrame");
  const downloadLink = $("#downloadLink");

  function openModal({ url, title, filename }) {
    previewFrame.src = url;
    downloadLink.href = url;
    downloadLink.textContent = `打开原文件：${filename}`;
    modalEl.hidden = false;
    closeBtn.focus();
  }

  function closeModal() {
    previewFrame.src = "about:blank";
    modalEl.hidden = true;
  }

  closeBtn.addEventListener("click", closeModal);
  modalEl.addEventListener("click", (e) => {
    // 点击背景区域关闭
    const target = e.target;
    if (target && target.classList && target.classList.contains("modal-backdrop")) closeModal();
  });

  const manifest = await (await fetch("./manifest.json", { cache: "no-store" })).json();
  const items = (manifest.items || []).map((it) => {
    const filename = decodeBase64Utf8(it.nameB64);
    return {
      filename,
      title: filename.replace(/\.[^/.]+$/, ""),
      ext: it.ext || filename.split(".").pop().toLowerCase(),
      size: it.size,
      lastWriteTime: it.lastWriteTime,
      category: categorize(filename),
    };
  });

  let activeCategory = "all";

  function syncActiveUI() {
    if (!sideCatsEl) return;
    const buttons = Array.from(sideCatsEl.querySelectorAll(".cat-item"));
    for (const b of buttons) {
      b.classList.toggle("active", b.dataset.cat === activeCategory);
    }
  }

  function makeCatItem(cat, label, count) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "cat-item";
    btn.dataset.cat = cat;

    const left = document.createElement("span");
    left.textContent = label;

    const badge = document.createElement("span");
    badge.className = "cat-count";
    badge.textContent = String(count ?? 0);

    btn.appendChild(left);
    btn.appendChild(badge);

    btn.addEventListener("click", () => {
      activeCategory = cat;
      syncActiveUI();
      applyFilter();
    });

    return btn;
  }

  function formatSize(bytes) {
    if (!Number.isFinite(bytes)) return "";
    const kb = bytes / 1024;
    if (kb < 1024) return `${kb.toFixed(1)} KB`;
    const mb = kb / 1024;
    return `${mb.toFixed(1)} MB`;
  }

  function render(filtered) {
    if (!filtered.length) {
      listEl.innerHTML = `<div class="notice">没有匹配的文件。你可以换个关键词试试。</div>`;
      metaEl.textContent = "";
      return;
    }

    const frag = document.createDocumentFragment();
    for (const item of filtered) {
      const el = document.createElement("article");
      el.className = "row-item";
      const url = fileUrl(item.filename);

      const iconText = item.ext === ".pdf" || item.ext === "pdf" ? "📄" : "📁";
      const updated = Number.isFinite(item.lastWriteTime)
        ? new Date(item.lastWriteTime).toLocaleDateString("zh-CN", { year: "numeric", month: "2-digit", day: "2-digit" })
        : "";

      const sizeText = item.size ? formatSize(item.size) : "";

      el.innerHTML = `
        <div class="row-left">
          <div class="row-ico" aria-hidden="true">${iconText}</div>
          <div style="min-width:0">
            <div class="row-title">${escapeHtml(item.title)}</div>
            <div class="row-sub">
              <span>${escapeHtml(item.category)}</span>
              <span>·</span>
              <span>${escapeHtml(extLabel(item.ext))}</span>
              ${sizeText ? `<span>·</span><span>${escapeHtml(sizeText)}</span>` : ""}
              ${updated ? `<span>·</span><span>更新 ${escapeHtml(updated)}</span>` : ""}
            </div>
            <div class="row-filename" title="${escapeHtml(item.filename)}">${escapeHtml(item.filename)}</div>
          </div>
        </div>
        <div class="row-actions">
          <button class="btn btn-primary" type="button" data-action="preview">预览</button>
          <a class="btn" href="${url}" target="_blank" rel="noopener noreferrer" data-action="open">打开</a>
        </div>
      `;

      const previewBtn = el.querySelector('[data-action="preview"]');
      previewBtn.addEventListener("click", () => {
        openModal({ url, title: item.title, filename: item.filename });
      });

      frag.appendChild(el);
    }
    listEl.innerHTML = "";
    listEl.appendChild(frag);

    metaEl.textContent = activeCategory === "all" ? `共 ${filtered.length} 个文档` : `分类：${activeCategory} · 共 ${filtered.length} 个文档`;
  }

  function applyFilter() {
    const q = normalize(searchEl.value);
    const c = activeCategory;

    const filtered = items.filter((it) => {
      const byCat = c === "all" ? true : it.category === c;
      if (!byCat) return false;
      if (!q) return true;
      return normalize(it.filename).includes(q) || normalize(it.title).includes(q) || normalize(it.category).includes(q);
    });
    render(filtered);
  }

  searchEl.addEventListener("input", () => {
    // 轻量防抖：避免输入过快导致渲染抖动
    window.clearTimeout(applyFilter._t);
    applyFilter._t = window.setTimeout(applyFilter, 120);
  });

  // 构建左侧分类导航
  if (sideCatsEl) {
    sideCatsEl.innerHTML = "";
    const countByCat = new Map();
    for (const it of items) countByCat.set(it.category, (countByCat.get(it.category) || 0) + 1);

    const allCount = items.length;
    sideCatsEl.appendChild(makeCatItem("all", "全部", allCount));

    const categories = Array.from(countByCat.keys()).sort((a, b) => a.localeCompare(b, "zh"));
    for (const c of categories) {
      sideCatsEl.appendChild(makeCatItem(c, c, countByCat.get(c)));
    }

    syncActiveUI();
  }

  // 首次渲染
  applyFilter();
}

main().catch((err) => {
  console.error(err);
  const listEl = document.querySelector("#list");
  if (listEl) listEl.innerHTML = `<div class="notice">加载失败：${escapeHtml(err?.message || String(err))}</div>`;
});


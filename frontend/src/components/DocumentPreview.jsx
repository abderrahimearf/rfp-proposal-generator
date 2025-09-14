// src/components/DocumentPreview.jsx
import React, { useEffect, useMemo, useState, useRef } from "react";
import DOMPurify from "dompurify";
import { createPortal } from "react-dom";

/* ===== TinyMCE ===== */
import { Editor } from "@tinymce/tinymce-react";
import tinymce from "tinymce/tinymce";
import "tinymce/icons/default";
import "tinymce/themes/silver";
import "tinymce/plugins/advlist";
import "tinymce/plugins/autolink";
import "tinymce/plugins/lists";
import "tinymce/plugins/link";
import "tinymce/plugins/image";
import "tinymce/plugins/charmap";
import "tinymce/plugins/preview";
import "tinymce/plugins/anchor";
import "tinymce/plugins/searchreplace";
import "tinymce/plugins/visualblocks";
import "tinymce/plugins/code";
import "tinymce/plugins/fullscreen";
import "tinymce/plugins/insertdatetime";
import "tinymce/plugins/media";
import "tinymce/plugins/table";
import "tinymce/plugins/help";
import "tinymce/plugins/wordcount";
import "tinymce/plugins/quickbars";
import "tinymce/plugins/emoticons";
import "tinymce/plugins/emoticons/js/emojis";
import "tinymce/plugins/imagetools";
import "tinymce/skins/ui/oxide/skin.min.css";
import "tinymce/skins/content/default/content.min.css";

/* ===== Supabase & Auth ===== */
import { supabase } from "../api/auth";
import { useAuth } from "../auth/AuthContext";

/* ----------------- Constantes ----------------- */
const PROPOSITIONS_BUCKET = "propositions";
const DOCX_MIME =
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

const PAGE_PADDING = 15;
const HEADER_LABEL_FONT_PX = 13;
const HEADER_VALUE_FONT_PX = 13;
const HEADER_LINE_HEIGHT = 1.25;

/** URL backend robuste */
function getBackendUrl() {
  const envUrl =
    (typeof import.meta !== "undefined" &&
      import.meta.env &&
      import.meta.env.VITE_BACKEND_URL) ||
    (typeof process !== "undefined" &&
      process.env &&
      process.env.REACT_APP_BACKEND_URL) ||
    (typeof window !== "undefined" && window.__BACKEND_URL__) ||
    "";

  const raw = String(envUrl || "").trim();
  if (!raw) {
    throw new Error(
      "Backend non configuré (VITE_BACKEND_URL / REACT_APP_BACKEND_URL / window.__BACKEND_URL__)."
    );
  }
  const url = raw.replace(/\/+$/, "");
  const isHttpsPage =
    typeof window !== "undefined" &&
    window.location &&
    window.location.protocol === "https:";
  const isLocalBackend =
    /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i.test(url);
  if (isHttpsPage && url.startsWith("http://") && !isLocalBackend) {
    throw new Error(
      "Mixed content: l'app est en HTTPS mais le backend est en HTTP. Servez le backend en HTTPS ou utilisez un reverse proxy."
    );
  }
  return url;
}

/* ----------------- CSS ----------------- */
/* ⚠️ Grille passée de 5 à 4 colonnes (on retire la cellule “Secteur” côté aperçu) */
const HEADER_CSS = `
  .hdr-boxes{display:grid;grid-template-columns:repeat(4,1fr);border:1px solid #cbd5e1;border-radius:10px;overflow:hidden;background:#fff;}
  .hdr-cell{display:grid;grid-template-rows:auto auto;align-items:start;gap:2px;padding:6px 8px;border-right:1px solid #cbd5e1;background:#fff;}
  .hdr-cell:last-child{border-right:none;}
  .hdr-label{font-size:${HEADER_LABEL_FONT_PX}px;font-weight:700;color:#0f172a;line-height:1.1;margin:0;}
  .hdr-value{width:100%;display:block;font-size:${HEADER_VALUE_FONT_PX}px;line-height:${HEADER_LINE_HEIGHT};color:#111827;background:transparent;border:none;outline:none;padding:0;margin:0;white-space:pre-wrap;word-break:break-word;overflow-wrap:anywhere;min-height:0;}
  textarea.hdr-value{resize:none;overflow:hidden;}
  .hdr-divider{height:1px;background:#111;margin:8px 0 10px;}
  @media (max-width:980px){
    .hdr-boxes{grid-template-columns:repeat(2,1fr);}
    .hdr-cell:nth-child(2n){border-right:none;}
    .hdr-cell{border-bottom:1px solid #cbd5e1;}
    .hdr-cell:nth-last-child(-n+2){border-bottom:none;}
  }
`;

const EDITOR_CONTENT_CSS = `
  img{max-width:100%;height:auto;}
  figure.image{display:inline-block;margin:0 0 1em 0;}
  figure.image img{display:block;}
  figure.image figcaption{text-align:center;font-size:0.875rem;color:#374151;}
  img.align-left,figure.image.align-left{float:left;margin:0 1em 1em 0;}
  img.align-right,figure.image.align-right{float:right;margin:0 0 1em 1em;}
  img.align-center,figure.image.align-center{display:block;margin:0 auto 1em;float:none;}
  p::after,div::after{content:"";display:block;clear:both;}
`;

/* >>> UI additionnelle : bouton + modale compacte */
const EXTRA_UI_CSS = `
  .btn-save{
    background:#2563eb;border:none;color:#fff;border-radius:8px;padding:8px 12px;font-weight:600;
    display:inline-flex;align-items:center;gap:8px;transition:transform .12s ease, box-shadow .12s ease, background .12s ease;cursor:pointer;
  }
  .btn-save:hover{ background:#1e40af; box-shadow:0 6px 14px rgba(30,64,175,.28); transform:translateY(-1px); }
  .btn-save:active{ transform:none; box-shadow:0 2px 6px rgba(30,64,175,.2); }
  .btn-save:disabled{ opacity:.7; cursor:not-allowed; box-shadow:none; transform:none; }

  .confirm-modal{ font-size:13px; }
  .confirm-modal h3{ font-size:16px; margin:0 0 6px; }
  .confirm-modal p.muted{ font-size:12px; margin:0 0 10px; color:#64748b; }
  .confirm-modal label{ font-size:12px; }
  .confirm-modal .input, .confirm-modal select{ font-size:13px; padding:8px 10px; }
`;

/* ----------------- Helpers ----------------- */
const stripLeadingNumbering = (name = "") =>
  name.replace(/^\s*\d+\s*[\.\)\-]\s*/, "").trim();

const escapeHtml = (s = "") =>
  s
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");

const toHexIfRgb = (val = "") => {
  const m = val.match(
    /rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)(?:\s*,\s*([.\d]+))?\s*\)/i
  );
  if (!m) return val;
  const alpha = m[4] !== undefined ? parseFloat(m[4]) : 1;
  if (alpha === 0) return "transparent";
  const h = (n) => ("0" + Number(n).toString(16)).slice(-2).toUpperCase();
  return `#${h(m[1])}${h(m[2])}${h(m[3])}`;
};

/* Normalise l’alignement des images pour Word */
const normalizeImgAlign = (html = "") => {
  const doc = new DOMParser().parseFromString(
    `<div id="r">${html}</div>`,
    "text/html"
  );
  const root = doc.getElementById("r");
  if (!root) return html;

  const handle = (img) => {
    const raw = (img.getAttribute("style") || "")
      .toLowerCase()
      .replace(/\s+/g, "");
    const p = img.parentElement;
    if (!p) return;

    const set = (side) => {
      p.style.textAlign = side;
      img.style.display = "inline-block";
      img.style.setProperty("float", "none");
      if (side === "center") {
        img.style.marginLeft = "auto";
        img.style.marginRight = "auto";
      } else {
        img.style.marginLeft = "";
        img.style.marginRight = "";
      }
    };

    if (raw.includes("float:right")) set("right");
    else if (raw.includes("float:left")) set("left");
    else if (
      raw.includes("margin-left:auto") &&
      raw.includes("margin-right:auto")
    )
      set("center");
  };

  root.querySelectorAll("img").forEach(handle);
  root.querySelectorAll("figure img").forEach(handle);

  return root.innerHTML;
};

/* Inline styles calculés (évite les fonds transparents) */
const inlineComputedStyles = (html = "", extraCss = "") => {
  const host = document.createElement("div");
  host.style.cssText =
    "position:fixed;left:-99999px;top:0;visibility:hidden;pointer-events:none;";
  host.innerHTML = `<style>${extraCss}</style><div id="wrap">${html}</div>`;
  document.body.appendChild(host);
  const wrap = host.querySelector("#wrap");

  const props = [
    "color","backgroundColor","fontFamily","fontSize","fontStyle","fontWeight","textDecorationLine","lineHeight","textAlign",
    "marginTop","marginBottom","marginLeft","marginRight","paddingTop","paddingBottom","paddingLeft","paddingRight",
    "borderTopColor","borderTopStyle","borderTopWidth","borderRightColor","borderRightStyle","borderRightWidth",
    "borderBottomColor","borderBottomStyle","borderBottomWidth","borderLeftColor","borderLeftStyle","borderLeftWidth","borderCollapse",
  ];

  wrap.querySelectorAll("*").forEach((el) => {
    const cs = getComputedStyle(el);
    const style = el.getAttribute("style") || "";
    const map = new Map(
      style.split(";").filter(Boolean).map((s) => {
        const [k, ...r] = s.split(":");
        return [k.trim(), r.join(":").trim()];
      })
    );

    props.forEach((p) => {
      let v = cs[p];
      if (!v || v === "initial" || v === "normal" || v === "none") return;
      if (p === "backgroundColor") {
        if (v === "transparent" || /rgba\(.+,0\)/i.test(v)) return;
        v = toHexIfRgb(v);
      } else if (p.includes("Color")) {
        v = toHexIfRgb(v);
      }
      if (p === "fontWeight" && Number(v) >= 600) v = "bold";
      if (p === "textDecorationLine" && v !== "none") {
        map.set("text-decoration", v);
        return;
      }
      map.set(p.replace(/[A-Z]/g, (m) => "-" + m.toLowerCase()), v);
    });

    if (el.tagName === "IMG") {
      const img = el;
      if (!img.getAttribute("width") && img.naturalWidth)
        map.set("width", `${img.naturalWidth}px`);
      if (!img.getAttribute("height") && img.naturalHeight)
        map.set("height", `${img.naturalHeight}px`);
      if (!map.has("display")) map.set("display", "inline-block");
    }

    const inlined = Array.from(map.entries())
      .map(([k, v]) => `${k}:${v}`)
      .join(";");
    el.setAttribute("style", inlined);
  });

  const out = wrap.innerHTML;
  document.body.removeChild(host);
  return out;
};

/* ===== Auto-grow Textarea pour le header ===== */
function AutoGrowTextArea({
  value,
  onChange,
  className = "hdr-value",
  readOnly = false,
  placeholder = "",
  ariaLabel,
}) {
  const ref = useRef(null);

  const resize = () => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
    el.style.overflowY = "hidden";
  };

  useEffect(() => {
    resize();
  }, [value]);

  useEffect(() => {
    const handler = () => resize();
    window.addEventListener("resize", handler);
    return () => window.removeEventListener("resize", handler);
  }, []);

  return (
    <textarea
      ref={ref}
      rows={1}
      className={className}
      value={value}
      onChange={(e) => {
        onChange?.(e);
        const el = ref.current;
        if (!el) return;
        el.style.height = "auto";
        el.style.height = `${el.scrollHeight}px`;
      }}
      readOnly={readOnly}
      placeholder={placeholder}
      aria-label={ariaLabel}
    />
  );
}

/* ====================================================== */

export default function DocumentPreview({
  doc,
  loading = false,
  error = null,
  onDocUpdate,
  onGenerate,
  isGenerating = false,
  companyName = "",
}) {
  const { session } = useAuth();
  const user = session?.user || null;

  const [mode, setMode] = useState("preview");
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState(null);
  const [draftHtml, setDraftHtml] = useState("");
  const prevModeRef = useRef(mode);
  const editorRef = useRef(null);

  // Métadonnées visibles en haut (SECTEUR conservé en state mais non affiché en header)
  const [header, setHeader] = useState({
    societe: companyName || "",
    date: new Date().toISOString().slice(0, 10),
    projet: "",
    destinataire: "", // = Client
    secteur: "",      // ← gardé pour la sauvegarde/back
  });

  // UI: confirmation + bannière
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [savingProp, setSavingProp] = useState(false);
  const [saveError, setSaveError] = useState(null);
  const [banner, setBanner] = useState(null);

  // Champs éditables dans la modale (on garde “secteur” ici)
  const [confirmData, setConfirmData] = useState({
    projet: "",
    date: "",
    destinataire: "",
    secteur: "",
    statut: "en_cours",
    taille: "Startup",
  });

  // Dernier document pour préremplir
  const [lastDocMeta, setLastDocMeta] = useState(null);
  useEffect(() => {
    const run = async () => {
      if (!user?.id) {
        setLastDocMeta(null);
        return;
      }
      const { data, error } = await supabase
        .from("documents")
        .select("nom, client, secteur, created_at")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (!error && data) {
        setLastDocMeta(data);
        setHeader((h) => ({
          ...h,
          projet: h.projet || data.nom || "",
          destinataire: h.destinataire || data.client || "",
          secteur: h.secteur || data.secteur || "",
        }));
      }
    };
    run();
  }, [user?.id]);

  useEffect(() => {
    setHeader((h) => ({ ...h, societe: companyName || "" }));
  }, [companyName]);

  const makeFilename = (base, ext) => {
    const safe =
      (base || "document").replace(/[^\p{L}\p{N}\-_. ]/gu, "").trim() ||
      "document";
    const stamp = new Date().toISOString().slice(0, 10);
    return `${safe}-${stamp}.${ext}`;
  };

  const removeDuplicateFirstHeading = (html) => html;

  const buildHTML = (d) => {
    if (!d) return "";
    const sections = Array.isArray(d.sections) ? d.sections : [];
    return sections
      .map((s) => {
        const nameClean = stripLeadingNumbering(s?.name ?? "");
        const safeBody = DOMPurify.sanitize((s?.content ?? "").toString(), {
          USE_PROFILES: { html: true },
        });
        const bodyDedup = removeDuplicateFirstHeading(safeBody, nameClean);
        const title = nameClean ? `<h2>${nameClean}</h2>` : "";
        return (title || bodyDedup)
          ? `${title}${bodyDedup ? `\n${bodyDedup}` : ""}`
          : "";
      })
      .join("\n\n")
      .trim();
  };

  const htmlFromDoc = useMemo(() => buildHTML(doc), [doc]);
  useEffect(() => setDraftHtml(htmlFromDoc), [htmlFromDoc]);

  useEffect(() => {
    if (prevModeRef.current === "edit" && mode === "preview")
      onDocUpdate?.(draftHtml);
    prevModeRef.current = mode;
  }, [mode, draftHtml, onDocUpdate]);

  /* ===================== EXPORT DOCX ===================== */

  /* ⚠️ Ici on a retiré la cellule “Secteur” du tableau d’entête exporté (4 colonnes à 25%).
     Le champ secteur est toujours utilisé en backend, mais plus imprimé dans le DOCX. */
  const buildExportHtml = (bodyHtml, hdr) => {
    const headerHtml = `
      <table style="width:100%; border-collapse:collapse; border:1px solid #cbd5e1; font-family:sans-serif;">
        <tbody>
          <tr>
            <td style="width:25%; padding:6px 8px; border-right:1px solid #cbd5e1; vertical-align:top;">
              <p style="font-size:${HEADER_LABEL_FONT_PX}px; font-weight:700; color:#0f172a; line-height:1.1; margin:0 0 2px 0;">Entreprise :</p>
              <div style="font-size:${HEADER_VALUE_FONT_PX}px; line-height:${HEADER_LINE_HEIGHT}; color:#111827;">${escapeHtml(
                hdr.societe || ""
              )}</div>
            </td>
            <td style="width:25%; padding:6px 8px; border-right:1px solid #cbd5e1; vertical-align:top;">
              <p style="font-size:${HEADER_LABEL_FONT_PX}px; font-weight:700; color:#0f172a; line-height:1.1; margin:0 0 2px 0;">Date :</p>
              <div style="font-size:${HEADER_VALUE_FONT_PX}px; line-height:${HEADER_LINE_HEIGHT}; color:#111827;">${escapeHtml(
                hdr.date || ""
              )}</div>
            </td>
            <td style="width:25%; padding:6px 8px; border-right:1px solid #cbd5e1; vertical-align:top;">
              <p style="font-size:${HEADER_LABEL_FONT_PX}px; font-weight:700; color:#0f172a; line-height:1.1; margin:0 0 2px 0;">Projet :</p>
              <div style="font-size:${HEADER_VALUE_FONT_PX}px; line-height:${HEADER_LINE_HEIGHT}; color:#111827;">${escapeHtml(
                hdr.projet || ""
              )}</div>
            </td>
            <td style="width:25%; padding:6px 8px; vertical-align:top;">
              <p style="font-size:${HEADER_LABEL_FONT_PX}px; font-weight:700; color:#0f172a; line-height:1.1; margin:0 0 2px 0;">Destinataire :</p>
              <div style="font-size:${HEADER_VALUE_FONT_PX}px; line-height:${HEADER_LINE_HEIGHT}; color:#111827;">${escapeHtml(
                hdr.destinataire || ""
              )}</div>
            </td>
          </tr>
        </tbody>
      </table>
      <hr style="border:none; border-top:1px solid #111; margin:8px 0 10px;" />
    `;

    const safeBody = DOMPurify.sanitize(bodyHtml || "", {
      USE_PROFILES: { html: true },
      ADD_ATTR: ["style", "class"],
      ADD_TAGS: ["figure", "figcaption"],
    });
    const normalized = normalizeImgAlign(safeBody);
    const joined = `${headerHtml}${normalized}`;
    const inlined = inlineComputedStyles(joined, EDITOR_CONTENT_CSS);

    return `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <title>Document</title>
  <style>body{margin:0;background:#ffffff;}</style>
</head>
<body>
  ${inlined}
</body>
</html>`;
  };

  const loadScript = (src) =>
    new Promise((resolve, reject) => {
      const s = document.createElement("script");
      s.src = src;
      s.async = true;
      s.onload = () => resolve();
      s.onerror = (e) => reject(e);
      document.head.appendChild(s);
    });

  const makeDocxBlob = async (fullHtml) => {
    try {
      const { default: HTMLtoDOCX } = await import("@turbodocx/html-to-docx");
      const buffer = await HTMLtoDOCX(fullHtml);
      return new Blob([buffer], { type: DOCX_MIME });
    } catch {
      await loadScript("https://unpkg.com/html-docx-js/dist/html-docx.js");
      return window.htmlDocx.asBlob(fullHtml);
    }
  };

  const exportAsDocx = async () => {
    const currentHtml =
      mode === "edit" && editorRef.current
        ? editorRef.current.getContent()
        : draftHtml;
    if (!(currentHtml || "").trim()) throw new Error("Le document est vide.");

    const fullHtml = buildExportHtml(currentHtml, header);
    const blob = await makeDocxBlob(fullHtml);
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = makeFilename(
      header.projet || doc?.name || "document",
      "docx"
    );
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  const handleExport = async () => {
    setExportError(null);
    setExporting(true);
    try {
      await exportAsDocx();
    } catch (e) {
      console.error(e);
      setExportError(e?.message || "Erreur pendant l'export");
    } finally {
      setExporting(false);
    }
  };

  /* ===================== CONFIRMER ===================== */
  const openConfirm = () => {
    setSaveError(null);
    setConfirmData({
      projet: header.projet || doc?.name || lastDocMeta?.nom || "",
      date: header.date || new Date().toISOString().slice(0, 10),
      destinataire: header.destinataire || lastDocMeta?.client || "",
      secteur: header.secteur || lastDocMeta?.secteur || "",
      statut: "en_cours",
      taille: "Startup",
    });
    setConfirmOpen(true);
  };

  /* ===================== SAUVEGARDER ===================== */

  // util retry simple
  async function fetchWithRetry(url, options, retries = 1) {
    try {
      const res = await fetch(url, options);
      if (!res.ok && res.status >= 500 && retries > 0) {
        await new Promise((r) => setTimeout(r, 1200));
        return fetchWithRetry(url, options, retries - 1);
      }
      return res;
    } catch (e) {
      if (retries > 0) {
        await new Promise((r) => setTimeout(r, 1200));
        return fetchWithRetry(url, options, retries - 1);
      }
      throw e;
    }
  }

  const saveProposition = async () => {
    setSaveError(null);
    setBanner(null);

    const { session } = useAuth();
    if (!user?.id || !user?.email) {
      setSaveError("Utilisateur non connecté.");
      setBanner({ type: "error", message: "Utilisateur non connecté." });
      return;
    }

    // Fusion header + modale
    const proposedHeader = {
      ...header,
      projet: (confirmData.projet ?? header.projet ?? "").toString().trim(),
      date:
        (confirmData.date ?? header.date ?? new Date().toISOString().slice(0, 10))
          .toString()
          .trim(),
      destinataire: (confirmData.destinataire ?? header.destinataire ?? "")
        .toString()
        .trim(),
    };

    if (!proposedHeader.destinataire) {
      setSaveError("Le champ Destinataire (Client) est requis.");
      setBanner({
        type: "error",
        message: "Renseignez le Destinataire (Client).",
      });
      return;
    }

    // ⚠️ On garde SECTEUR pour la sauvegarde (depuis modale/header/dernier doc)
    const secteurInput = (
      confirmData.secteur ||
      header.secteur ||
      lastDocMeta?.secteur ||
      ""
    )
      .toString()
      .trim();
    const secteur = secteurInput || "—";

    const currentHtml =
      mode === "edit" && editorRef.current
        ? editorRef.current.getContent()
        : draftHtml;

    onDocUpdate?.(currentHtml);

    const nom =
      (proposedHeader.projet ||
        doc?.name ||
        lastDocMeta?.nom ||
        "Proposition").toString();
    const date_proposition =
      proposedHeader.date || new Date().toISOString().slice(0, 10);
    const client = proposedHeader.destinataire;

    const statut = confirmData.statut || "en_cours";
    const taille = confirmData.taille || "Startup";
    const budget = null;

    setSavingProp(true);
    let uploadedPath = null;

    try {
      // 1) DOCX (le tableau header n'affiche plus secteur, mais ce n'est pas grave)
      const fullHtml = buildExportHtml(currentHtml || "", {
        ...proposedHeader,
        secteur,
      });
      const blob = await makeDocxBlob(fullHtml);
      const filename = makeFilename(nom, "docx");
      let file;
      try {
        file = new File([blob], filename, { type: DOCX_MIME });
      } catch {
        file = blob;
        file.name = filename;
        file.type = DOCX_MIME;
      }

      // 2) Upload storage
      const filePath = `${user.id}/${Date.now()}_${filename}`;
      const { error: upErr } = await supabase.storage
        .from(PROPOSITIONS_BUCKET)
        .upload(filePath, file);
      if (upErr) throw new Error(`Upload storage: ${upErr.message}`);
      uploadedPath = filePath;

      // 3) Insert DB (on enregistre toujours secteur)
      const { error: dbErr } = await supabase.from("propositions").insert({
        user_id: user.id,
        nom_document: nom,
        client,
        secteur,
        date_proposition,
        statut,
        taille,
        budget,
        storage_path: filePath,
        file_name: filename,
        mime_type: file.type ?? null,
        size_bytes: file.size ?? null,
      });
      if (dbErr) {
        try {
          await supabase.storage
            .from(PROPOSITIONS_BUCKET)
            .remove([uploadedPath]);
        } catch {}
        throw new Error(`Insertion DB: ${dbErr.message}`);
      }

      // 4) Indexation backend — conserve ta logique
      const backendUrl = getBackendUrl();
      const { data: sess } = await supabase.auth.getSession();
      const token = sess?.session?.access_token;

      const tryFormDataOnce = async () => {
        const formData = new FormData();
        formData.append("file", file);
        formData.append("email", user.email);
        formData.append("file_name", filename);
        formData.append("storage_path", uploadedPath || "");
        formData.append("client", client);
        formData.append("secteur", secteur);
        formData.append("date_proposition", date_proposition || "");

        const ctrl = new AbortController();
        const timeout = setTimeout(() => ctrl.abort(), 60000);

        try {
          const res = await fetchWithRetry(
            `${backendUrl}/api/stock-prop`,
            {
              method: "POST",
              body: formData,
              signal: ctrl.signal,
              headers: token ? { Authorization: `Bearer ${token}` } : undefined,
            },
            1
          );
          clearTimeout(timeout);
          return res;
        } catch (e) {
          clearTimeout(timeout);
          throw e;
        }
      };

      let res = await tryFormDataOnce();

      if (!res.ok && [413, 415, 422].includes(res.status)) {
        const { data: signed, error: signErr } = await supabase
          .storage.from(PROPOSITIONS_BUCKET)
          .createSignedUrl(filePath, 60 * 60);
        if (signErr) throw new Error(`URL signée impossible: ${signErr.message}`);

        const ctrl = new AbortController();
        const timeout = setTimeout(() => ctrl.abort(), 60000);

        try {
          res = await fetchWithRetry(
            `${backendUrl}/api/stock-prop`,
            {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                ...(token ? { Authorization: `Bearer ${token}` } : {}),
              },
              body: JSON.stringify({
                file_url: signed.signedUrl,
                storage_path: uploadedPath,
                file_name: filename,
                user_id: user.id,
                email: user.email,
                client,
                secteur,
                date_proposition,
                metadata: {
                  mime_type: file.type ?? null,
                  size_bytes: file.size ?? null,
                },
              }),
              signal: ctrl.signal,
            },
            1
          );
          clearTimeout(timeout);
        } catch (e) {
          clearTimeout(timeout);
          throw e;
        }
      }

      if (!res.ok) {
        const txt = await res.text().catch(() => "");
        throw new Error(`Indexation Weaviate: ${res.status} ${txt}`);
      }

      try {
        await supabase
          .from("propositions")
          .update({ indexed: true })
          .eq("user_id", user.id)
          .eq("storage_path", uploadedPath);
      } catch {}

      setBanner({
        type: "success",
        message: "Proposition créée et indexée avec succès ✅",
      });
      setConfirmOpen(false);
      setHeader({ ...proposedHeader, secteur });
    } catch (e) {
      console.error(e);
      setSaveError(e?.message || String(e));
      setBanner({
        type: "error",
        message: `Échec de la création : ${e?.message || e}`,
      });
    } finally {
      setSavingProp(false);
      setTimeout(() => setBanner(null), 4000);
    }
  };

  /* ===================== TinyMCE ===================== */
  const tinymceInit = {
    skin: false,
    content_css: false,
    height: 500,
    menubar: false,
    branding: false,
    plugins: [
      "preview",
      "searchreplace",
      "autolink",
      "code",
      "visualblocks",
      "fullscreen",
      "image",
      "link",
      "media",
      "table",
      "charmap",
      "insertdatetime",
      "advlist",
      "lists",
      "wordcount",
      "anchor",
      "help",
      "quickbars",
      "emoticons",
      "imagetools",
    ],
    toolbar:
      "undo redo | blocks fontfamily fontsize | bold italic underline strikethrough | forecolor backcolor | alignleft aligncenter alignright alignjustify | bullist numlist outdent indent | image media table | removeformat | code fullscreen preview | help",
    quickbars_selection_toolbar:
      "bold italic | quicklink blockquote | bullist numlist | h2 h3",
    quickbars_insert_toolbar: "image media table",
    object_resizing: "img",
    image_dimensions: true,
    image_caption: true,
    imagetools_toolbar:
      "rotateleft rotateright | flipv fliph | editimage imageoptions",
    image_class_list: [
      { title: "Défaut", value: "" },
      { title: "Gauche (habillage)", value: "align-left" },
      { title: "Droite (habillage)", value: "align-right" },
      { title: "Centré", value: "align-center" },
    ],
    content_style: EDITOR_CONTENT_CSS,
    automatic_uploads: true,
    paste_data_images: true,
    file_picker_types: "image",
    images_upload_handler: (blobInfo) =>
      new Promise((resolve) => {
        const mime = blobInfo.blob().type || "image/png";
        resolve(`data:${mime};base64,${blobInfo.base64()}`);
      }),
    file_picker_callback: (cb, _value, meta) => {
      if (meta.filetype !== "image") return;
      const input = document.createElement("input");
      input.type = "file";
      input.accept = "image/*";
      input.onchange = () => {
        const file = input.files && input.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = () => cb(reader.result, { title: file.name });
        reader.readAsDataURL(file);
      };
      input.click();
    },
    default_link_target: "_blank",
    link_assume_external_targets: true,
    convert_urls: false,
  };

  return (
    <div
      className="document-preview"
      style={{ display: "flex", flexDirection: "column", height: "100%" }}
    >
      <style dangerouslySetInnerHTML={{ __html: HEADER_CSS }} />
      <style dangerouslySetInnerHTML={{ __html: EXTRA_UI_CSS }} />

      {/* Toolbar */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "flex-end",
          gap: 10,
          padding: "8px 12px",
          background: "#fff",
          borderBottom: "1px solid #eaeaea",
          flexShrink: 0,
        }}
      >
        <button
          type="button"
          onClick={() => setMode((m) => (m === "preview" ? "edit" : "preview"))}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            fontSize: 14,
            background: "transparent",
            border: "none",
            cursor: "pointer",
            padding: 6,
          }}
          disabled={exporting || savingProp}
        >
          <svg width="18" height="18" viewBox="0 0 24 24">
            <path
              fill="currentColor"
              d="M12 5c-7 0-11 7-11 7s4 7 11 7 11-7 11-7-4-7-11-7zm0 12a5 5 0 1 1 0-10 5 5 0 0 1 0 10z"
            />
          </svg>
          {mode === "preview" ? "Editer" : "Aperçu"}
        </button>

        <button
          type="button"
          className="btn-save"
          disabled={exporting || savingProp}
          onClick={openConfirm}
          title="Sauvegarder et créer la proposition"
        >
          {savingProp ? "Sauvegarde..." : "Sauvegarder"}
        </button>

        <button
          type="button"
          onClick={onGenerate}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 8,
            fontSize: 14,
            fontWeight: 600,
            color: "#fff",
            background: "#16a34a",
            borderRadius: 8,
            padding: "8px 12px",
            cursor: exporting || isGenerating ? "not-allowed" : "pointer",
            opacity: exporting || isGenerating ? 0.7 : 1,
            border: "none",
          }}
          disabled={exporting || isGenerating || !onGenerate}
        >
          {isGenerating ? "Génération..." : "Générer"}
        </button>

        <button
          type="button"
          onClick={handleExport}
          style={{
            padding: "8px 12px",
            borderRadius: 8,
            border: "1px solid #ccc",
            fontSize: 14,
            cursor: exporting ? "not-allowed" : "pointer",
            backgroundColor: exporting ? "#f3f4f6" : "#fff",
          }}
          disabled={exporting}
        >
          {exporting ? "Export..." : "Exporter"}
        </button>
      </div>

      {/* Corps */}
      <div style={{ flex: 1, background: "#fff", overflow: "auto" }}>
        {loading && <div style={{ padding: "1rem" }}>Chargement...</div>}
        {error && !loading && (
          <div style={{ color: "crimson", padding: "1rem" }}>
            Erreur : {String(error)}
          </div>
        )}

        {!loading && !error && mode === "preview" && (
          <div style={{ padding: PAGE_PADDING }}>
            <div className="hdr-boxes">
              <div className="hdr-cell">
                <div className="hdr-label">Entreprise :</div>
                <AutoGrowTextArea
                  value={header.societe}
                  onChange={() => {}}
                  readOnly
                  ariaLabel="Entreprise"
                />
              </div>

              <div className="hdr-cell">
                <div className="hdr-label">Date :</div>
                <input
                  className="hdr-value"
                  type="date"
                  value={header.date}
                  onChange={(e) =>
                    setHeader((h) => ({ ...h, date: e.target.value }))
                  }
                  aria-label="Date"
                />
              </div>

              <div className="hdr-cell">
                <div className="hdr-label">Projet :</div>
                <AutoGrowTextArea
                  value={header.projet}
                  onChange={(e) =>
                    setHeader((h) => ({ ...h, projet: e.target.value }))
                  }
                  placeholder="Ex. Refonte du SI"
                  ariaLabel="Projet"
                />
              </div>

              <div className="hdr-cell">
                <div className="hdr-label">Destinataire :</div>
                <AutoGrowTextArea
                  value={header.destinataire}
                  onChange={(e) =>
                    setHeader((h) => ({ ...h, destinataire: e.target.value }))
                  }
                  placeholder="Ex. Mme/M. Dupont"
                  ariaLabel="Destinataire"
                />
              </div>

              {/* ⚠️ Champ 'Secteur' retiré de l'APERÇU */}
            </div>

            <div className="hdr-divider" />

            {(draftHtml || "").trim() ? (
              <div
                dangerouslySetInnerHTML={{
                  __html: DOMPurify.sanitize(draftHtml || "", {
                    USE_PROFILES: { html: true },
                  }),
                }}
              />
            ) : (
              <div>Sélectionnez un template pour commencer.</div>
            )}
          </div>
        )}

        {!loading && !error && mode === "edit" && (
          <div
            style={{ width: "100%", height: "100%", boxSizing: "border-box" }}
          >
            <Editor
              tinymce={tinymce}
              value={draftHtml}
              init={tinymceInit}
              onEditorChange={(content) => setDraftHtml(content)}
              onInit={(_evt, editor) => (editorRef.current = editor)}
            />
          </div>
        )}

        {(exportError || saveError) && (
          <div
            style={{
              color: "crimson",
              padding: "0.75rem 1rem",
              borderTop: "1px solid #eaeaea",
              flexShrink: 0,
            }}
          >
            {exportError && <>Erreur d'export : {exportError}</>}
            {exportError && saveError && <br />}
            {saveError && <>Erreur de sauvegarde : {saveError}</>}
          </div>
        )}
      </div>

      {/* Modale */}
      <ConfirmModal
        open={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        confirmData={confirmData}
        setConfirmData={setConfirmData}
        savingProp={savingProp}
        onConfirm={saveProposition}
      />

      {/* Bannière */}
      {banner && (
        <div
          style={{
            position: "fixed",
            right: 16,
            bottom: 16,
            padding: "10px 14px",
            borderRadius: 10,
            color: "#fff",
            background:
              banner.type === "success"
                ? "#16a34a"
                : banner.type === "warning"
                ? "#f59e0b"
                : "#dc2626",
            boxShadow: "0 10px 30px rgba(0,0,0,0.2)",
            zIndex: 1100,
            maxWidth: "92vw",
          }}
        >
          {banner.message}
        </div>
      )}
    </div>
  );
}

/* ===================== Modale (Portal) ===================== */
function ConfirmModal({
  open,
  onClose,
  confirmData,
  setConfirmData,
  savingProp,
  onConfirm,
}) {
  if (!open) return null;

  const overlayStyle = {
    position: "fixed",
    inset: 0,
    background: "rgba(0,0,0,0.45)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 9999,
  };

  const dialogStyle = {
    background: "#fff",
    padding: 16,
    borderRadius: 10,
    width: "min(480px, 94vw)",
    boxShadow: "0 10px 30px rgba(0,0,0,0.2)",
  };

  return createPortal(
    <div style={overlayStyle} onClick={onClose}>
      <div
        style={dialogStyle}
        className="confirm-modal"
        role="dialog"
        aria-modal="true"
        onClick={(e) => e.stopPropagation()}
      >
        <h3>Créer cette proposition ?</h3>
        <p className="muted">
          Vous pouvez ajuster les informations avant enregistrement.
        </p>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: 10,
          }}
        >
          <div style={{ gridColumn: "1 / -1" }}>
            <label style={{ fontWeight: 600 }}>Projet</label>
            <input
              className="input"
              type="text"
              value={confirmData.projet}
              onChange={(e) =>
                setConfirmData((d) => ({ ...d, projet: e.target.value }))
              }
              placeholder="Ex: Refonte du SI"
            />
          </div>

          <div>
            <label style={{ fontWeight: 600 }}>Date</label>
            <input
              className="input"
              type="date"
              value={confirmData.date}
              onChange={(e) =>
                setConfirmData((d) => ({ ...d, date: e.target.value }))
              }
            />
          </div>

          <div>
            <label style={{ fontWeight: 600 }}>Destinataire (Client)*</label>
            <input
              className="input"
              type="text"
              value={confirmData.destinataire}
              onChange={(e) =>
                setConfirmData((d) => ({
                  ...d,
                  destinataire: e.target.value,
                }))
              }
              placeholder="Ex: Mme/M. Dupont"
            />
          </div>

          {/* ⚠️ On GARDE le champ Secteur dans la MODALE pour la sauvegarde */}
          <div style={{ gridColumn: "1 / -1" }}>
            <label style={{ fontWeight: 600 }}>Secteur</label>
            <input
              className="input"
              type="text"
              value={confirmData.secteur}
              onChange={(e) =>
                setConfirmData((d) => ({ ...d, secteur: e.target.value }))
              }
              placeholder="Ex: Finance, Santé, Éducation…"
            />
          </div>

          <div>
            <label style={{ fontWeight: 600 }}>Statut</label>
            <select
              className="input"
              value={confirmData.statut}
              onChange={(e) =>
                setConfirmData((d) => ({ ...d, statut: e.target.value }))
              }
            >
              <option value="en_cours">En cours</option>
              <option value="valide">Validé</option>
            </select>
          </div>

          <div>
            <label style={{ fontWeight: 600 }}>Taille</label>
            <select
              className="input"
              value={confirmData.taille}
              onChange={(e) =>
                setConfirmData((d) => ({ ...d, taille: e.target.value }))
              }
            >
              <option value="Startup">Startup</option>
              <option value="PME">PME</option>
              <option value="Grande_entreprise">Grande entreprise</option>
            </select>
          </div>
        </div>

        <div
          style={{
            display: "flex",
            gap: 8,
            justifyContent: "flex-end",
            marginTop: 12,
          }}
        >
          <button className="btn btn-secondary" onClick={onClose} disabled={savingProp}>
            Annuler
          </button>
          <button
            className="btn btn-primary"
            onClick={onConfirm}
            disabled={savingProp}
            style={{
              background: "#0d6efd",
              color: "#fff",
              border: "1px solid #0b5ed7",
              padding: "8px 12px",
              borderRadius: 8,
              cursor: "pointer",
            }}
          >
            {savingProp ? "Création..." : "Confirmer"}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}

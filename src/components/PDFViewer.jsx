import { useEffect, useRef, useState } from "react";
import { Document, Page, pdfjs } from "react-pdf";
import workerSrc from "pdfjs-dist/build/pdf.worker.min.mjs?url";
import PDFErrorBoundary from "./PDFErrorBoundary";
import { fingerprintFile, getPdf, savePdf } from "../storage";
import "react-pdf/dist/Page/AnnotationLayer.css";
import "react-pdf/dist/Page/TextLayer.css";

pdfjs.GlobalWorkerOptions.workerSrc = workerSrc;
const PDF_OPTIONS = {
  cMapUrl: `${import.meta.env.BASE_URL}pdfjs/cmaps/`, cMapPacked: true,
  standardFontDataUrl: `${import.meta.env.BASE_URL}pdfjs/standard_fonts/`, wasmUrl: `${import.meta.env.BASE_URL}pdfjs/wasm/`, stopAtErrors: false,
};
const MIN_SCALE = 0.5;
const MAX_SCALE = 2.5;

function LazyPage({ pageNumber, scale, onSize }) {
  const [visible, setVisible] = useState(false);
  const [renderError, setRenderError] = useState(false);
  const slotRef = useRef(null);
  useEffect(() => {
    const element = slotRef.current;
    if (!element) return;
    const scrollRoot = element.closest(".pdf-content");
    const observer = new IntersectionObserver(([entry]) => {
      // 대용량 PDF에서도 현재 화면 주변 페이지만 실제로 렌더링한다.
      // 화면에서 멀어진 페이지를 placeholder로 되돌려 canvas 메모리 누적을 막는다.
      setVisible(entry.isIntersecting);
    }, { root: scrollRoot, rootMargin: "900px 0px" });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);
  return (
    <div ref={slotRef} id={`pdf-page-${pageNumber}`} className="pdf-page-slot" data-page={pageNumber}>
      {visible && !renderError ? (
        <Page pageNumber={pageNumber} renderTextLayer renderAnnotationLayer scale={scale} className="pdf-page"
          onLoadSuccess={(page) => onSize?.({ width: page.originalWidth, height: page.originalHeight })}
          onRenderError={() => setRenderError(true)} />
      ) : (
        <div className={`pdf-page-placeholder ${renderError ? "pdf-page-error" : ""}`} style={{ width: 600 * scale, height: (renderError ? 90 : 848) * scale }}>
          {renderError && `${pageNumber}페이지 렌더링 실패`}
        </div>
      )}
    </div>
  );
}

export default function PDFViewer({ pdfMeta, page, scale, onMetaChange, onPageChange, onScaleChange, jumpPage }) {
  const [file, setFile] = useState(null);
  const [numPages, setNumPages] = useState(pdfMeta?.numPages || null);
  const [loading, setLoading] = useState(false);
  const [loadProgress, setLoadProgress] = useState(0);
  const [dragging, setDragging] = useState(false);
  const [pageSize, setPageSize] = useState({ width: 600, height: 848 });
  const containerRef = useRef(null);
  const fileInputRef = useRef(null);
  const currentPageRef = useRef(page);

  useEffect(() => { currentPageRef.current = page; }, [page]);

  useEffect(() => {
    let alive = true;
    if (!pdfMeta?.fingerprint) return undefined;
    getPdf(pdfMeta.fingerprint).then((record) => {
      if (!alive || !record?.blob) return;
      setFile(new File([record.blob], record.name, { type: "application/pdf", lastModified: record.lastModified }));
    }).catch(() => {});
    return () => { alive = false; };
  }, [pdfMeta?.fingerprint]);

  const acceptFile = async (nextFile) => {
    if (!nextFile || (nextFile.type !== "application/pdf" && !nextFile.name.toLowerCase().endsWith(".pdf"))) {
      alert("PDF 파일만 업로드할 수 있습니다."); return;
    }
    setLoading(true); setLoadProgress(0);
    try {
      const { fingerprint, buffer } = await fingerprintFile(nextFile);
      await savePdf({ fingerprint, name: nextFile.name, size: nextFile.size, lastModified: nextFile.lastModified, blob: new Blob([buffer], { type: "application/pdf" }) });
      setFile(nextFile); setNumPages(null);
      onMetaChange({ fingerprint, name: nextFile.name, size: nextFile.size, lastModified: nextFile.lastModified });
      onPageChange(1); onScaleChange(1);
    } catch (error) { console.error(error); alert("PDF를 저장하지 못했습니다. 브라우저 저장 공간을 확인해주세요."); setLoading(false); }
  };

  const removeFile = async () => {
    if (!window.confirm("현재 PDF를 시험에서 제거할까요? 답안과 기록은 유지됩니다.")) return;
    setFile(null); setNumPages(null); onMetaChange(null); onPageChange(1);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const goToPage = (value, behavior = "smooth") => {
    const next = Math.min(Math.max(Number(value) || 1, 1), numPages || 1);
    onPageChange(next);
    document.getElementById(`pdf-page-${next}`)?.scrollIntoView({ behavior, block: "start" });
  };
  useEffect(() => { if (jumpPage) goToPage(jumpPage); }, [jumpPage]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!numPages || !containerRef.current) return;
    const root = containerRef.current;
    let frameId = null;
    const updateCurrentPage = () => {
      frameId = null;
      const slots = root.querySelectorAll(".pdf-page-slot");
      if (!slots.length) return;

      // 화면 상단에서 약간 아래 지점을 통과한 마지막 페이지를 현재 페이지로 본다.
      const marker = root.scrollTop + 24;
      let low = 0;
      let high = slots.length - 1;
      let activeIndex = 0;
      while (low <= high) {
        const middle = Math.floor((low + high) / 2);
        if (slots[middle].offsetTop <= marker) {
          activeIndex = middle;
          low = middle + 1;
        } else {
          high = middle - 1;
        }
      }

      const nextPage = Number(slots[activeIndex].dataset.page);
      if (nextPage && nextPage !== currentPageRef.current) {
        currentPageRef.current = nextPage;
        onPageChange(nextPage);
      }
    };
    const scheduleUpdate = () => {
      if (frameId == null) frameId = requestAnimationFrame(updateCurrentPage);
    };

    root.addEventListener("scroll", scheduleUpdate, { passive: true });
    const resizeObserver = new ResizeObserver(scheduleUpdate);
    resizeObserver.observe(root);
    scheduleUpdate();
    return () => {
      root.removeEventListener("scroll", scheduleUpdate);
      resizeObserver.disconnect();
      if (frameId != null) cancelAnimationFrame(frameId);
    };
  }, [numPages, onPageChange]);

  useEffect(() => {
    const root = containerRef.current;
    if (!root) return;
    const wheel = (event) => {
      if (!event.ctrlKey || !file) return;
      event.preventDefault();
      onScaleChange(Math.min(MAX_SCALE, Math.max(MIN_SCALE, scale + (event.deltaY < 0 ? 0.1 : -0.1))));
    };
    root.addEventListener("wheel", wheel, { passive: false });
    return () => root.removeEventListener("wheel", wheel);
  }, [file, scale, onScaleChange]);

  useEffect(() => {
    const keydown = (event) => {
      if (!file || ["INPUT", "TEXTAREA", "SELECT"].includes(document.activeElement?.tagName)) return;
      if (event.key === "ArrowRight" || event.key === "ArrowDown") { event.preventDefault(); goToPage(page + 1); }
      if (event.key === "ArrowLeft" || event.key === "ArrowUp") { event.preventDefault(); goToPage(page - 1); }
    };
    window.addEventListener("keydown", keydown);
    return () => window.removeEventListener("keydown", keydown);
  });

  const fitWidth = () => onScaleChange(Math.min(MAX_SCALE, Math.max(MIN_SCALE, ((containerRef.current?.clientWidth || 640) - 48) / pageSize.width)));
  const fitPage = () => onScaleChange(Math.min(MAX_SCALE, Math.max(MIN_SCALE,
    Math.min(((containerRef.current?.clientWidth || 640) - 48) / pageSize.width, ((containerRef.current?.clientHeight || 720) - 48) / pageSize.height))));

  return (
    <div className={`pdf-viewer ${dragging ? "is-dragging" : ""}`} onDragOver={(e) => { e.preventDefault(); setDragging(true); }} onDragLeave={() => setDragging(false)} onDrop={(e) => { e.preventDefault(); setDragging(false); acceptFile(e.dataTransfer.files[0]); }}>
      <div className="pdf-header">
        <div className="pdf-title"><strong>문제 PDF</strong>{pdfMeta && <span title={pdfMeta.name}>{pdfMeta.name}</span>}</div>
        {file && <div className="pdf-controls">
          <button onClick={() => onScaleChange(Math.max(MIN_SCALE, scale - 0.1))}>−</button><button onClick={() => onScaleChange(1)}>100%</button><button onClick={() => onScaleChange(Math.min(MAX_SCALE, scale + 0.1))}>＋</button>
          <button onClick={fitWidth}>너비</button><button onClick={fitPage}>전체</button><span>{Math.round(scale * 100)}%</span>
          <button onClick={() => goToPage(page - 1)} disabled={page <= 1}>‹</button>
          <input className="page-input" type="number" min="1" max={numPages || 1} value={page} onChange={(e) => goToPage(e.target.value, "auto")} />
          <span>/ {numPages || 1}</span><button onClick={() => goToPage(page + 1)} disabled={page >= (numPages || 1)}>›</button>
        </div>}
        <div className="pdf-file-actions"><button className="upload-btn" onClick={() => fileInputRef.current?.click()}>{file ? "PDF 교체" : "PDF 업로드"}</button>{file && <button className="danger-text-btn" onClick={removeFile}>삭제</button>}</div>
        <input ref={fileInputRef} type="file" accept="application/pdf,.pdf" hidden onChange={(e) => acceptFile(e.target.files[0])} />
      </div>
      <div className="pdf-content" ref={containerRef}>
        {loading && <div className="loading-overlay"><div className="spinner"/><p>PDF 불러오는 중… {loadProgress}%</p></div>}
        {file ? <PDFErrorBoundary key={pdfMeta?.fingerprint}><Document file={file} options={PDF_OPTIONS}
          onLoadSuccess={({ numPages: count }) => { setNumPages(count); setLoading(false); onMetaChange({ ...pdfMeta, numPages: count }); setTimeout(() => goToPage(page, "auto"), 0); }}
          onLoadProgress={({ loaded, total }) => total && setLoadProgress(Math.round((loaded / total) * 100))}
          onLoadError={(error) => { console.error(error); setLoading(false); alert("PDF 파일을 불러오지 못했습니다."); }} className="pdf-document">
          {Array.from({ length: numPages || 0 }, (_, index) => <LazyPage key={index + 1} pageNumber={index + 1} scale={scale} onSize={setPageSize} />)}
        </Document></PDFErrorBoundary> : <div className="pdf-placeholder"><div><b>PDF를 여기에 놓거나 업로드하세요</b><p>원본 PDF를 변환하지 않고 그대로 표시합니다.</p>{pdfMeta && <p>저장된 PDF를 찾지 못했습니다. 같은 파일을 다시 업로드하면 기록이 연결됩니다.</p>}</div></div>}
      </div>
    </div>
  );
}

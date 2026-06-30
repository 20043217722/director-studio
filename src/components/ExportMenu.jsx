import { useState } from "react";

export default function ExportMenu({ onExport, disabled }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="relative">
      <button onClick={() => setOpen(!open)} disabled={disabled}
        className="btn-ghost text-xs" style={disabled ? {opacity:0.4} : {}} aria-expanded={open} aria-haspopup="menu">
        📥 导出
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="export-menu absolute right-0 top-full mt-1 z-20 py-1 min-w-[130px]" role="menu">
            <button onClick={() => { onExport("docx"); setOpen(false); }} role="menuitem"
              className="w-full text-left px-3 py-2.5 text-sm hover:bg-white/[0.03] flex items-center gap-2 transition-colors">
              📄 Word 文档
            </button>
            <button onClick={() => { onExport("pptx"); setOpen(false); }} role="menuitem"
              className="w-full text-left px-3 py-2.5 text-sm hover:bg-white/[0.03] flex items-center gap-2 transition-colors">
              📊 PPT 幻灯片
            </button>
          </div>
        </>
      )}
    </div>
  );
}

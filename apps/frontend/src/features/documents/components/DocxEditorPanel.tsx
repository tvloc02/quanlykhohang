import React from 'react';
import { Bold, FileText, Italic, List, ListOrdered, Redo2, RemoveFormatting, Type, Underline, Upload } from 'lucide-react';

type DocxEditorPanelProps = {
  fileName: string;
  html: string;
  loading?: boolean;
  error?: string | null;
  wordCount?: number;
  paragraphCount?: number;
  tableCount?: number;
  onChange: (html: string) => void;
  onReplaceFile: () => void;
};

const TOOLBAR_BUTTONS = [
  { key: 'bold', label: 'Đậm', icon: Bold, command: 'bold' },
  { key: 'italic', label: 'Nghiêng', icon: Italic, command: 'italic' },
  { key: 'underline', label: 'Gạch chân', icon: Underline, command: 'underline' },
  { key: 'ul', label: 'Danh sách', icon: List, command: 'insertUnorderedList' },
  { key: 'ol', label: 'Đánh số', icon: ListOrdered, command: 'insertOrderedList' },
];

function sanitizeInitialHtml(value: string) {
  return value.trim() ? value : '<p style="margin:0 0 12px; min-height:1.35em;">Nhập nội dung hóa đơn tại đây...</p>';
}

export default function DocxEditorPanel({
  fileName,
  html,
  loading = false,
  error = null,
  wordCount = 0,
  paragraphCount = 0,
  tableCount = 0,
  onChange,
  onReplaceFile,
}: DocxEditorPanelProps) {
  const editorRef = React.useRef<HTMLDivElement>(null);
  const [internalHtml, setInternalHtml] = React.useState(() => sanitizeInitialHtml(html));

  React.useEffect(() => {
    setInternalHtml(sanitizeInitialHtml(html));
  }, [html, fileName]);

  React.useEffect(() => {
    const editor = editorRef.current;
    if (!editor) return;
    if (editor.innerHTML !== internalHtml) {
      editor.innerHTML = internalHtml;
    }
  }, [internalHtml]);

  const commitChange = React.useCallback(() => {
    const editor = editorRef.current;
    if (!editor) return;
    const nextHtml = editor.innerHTML || sanitizeInitialHtml('');
    setInternalHtml(nextHtml);
    onChange(nextHtml);
  }, [onChange]);

  const runCommand = React.useCallback((command: string) => {
    const editor = editorRef.current;
    if (!editor) return;
    editor.focus();
    document.execCommand(command, false);
    commitChange();
  }, [commitChange]);

  return (
    <div className="flex h-full min-h-[720px] flex-col overflow-hidden rounded-[32px] border border-slate-200 bg-slate-100 shadow-[0_24px_80px_rgba(15,23,42,0.08)]">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 bg-white px-4 py-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2.5">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-cyan-50 text-cyan-700 ring-1 ring-cyan-100">
              <FileText className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <p className="truncate text-sm font-extrabold text-slate-900">{fileName || 'Tài liệu Word'}</p>
              <p className="text-xs font-medium text-slate-500">
                {paragraphCount} đoạn • {tableCount} bảng • {wordCount} từ
              </p>
            </div>
          </div>
        </div>

        <button
          type="button"
          onClick={onReplaceFile}
          className="inline-flex items-center gap-2 rounded-2xl border border-cyan-200 bg-cyan-50 px-4 py-2 text-xs font-bold text-cyan-700 transition hover:bg-cyan-100"
        >
          <Upload className="h-4 w-4" />
          Đổi file Word
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 bg-slate-50 px-4 py-3">
        {TOOLBAR_BUTTONS.map((button) => (
          <button
            key={button.key}
            type="button"
            onClick={() => runCommand(button.command)}
            className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-700 shadow-sm transition hover:border-cyan-300 hover:bg-cyan-50 hover:text-cyan-700"
          >
            <button.icon className="h-4 w-4" />
            {button.label}
          </button>
        ))}

        <button
          type="button"
          onClick={() => runCommand('removeFormat')}
          className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-700 shadow-sm transition hover:border-cyan-300 hover:bg-cyan-50 hover:text-cyan-700"
        >
          <RemoveFormatting className="h-4 w-4" />
          Xóa định dạng
        </button>

        <button
          type="button"
          onClick={() => runCommand('undo')}
          className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-700 shadow-sm transition hover:border-cyan-300 hover:bg-cyan-50 hover:text-cyan-700"
        >
          <Redo2 className="h-4 w-4 rotate-180" />
          Hoàn tác
        </button>

        <button
          type="button"
          onClick={() => runCommand('justifyCenter')}
          className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-700 shadow-sm transition hover:border-cyan-300 hover:bg-cyan-50 hover:text-cyan-700"
        >
          <Type className="h-4 w-4" />
          Căn giữa
        </button>

      </div>

      <div className="flex-1 overflow-auto p-4 md:p-6">
        <div className="mx-auto w-full max-w-[840px] rounded-[28px] bg-white px-6 py-8 shadow-[0_16px_50px_rgba(15,23,42,0.12)] ring-1 ring-slate-200 md:px-10 md:py-10">
          {loading ? (
            <div className="flex min-h-[640px] items-center justify-center rounded-[24px] border border-dashed border-cyan-200 bg-cyan-50/30 text-center">
              <div>
                <div className="mx-auto mb-3 h-10 w-10 animate-spin rounded-full border-4 border-cyan-200 border-t-cyan-600" />
                <p className="text-sm font-bold text-cyan-700">Đang đọc file Word...</p>
                <p className="mt-1 text-xs text-slate-500">Đợi một chút để mình bóc nội dung tài liệu.</p>
              </div>
            </div>
          ) : (
            <div
              ref={editorRef}
              contentEditable
              suppressContentEditableWarning
              spellCheck={false}
              onInput={commitChange}
              className="min-h-[640px] outline-none"
              style={{
                fontFamily: 'Georgia, Times New Roman, serif',
                fontSize: '15px',
                lineHeight: 1.7,
                color: '#0f172a',
              }}
              dangerouslySetInnerHTML={{ __html: internalHtml }}
            />
          )}
        </div>
      </div>

      {error && (
        <div className="border-t border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700">
          {error}
        </div>
      )}

      {!error && !loading && (
        <div className="border-t border-slate-200 bg-white px-4 py-3 text-xs font-medium text-slate-500">
          Mẹo: chọn một đoạn nội dung rồi bấm các nút trên thanh công cụ để định dạng như Word online.
        </div>
      )}
    </div>
  );
}

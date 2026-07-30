import React from 'react';
import {
  Bold,
  FileText,
  Italic,
  List,
  ListOrdered,
  Redo2,
  RemoveFormatting,
  Type,
  Underline,
  Upload,
  AlignLeft,
  AlignCenter,
  AlignRight,
  AlignJustify,
  Heading1,
  Heading2,
  Table as TableIcon,
  FileCheck,
  Wand2,
} from 'lucide-react';

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
  { key: 'alignLeft', label: 'Trái', icon: AlignLeft, command: 'justifyLeft' },
  { key: 'alignCenter', label: 'Giữa', icon: AlignCenter, command: 'justifyCenter' },
  { key: 'alignRight', label: 'Phải', icon: AlignRight, command: 'justifyRight' },
  { key: 'alignJustify', label: 'Đều', icon: AlignJustify, command: 'justifyFull' },
  { key: 'ul', label: 'Danh sách', icon: List, command: 'insertUnorderedList' },
  { key: 'ol', label: 'Đánh số', icon: ListOrdered, command: 'insertOrderedList' },
];

function sanitizeInitialHtml(value: string) {
  return value && value.trim()
    ? value
    : `<div style="font-family: 'Times New Roman', Times, serif; padding: 10px; color: #000;">
        <h1 style="text-align: center; font-size: 22px; font-weight: bold; margin-bottom: 12px; text-transform: uppercase;">PHIẾU XUẤT KHO KIÊM PHIẾU ĐIỀU CHUYỂN</h1>
        <p style="margin-bottom: 8px;"><strong>Đơn vị gửi:</strong> Công Ty Kế Toán Thiên Ưng</p>
        <p style="margin-bottom: 8px;"><strong>Đơn vị nhận:</strong> Chi Nhánh Kho Tổng TP.HCM</p>
        <table style="width: 100%; border-collapse: collapse; margin-top: 14px; border: 2px solid #000;">
          <thead>
            <tr style="background-color: #f1f5f9; text-align: center; font-weight: bold;">
              <th style="border: 1px solid #000; padding: 6px;">STT</th>
              <th style="border: 1px solid #000; padding: 6px;">Tên Hàng Hóa / Quy Cách</th>
              <th style="border: 1px solid #000; padding: 6px;">Mã Số</th>
              <th style="border: 1px solid #000; padding: 6px;">ĐVT</th>
              <th style="border: 1px solid #000; padding: 6px;">Số Lượng</th>
              <th style="border: 1px solid #000; padding: 6px;">Đơn Giá</th>
              <th style="border: 1px solid #000; padding: 6px;">Thành Tiền</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td style="border: 1px solid #000; padding: 6px; text-align: center;">01</td>
              <td style="border: 1px solid #000; padding: 6px;">Laptop Dell Inspiron D5401</td>
              <td style="border: 1px solid #000; padding: 6px; text-align: center;">D5401</td>
              <td style="border: 1px solid #000; padding: 6px; text-align: center;">Chiếc</td>
              <td style="border: 1px solid #000; padding: 6px; text-align: center;">01</td>
              <td style="border: 1px solid #000; padding: 6px; text-align: right;">10.000.000</td>
              <td style="border: 1px solid #000; padding: 6px; text-align: right;">10.000.000</td>
            </tr>
          </tbody>
        </table>
       </div>`;
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
    if (html && html.trim()) {
      setInternalHtml(html);
    }
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
    const nextHtml = editor.innerHTML || '';
    setInternalHtml(nextHtml);
    onChange(nextHtml);
  }, [onChange]);

  const runCommand = React.useCallback(
    (command: string, value: string | undefined = undefined) => {
      const editor = editorRef.current;
      if (!editor) return;
      editor.focus();
      document.execCommand(command, false, value);
      commitChange();
    },
    [commitChange],
  );

  const applyVietnameseWordStyling = () => {
    const editor = editorRef.current;
    if (!editor) return;
    let currentContent = editor.innerHTML;

    // Apply clean Times New Roman styling and table borders
    let formatted = currentContent
      .replace(/<table([^>]*)>/gi, '<table$1 style="width:100%; border-collapse:collapse; margin:16px 0; border:2px solid #000; font-family:\'Times New Roman\', Times, serif; font-size:14px; color:#000;">')
      .replace(/<td([^>]*)>/gi, '<td$1 style="border:1px solid #000; padding:6px 10px; vertical-align:top; line-height:1.5;">')
      .replace(/<th([^>]*)>/gi, '<th$1 style="border:1px solid #000; padding:6px 10px; vertical-align:top; line-height:1.5; font-weight:bold; background-color:#f1f5f9; text-align:center;">')
      .replace(/<p([^>]*)>/gi, '<p$1 style="margin:0 0 8px; line-height:1.6; font-family:\'Times New Roman\', Times, serif; color:#000; font-size:14px;">')
      .replace(/<h1([^>]*)>/gi, '<h1$1 style="font-size:22px; font-weight:bold; margin:16px 0 12px; text-align:center; text-transform:uppercase; font-family:\'Times New Roman\', Times, serif; color:#000;">');

    editor.innerHTML = formatted;
    commitChange();
  };

  const insertTableTemplate = () => {
    const tableHtml = `
      <table style="width:100%; border-collapse:collapse; margin:16px 0; border:2px solid #000; font-family:'Times New Roman', serif; font-size:14px;">
        <thead>
          <tr style="background-color:#f1f5f9; font-weight:bold; text-align:center;">
            <th style="border:1px solid #000; padding:8px; width:48px;">STT</th>
            <th style="border:1px solid #000; padding:8px; text-align:left;">Tên nhãn hiệu, quy cách vật tư</th>
            <th style="border:1px solid #000; padding:8px; width:96px;">Mã số</th>
            <th style="border:1px solid #000; padding:8px; width:80px;">ĐVT</th>
            <th style="border:1px solid #000; padding:8px; width:80px;">Số lượng</th>
            <th style="border:1px solid #000; padding:8px; width:110px;">Đơn giá</th>
            <th style="border:1px solid #000; padding:8px; width:130px;">Thành tiền</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td style="border:1px solid #000; padding:8px; text-align:center;">01</td>
            <td style="border:1px solid #000; padding:8px; font-weight:bold;">Sản phẩm mẫu 01</td>
            <td style="border:1px solid #000; padding:8px; text-align:center;">SP-001</td>
            <td style="border:1px solid #000; padding:8px; text-align:center;">Cái</td>
            <td style="border:1px solid #000; padding:8px; text-align:center; font-weight:bold;">01</td>
            <td style="border:1px solid #000; padding:8px; text-align:right;">1.000.000</td>
            <td style="border:1px solid #000; padding:8px; text-align:right; font-weight:bold;">1.000.000</td>
          </tr>
        </tbody>
      </table>
    `;
    runCommand('insertHTML', tableHtml);
  };

  const insertTransferSampleTemplate = () => {
    const sampleHtml = `
      <div style="font-family: 'Times New Roman', Times, serif; padding: 12px; color: #000;">
        <div style="text-align: right; font-weight: bold; font-size: 13px; margin-bottom: 16px;">
          Mẫu phiếu điều chuyển (Mẫu 03-VT)
        </div>

        <div style="margin-bottom: 20px; font-size: 14px; line-height: 1.8;">
          <p style="margin-bottom: 6px;"><strong>Tên đơn vị gửi hàng:</strong> Công Ty Kế Toán Thiên Ưng</p>
          <p style="margin-bottom: 6px;"><strong>Theo lệnh điều động số:</strong> 12/LDD-KTTU <em>về việc vận chuyển điều chuyển hàng hóa</em></p>
          <p style="margin-bottom: 6px;"><strong>Địa chỉ kho gửi (kho đi):</strong> Nhà lô B11, số 9A, ngõ 181 đường Xuân Thủy, Cầu Giấy, Hà Nội</p>
          <p style="margin-bottom: 6px;"><strong>Tên người vận chuyển:</strong> Tạ Văn Thanh</p>
          <p style="margin-bottom: 6px;"><strong>Phương tiện vận chuyển:</strong> ô tô bán tải số 30L63686</p>
        </div>

        <div style="text-align: center; margin: 24px 0 20px;">
          <h1 style="font-size: 24px; font-weight: bold; text-transform: uppercase; margin: 0; font-family: 'Times New Roman', serif;">
            PHIẾU ĐIỀU CHUYỂN HÀNG HÓA NỘI BỘ
          </h1>
          <p style="font-style: italic; font-size: 13px; margin-top: 6px;">Ngày 23 tháng 02 năm 2025</p>
        </div>

        <div style="margin-bottom: 20px; font-size: 14px; line-height: 1.8;">
          <p style="margin-bottom: 6px;"><strong>Tên người nhận hàng:</strong> Nguyễn Thị Mai</p>
          <p style="margin-bottom: 6px;"><strong>Địa điểm kho nhận (kho đến):</strong> Số nhà 1, ngách 327/6 phố Vũ Tông Phan, Thanh Xuân, Hà Nội</p>
        </div>

        <table style="width:100%; border-collapse:collapse; margin:20px 0; border:2px solid #000; font-size:14px; font-family:'Times New Roman', serif;">
          <thead>
            <tr style="background-color:#f1f5f9; font-weight:bold; text-align:center;">
              <th style="border:1px solid #000; padding:8px; width:48px;">STT</th>
              <th style="border:1px solid #000; padding:8px; text-align:left;">Tên nhãn hiệu, quy cách vật tư (sản phẩm, hàng hóa)</th>
              <th style="border:1px solid #000; padding:8px; width:90px;">Mã số</th>
              <th style="border:1px solid #000; padding:8px; width:70px;">ĐVT</th>
              <th style="border:1px solid #000; padding:8px; width:70px;">Thực xuất</th>
              <th style="border:1px solid #000; padding:8px; width:70px;">Thực nhập</th>
              <th style="border:1px solid #000; padding:8px; width:110px;">Đơn giá</th>
              <th style="border:1px solid #000; padding:8px; width:130px;">Thành tiền</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td style="border:1px solid #000; padding:8px; text-align:center;">01</td>
              <td style="border:1px solid #000; padding:8px; font-weight:bold;">Laptop Dell Inspiron</td>
              <td style="border:1px solid #000; padding:8px; text-align:center;">D5401</td>
              <td style="border:1px solid #000; padding:8px; text-align:center;">Chiếc</td>
              <td style="border:1px solid #000; padding:8px; text-align:center; font-weight:bold;">01</td>
              <td style="border:1px solid #000; padding:8px; text-align:center; font-weight:bold;">01</td>
              <td style="border:1px solid #000; padding:8px; text-align:right;">10.000.000</td>
              <td style="border:1px solid #000; padding:8px; text-align:right; font-weight:bold;">10.000.000</td>
            </tr>
            <tr>
              <td style="border:1px solid #000; padding:8px; text-align:center;">02</td>
              <td style="border:1px solid #000; padding:8px; font-weight:bold;">Laptop Asus Vivobook</td>
              <td style="border:1px solid #000; padding:8px; text-align:center;">X1404ZA</td>
              <td style="border:1px solid #000; padding:8px; text-align:center;">Chiếc</td>
              <td style="border:1px solid #000; padding:8px; text-align:center; font-weight:bold;">01</td>
              <td style="border:1px solid #000; padding:8px; text-align:center; font-weight:bold;">01</td>
              <td style="border:1px solid #000; padding:8px; text-align:right;">9.500.000</td>
              <td style="border:1px solid #000; padding:8px; text-align:right; font-weight:bold;">9.500.000</td>
            </tr>
            <tr style="font-weight:bold; background-color:#f8fafc;">
              <td colspan="7" style="border:1px solid #000; padding:10px; text-align:right; text-transform:uppercase;">TỔNG CỘNG:</td>
              <td style="border:1px solid #000; padding:10px; text-align:right; color:#0e7490; font-size:15px;">19.500.000</td>
            </tr>
          </tbody>
        </table>

        <div style="margin-top: 30px; text-align: center;">
          <p style="font-weight: bold; text-transform: uppercase;">THỦ TRƯỞNG ĐƠN VỊ</p>
          <p style="font-size: 12px; font-style: italic; color: #64748b;">(Chữ ký số)</p>
          <div style="display: inline-block; border: 2px solid #10b981; background-color: #ecfdf5; padding: 12px 24px; border-radius: 12px; margin-top: 12px;">
            <p style="color: #047857; font-weight: bold; margin: 0;">✓ Đã được ký điện tử bởi</p>
            <p style="font-weight: 900; color: #064e3b; margin: 4px 0 0; text-transform: uppercase;">CÔNG TY TNHH ĐÀO TẠO THIÊN ƯNG</p>
            <p style="font-size: 11px; color: #047857; margin: 2px 0 0;">Ngày: 23/02/2025</p>
          </div>
        </div>
      </div>
    `;
    setInternalHtml(sampleHtml);
    onChange(sampleHtml);
  };

  return (
    <div className="flex h-full min-h-[740px] flex-col overflow-hidden rounded-3xl border-2 border-slate-200 bg-slate-100 shadow-xl font-sans">
      {/* Document Header Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 bg-white px-5 py-3.5">
        <div className="min-w-0">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-cyan-600 text-white shadow-sm ring-2 ring-cyan-500/20">
              <FileText className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <p className="truncate text-sm font-extrabold text-slate-900">{fileName || 'Tài liệu Word (.docx)'}</p>
              <p className="text-xs font-semibold text-slate-500">
                {paragraphCount > 0 ? paragraphCount : 'Nhiều'} đoạn • {tableCount} bảng • {wordCount} từ
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={applyVietnameseWordStyling}
            className="inline-flex items-center gap-1.5 rounded-xl border-2 border-emerald-500 bg-emerald-50 px-3.5 py-1.5 text-xs font-extrabold text-emerald-800 transition hover:bg-emerald-100 shadow-xs"
            title="Định dạng phông chữ Times New Roman 14pt chuẩn văn bản hành chính Việt Nam"
          >
            <Wand2 className="h-4 w-4 text-emerald-600" />
            Chuẩn hóa Phông Word
          </button>

          <button
            type="button"
            onClick={insertTransferSampleTemplate}
            className="inline-flex items-center gap-1.5 rounded-xl border-2 border-cyan-500 bg-cyan-50 px-3.5 py-1.5 text-xs font-extrabold text-cyan-700 transition hover:bg-cyan-100 shadow-xs"
            title="Nạp mẫu phiếu điều chuyển chuẩn như ở /delivery"
          >
            <FileCheck className="h-4 w-4" />
            Nạp Mẫu Chuẩn
          </button>

          <button
            type="button"
            onClick={onReplaceFile}
            className="inline-flex items-center gap-1.5 rounded-xl border-2 border-slate-300 bg-white px-3.5 py-1.5 text-xs font-bold text-slate-700 transition hover:bg-slate-50 shadow-xs"
          >
            <Upload className="h-4 w-4 text-cyan-600" />
            Đổi file Word
          </button>
        </div>
      </div>

      {/* Formatting Toolbar */}
      <div className="flex flex-wrap items-center gap-1.5 border-b border-slate-200 bg-slate-50 px-4 py-2.5">
        <button
          type="button"
          onClick={() => runCommand('formatBlock', '<h1>')}
          className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-bold text-slate-700 shadow-2xs hover:bg-cyan-50 hover:text-cyan-700"
          title="Tiêu đề lớn (H1)"
        >
          <Heading1 className="h-3.5 w-3.5 text-cyan-600" />
          Tiêu đề
        </button>

        <button
          type="button"
          onClick={() => runCommand('formatBlock', '<h2>')}
          className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-bold text-slate-700 shadow-2xs hover:bg-cyan-50 hover:text-cyan-700"
          title="Tiêu đề phụ (H2)"
        >
          <Heading2 className="h-3.5 w-3.5 text-cyan-600" />
          Tiêu đề phụ
        </button>

        <div className="h-5 w-[1px] bg-slate-300 mx-1" />

        {TOOLBAR_BUTTONS.map((button) => (
          <button
            key={button.key}
            type="button"
            onClick={() => runCommand(button.command)}
            className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-bold text-slate-700 shadow-2xs transition hover:border-cyan-300 hover:bg-cyan-50 hover:text-cyan-700"
            title={button.label}
          >
            <button.icon className="h-3.5 w-3.5 text-slate-600" />
            <span className="hidden sm:inline">{button.label}</span>
          </button>
        ))}

        <div className="h-5 w-[1px] bg-slate-300 mx-1" />

        <button
          type="button"
          onClick={insertTableTemplate}
          className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-bold text-slate-700 shadow-2xs hover:bg-cyan-50 hover:text-cyan-700"
          title="Chèn bảng hàng hóa"
        >
          <TableIcon className="h-3.5 w-3.5 text-cyan-600" />
          Chèn Bảng
        </button>

        <button
          type="button"
          onClick={() => runCommand('removeFormat')}
          className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-bold text-slate-700 shadow-2xs hover:bg-cyan-50 hover:text-cyan-700"
          title="Xóa định dạng"
        >
          <RemoveFormatting className="h-3.5 w-3.5 text-slate-500" />
        </button>

        <button
          type="button"
          onClick={() => runCommand('undo')}
          className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-bold text-slate-700 shadow-2xs hover:bg-cyan-50 hover:text-cyan-700"
          title="Hoàn tác"
        >
          <Redo2 className="h-3.5 w-3.5 rotate-180 text-slate-500" />
        </button>
      </div>

      {/* Main Printable Interactive A4 Canvas with Times New Roman Default Font */}
      <div className="flex-1 overflow-auto p-4 md:p-6 bg-slate-200/70">
        <div className="mx-auto w-full max-w-[860px] rounded-2xl bg-white p-6 md:p-10 shadow-2xl border-4 border-cyan-500/80 ring-1 ring-slate-900/10 min-h-[680px]">
          {loading ? (
            <div className="flex min-h-[580px] items-center justify-center rounded-2xl border-2 border-dashed border-cyan-300 bg-cyan-50/40 text-center">
              <div>
                <div className="mx-auto mb-3 h-10 w-10 animate-spin rounded-full border-4 border-cyan-200 border-t-cyan-600" />
                <p className="text-base font-bold text-cyan-800">Đang đọc file Word (.docx)...</p>
                <p className="mt-1 text-xs font-medium text-slate-500">Hệ thống đang trích xuất văn bản, bảng biểu và định dạng tài liệu...</p>
              </div>
            </div>
          ) : (
            <div
              ref={editorRef}
              contentEditable
              suppressContentEditableWarning
              spellCheck={false}
              onInput={commitChange}
              className="min-h-[600px] outline-none text-black leading-relaxed"
              style={{
                fontFamily: "'Times New Roman', Times, serif",
                fontSize: '14px',
                outline: 'none',
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
        <div className="border-t border-slate-200 bg-white px-5 py-2.5 text-xs font-medium text-slate-600 flex items-center justify-between">
          <span>💡 <strong>Hướng dẫn:</strong> Bấm nút <strong>"Chuẩn hóa Phông Word"</strong> để áp dụng phông Times New Roman chuẩn văn bản hành chính, hoặc nhấp trực tiếp vào chữ/ô bảng để chỉnh sửa.</span>
          <span className="text-cyan-700 font-bold">Times New Roman Standard</span>
        </div>
      )}
    </div>
  );
}

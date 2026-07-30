import mammoth from 'mammoth';

export type ParsedDocxDocument = {
  html: string;
  text: string;
  paragraphCount: number;
  tableCount: number;
  wordCount: number;
};

function formatHtmlForEditor(html: string): string {
  if (!html || !html.trim()) {
    return '<p style="margin: 0 0 12px; line-height: 1.6; font-family: \'Times New Roman\', Times, serif;">(Nội dung tài liệu trống)</p>';
  }

  // Enhance HTML tables and typography for Vietnamese administrative & invoice standard (Times New Roman 14px)
  let formatted = html
    .replace(/<table([^>]*)>/gi, '<table$1 style="width:100%; border-collapse:collapse; margin:16px 0; border:2px solid #000; font-family:\'Times New Roman\', Times, serif; font-size:14px;">')
    .replace(/<td([^>]*)>/gi, '<td$1 style="border:1px solid #000; padding:6px 10px; vertical-align:top; line-height:1.5;">')
    .replace(/<th([^>]*)>/gi, '<th$1 style="border:1px solid #000; padding:6px 10px; vertical-align:top; line-height:1.5; font-weight:bold; background-color:#f1f5f9; text-align:center;">')
    .replace(/<p([^>]*)>/gi, '<p$1 style="margin:0 0 8px; line-height:1.6; font-family:\'Times New Roman\', Times, serif; color:#0f172a; font-size:14px;">')
    .replace(/<h1([^>]*)>/gi, '<h1$1 style="font-size:22px; font-weight:bold; margin:16px 0 12px; text-align:center; text-transform:uppercase; font-family:\'Times New Roman\', Times, serif; color:#0f172a;">')
    .replace(/<h2([^>]*)>/gi, '<h2$1 style="font-size:18px; font-weight:bold; margin:14px 0 10px; font-family:\'Times New Roman\', Times, serif; color:#0f172a;">')
    .replace(/<h3([^>]*)>/gi, '<h3$1 style="font-size:16px; font-weight:bold; margin:12px 0 8px; font-family:\'Times New Roman\', Times, serif; color:#0f172a;">');

  return formatted;
}

export async function parseDocxFile(file: File): Promise<ParsedDocxDocument> {
  const extension = file.name.split('.').pop()?.toLowerCase();
  if (extension !== 'docx') {
    throw new Error('Hiện chỉ hỗ trợ đọc file .docx');
  }

  try {
    const arrayBuffer = await file.arrayBuffer();

    const [rawTextResult, htmlResult] = await Promise.all([
      mammoth.extractRawText({ arrayBuffer }),
      mammoth.convertToHtml({ arrayBuffer }),
    ]);

    const rawHtml = htmlResult.value || '';
    const text = rawTextResult.value || '';
    const html = formatHtmlForEditor(rawHtml);

    let paragraphCount = 0;
    let tableCount = 0;

    if (typeof document !== 'undefined') {
      const tempDiv = document.createElement('div');
      tempDiv.innerHTML = html;
      paragraphCount = tempDiv.querySelectorAll('p, h1, h2, h3, h4, h5, h6').length;
      tableCount = tempDiv.querySelectorAll('table').length;
    } else {
      paragraphCount = (html.match(/<(p|h1|h2|h3|h4|h5|h6)[^>]*>/gi) || []).length;
      tableCount = (html.match(/<table[^>]*>/gi) || []).length;
    }

    const wordCount = text ? text.trim().split(/\s+/).filter(Boolean).length : 0;

    return {
      html,
      text,
      paragraphCount,
      tableCount,
      wordCount,
    };
  } catch (error: any) {
    console.error('Lỗi khi đọc file docx:', error);
    throw new Error(error?.message || 'Không đọc được nội dung file Word');
  }
}



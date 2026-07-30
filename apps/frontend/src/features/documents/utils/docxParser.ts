import { CFB } from 'xlsx/xlsx.mjs';

const WORD_NS = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main';

export type ParsedDocxDocument = {
  html: string;
  text: string;
  paragraphCount: number;
  tableCount: number;
  wordCount: number;
};

function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function toUint8Array(value: unknown) {
  if (value instanceof Uint8Array) return value;
  if (value instanceof ArrayBuffer) return new Uint8Array(value);
  if (ArrayBuffer.isView(value)) {
    return new Uint8Array(value.buffer, value.byteOffset, value.byteLength);
  }

  throw new Error('Dữ liệu file Word không hợp lệ');
}

function decodeXmlBytes(value: unknown) {
  return new TextDecoder('utf-8').decode(toUint8Array(value)).replace(/^\uFEFF/, '');
}

function getAttr(element: Element, localName: string) {
  return (
    element.getAttribute(localName) ||
    element.getAttribute(`w:${localName}`) ||
    element.getAttributeNS(WORD_NS, localName) ||
    ''
  );
}

function getDirectChildren(element: Element, tagName: string) {
  return Array.from(element.children).filter((child) => child.namespaceURI === WORD_NS && child.localName === tagName);
}

function extractInlineText(node: Element) {
  let output = '';

  for (const child of Array.from(node.childNodes)) {
    if (child.nodeType === Node.TEXT_NODE) {
      output += child.textContent || '';
      continue;
    }

    if (child.nodeType !== Node.ELEMENT_NODE) continue;
    const element = child as Element;

    if (element.namespaceURI !== WORD_NS) continue;

    if (element.localName === 't') {
      output += element.textContent || '';
      continue;
    }

    if (element.localName === 'tab') {
      output += '\t';
      continue;
    }

    if (element.localName === 'br' || element.localName === 'cr') {
      output += '\n';
      continue;
    }

    output += extractInlineText(element);
  }

  return output;
}

function extractParagraphText(paragraph: Element) {
  const text = extractInlineText(paragraph).replace(/\u00a0/g, ' ');
  return text.replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
}

function paragraphToHtml(paragraph: Element) {
  const paragraphProperties = getDirectChildren(paragraph, 'pPr')[0];
  const paragraphStyle = paragraphProperties
    ? getAttr(getDirectChildren(paragraphProperties, 'pStyle')[0] || paragraphProperties, 'val')
    : '';
  const text = extractParagraphText(paragraph);
  const safeText = escapeHtml(text).replace(/\n/g, '<br />');

  if (!text) {
    return '<p style="margin:0 0 12px; min-height: 1.35em;">&nbsp;</p>';
  }

  const styleMap: Record<string, string> = {
    Title: 'font-size: 28px; font-weight: 800; line-height: 1.2; margin: 0 0 18px; text-align: center;',
    Heading1: 'font-size: 22px; font-weight: 800; line-height: 1.25; margin: 0 0 16px;',
    Heading2: 'font-size: 18px; font-weight: 700; line-height: 1.3; margin: 0 0 14px;',
    Heading3: 'font-size: 16px; font-weight: 700; line-height: 1.35; margin: 0 0 12px;',
  };

  const style = styleMap[paragraphStyle] || 'margin: 0 0 12px; line-height: 1.7;';
  const tagName = paragraphStyle === 'Title' ? 'h1' : paragraphStyle === 'Heading1' ? 'h2' : paragraphStyle === 'Heading2' ? 'h3' : 'p';

  return `<${tagName} style="${style}">${safeText}</${tagName}>`;
}

function tableCellToHtml(cell: Element) {
  const texts: string[] = [];

  for (const paragraph of getDirectChildren(cell, 'p')) {
    const text = extractParagraphText(paragraph);
    if (text) texts.push(text);
  }

  const fallback = cell.textContent?.replace(/\s+/g, ' ').trim() || '';
  const content = texts.length > 0 ? texts.join('<br />') : escapeHtml(fallback);

  return `<td style="border:1px solid #d1d5db; padding:8px 10px; vertical-align: top; line-height:1.55;">${content || '&nbsp;'}</td>`;
}

function tableToHtml(table: Element) {
  const rows = getDirectChildren(table, 'tr');
  const body = rows
    .map((row) => {
      const cells = getDirectChildren(row, 'tc')
        .map((cell) => tableCellToHtml(cell))
        .join('');
      return `<tr>${cells}</tr>`;
    })
    .join('');

  return `
    <table style="width:100%; border-collapse: collapse; margin: 0 0 18px; font-size: 14px;">
      <tbody>${body}</tbody>
    </table>
  `;
}

function bodyNodeToHtml(body: Element) {
  const fragments: string[] = [];

  for (const child of Array.from(body.children)) {
    if (child.namespaceURI !== WORD_NS) continue;

    if (child.localName === 'p') {
      fragments.push(paragraphToHtml(child));
      continue;
    }

    if (child.localName === 'tbl') {
      fragments.push(tableToHtml(child));
    }
  }

  return fragments.join('\n');
}

export function parseDocxXml(xml: string): ParsedDocxDocument {
  const xmlDoc = new DOMParser().parseFromString(xml, 'text/xml');
  const parserError = xmlDoc.querySelector('parsererror');
  if (parserError) {
    throw new Error('Không đọc được nội dung file Word');
  }

  const body = xmlDoc.getElementsByTagNameNS(WORD_NS, 'body')[0];
  if (!body) {
    throw new Error('File Word không có phần nội dung');
  }

  const paragraphs = Array.from(body.getElementsByTagNameNS(WORD_NS, 'p'));
  const tables = Array.from(body.getElementsByTagNameNS(WORD_NS, 'tbl'));
  const text = paragraphs.map((paragraph) => extractParagraphText(paragraph)).filter(Boolean).join('\n');
  const html = bodyNodeToHtml(body);
  const wordCount = text ? text.split(/\s+/).filter(Boolean).length : 0;

  return {
    html,
    text,
    paragraphCount: paragraphs.length,
    tableCount: tables.length,
    wordCount,
  };
}

export async function parseDocxFile(file: File): Promise<ParsedDocxDocument> {
  const extension = file.name.split('.').pop()?.toLowerCase();
  if (extension !== 'docx') {
    throw new Error('Hiện chỉ hỗ trợ đọc file .docx');
  }

  const zip = CFB.read(new Uint8Array(await file.arrayBuffer()), { type: 'array' });
  const documentEntry = CFB.find(zip, 'word/document.xml');

  if (!documentEntry?.content) {
    throw new Error('Không tìm thấy nội dung tài liệu Word');
  }

  return parseDocxXml(decodeXmlBytes(documentEntry.content));
}

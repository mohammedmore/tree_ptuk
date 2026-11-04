export function parseCsvRows(text: string): string[][] {
  const csvText = text.startsWith("\uFEFF") ? text.slice(1) : text;
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let insideQuotes = false;
  let quoteClosed = false;

  for (let index = 0; index < csvText.length; index += 1) {
    const character = csvText[index];
    if (insideQuotes) {
      if (character === '"' && csvText[index + 1] === '"') {
        field += '"';
        index += 1;
      } else if (character === '"') {
        insideQuotes = false;
        quoteClosed = true;
      } else {
        field += character;
      }
      continue;
    }

    if (
      quoteClosed &&
      character !== "," &&
      character !== "\n" &&
      character !== "\r"
    ) {
      throw new Error("يوجد نص بعد نهاية الحقل المقتبس في ملف CSV.");
    }
    if (character === '"') {
      if (field.length > 0)
        throw new Error("علامات الاقتباس في ملف CSV غير صحيحة.");
      insideQuotes = true;
    } else if (character === ",") {
      row.push(field);
      field = "";
      quoteClosed = false;
    } else if (character === "\n" || character === "\r") {
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
      quoteClosed = false;
      if (character === "\r" && csvText[index + 1] === "\n") index += 1;
    } else {
      field += character;
    }
  }

  if (insideQuotes)
    throw new Error("يوجد حقل غير مكتمل بين علامات الاقتباس في ملف CSV.");
  if (field.length > 0 || row.length > 0 || quoteClosed) {
    row.push(field);
    rows.push(row);
  }
  return rows;
}

/**
 * Neutralizes CSV Formula Injection (CWE-1236).
 * Prepends a single quote if the value begins with formula characters (=, +, -, @, \t, \r).
 */
export function sanitizeCsvFormula(
  value: string | number | null | undefined,
): string {
  if (value == null) return "";
  const str = String(value);
  if (/^[\s]*[=+\-@\t\r]/.test(str)) {
    return `'${str}`;
  }
  return str;
}

export function escapeCsvValue(
  value: string | number | null | undefined,
): string {
  const safe = sanitizeCsvFormula(value);
  return `"${safe.replace(/"/g, '""')}"`;
}

export const CSV_HEADERS = [
  "رقم المادة",
  "اسم المادة",
  "التصنيف",
  "الساعات",
  "الحالة",
] as const;

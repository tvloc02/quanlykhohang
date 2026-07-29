export function numberToVietnameseWords(number: number): string {
  if (!number || number === 0) return "Không đồng";

  const units = ["", "nghìn", "triệu", "tỷ", "nghìn tỷ", "triệu tỷ"];
  const digits = ["không", "một", "hai", "ba", "bốn", "năm", "sáu", "bảy", "tám", "chín"];

  function readGroupOfThree(n: number, isFirst: boolean): string {
    let str = "";
    const hundred = Math.floor(n / 100);
    const ten = Math.floor((n % 100) / 10);
    const unit = n % 10;

    if (hundred > 0 || !isFirst) {
      str += digits[hundred] + " trăm ";
      if (ten === 0 && unit > 0) str += "lẻ ";
    }

    if (ten === 1) {
      str += "mười ";
    } else if (ten > 1) {
      str += digits[ten] + " mươi ";
    }

    if (unit === 1 && ten > 1) {
      str += "mốt ";
    } else if (unit === 5 && ten > 0) {
      str += "lăm ";
    } else if (unit > 0) {
      str += digits[unit] + " ";
    }

    return str.trim();
  }

  let result = "";
  let unitIndex = 0;
  let remaining = Math.abs(Math.floor(number));

  if (remaining === 0) return "Không đồng";

  while (remaining > 0) {
    const group = remaining % 1000;
    remaining = Math.floor(remaining / 1000);

    if (group > 0) {
      const groupStr = readGroupOfThree(group, remaining === 0);
      result = groupStr + " " + units[unitIndex] + " " + result;
    }
    unitIndex++;
  }

  result = result.trim().replace(/\s+/g, " ");
  if (!result) return "Không đồng";

  return result.charAt(0).toUpperCase() + result.slice(1) + " đồng chẵn.";
}

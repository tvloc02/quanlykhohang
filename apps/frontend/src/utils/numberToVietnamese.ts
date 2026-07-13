
export function numberToVietnameseWords(number: number): string {
  if (number === 0) return "không ð?ng";
  
  const units = ["", "ngh?n", "tri?u", "t?", "ngh?n t?", "tri?u t?"];
  const digits = ["không", "m?t", "hai", "ba", "b?n", "nãm", "sáu", "b?y", "tám", "chín"];
  
  function readGroupOfThree(n: number, isFirst: boolean): string {
    let str = "";
    const hundred = Math.floor(n / 100);
    const ten = Math.floor((n % 100) / 10);
    const unit = n % 10;
    
    if (hundred > 0 || !isFirst) {
      str += digits[hundred] + " trãm ";
      if (ten === 0 && unit > 0) str += "l? ";
    }
    
    if (ten === 1) str += "mý?i ";
    else if (ten > 1) str += digits[ten] + " mýõi ";
    
    if (unit === 1 && ten > 1) str += "m?t ";
    else if (unit === 5 && ten > 0) str += "lãm ";
    else if (unit > 0) str += digits[unit] + " ";
    
    return str.trim();
  }
  
  let result = "";
  let unitIndex = 0;
  let remaining = number;
  
  while (remaining > 0) {
    const group = remaining % 1000;
    remaining = Math.floor(remaining / 1000);
    
    if (group > 0) {
      const groupStr = readGroupOfThree(group, remaining === 0);
      result = groupStr + " " + units[unitIndex] + " " + result;
    }
    unitIndex++;
  }
  
  result = result.trim();
  result = result.replace(/\s+/g, " ");
  return result.charAt(0).toUpperCase() + result.slice(1) + " ð?ng ch?n.";
}


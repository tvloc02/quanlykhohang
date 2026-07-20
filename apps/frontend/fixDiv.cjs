const fs = require('fs');
const content = fs.readFileSync('src/features/auth/Signup.tsx', 'utf-8');
const lines = content.split('\n');

for (let i = 0; i < lines.length; i++) {
  if (lines[i].includes('Hoặc đăng ký với tài khoản')) {
    if (lines[i-1] && lines[i-1].includes('flex-1 h-px')) {
      lines.splice(i-1, 0, '            <div className="my-8 flex items-center gap-4">');
      break;
    }
  }
}

fs.writeFileSync('src/features/auth/Signup.tsx', lines.join('\n'));
console.log('Fixed missing div');

const fs = require('fs');

// Read Login.tsx
const loginContent = fs.readFileSync('src/features/auth/Login.tsx', 'utf-8');

// Read Signup.tsx
let signupContent = fs.readFileSync('src/features/auth/Signup.tsx', 'utf-8');

// Extract Google types and state
const globalTypes = `
declare global {
  interface Window {
    google?: {
      accounts: {
        id: {
          initialize: (config: { client_id: string; callback: (response: { credential?: string }) => void }) => void;
          renderButton: (element: HTMLElement, options: { theme: 'outline' | 'filled_blue' | 'filled_black'; size: 'large' | 'medium' | 'small'; text?: string; shape?: string; logo_alignment?: string }) => void;
          prompt: () => void;
          disableAutoSelect?: () => void;
        };
      };
    };
  }
}
`;

if (!signupContent.includes('declare global')) {
  signupContent = signupContent.replace('type Toast', globalTypes + '\ntype Toast');
}

// Add state
const stateToAdd = `  const [googleReady, setGoogleReady] = React.useState(false);
  const hiddenGoogleRef = React.useRef<HTMLDivElement | null>(null);

  const handleGoogleSignIn = () => {
    if (!googleReady) {
      setToast({ type: 'error', title: 'Google chưa sẵn sàng', message: 'Vui lòng đợi thư viện Google tải xong hoặc refresh trang' });
      return;
    }
    if (window.google?.accounts?.id) {
      try { window.google.accounts.id.prompt(); } catch (e) { setToast({ type: 'error', title: 'Lỗi Google', message: 'Không thể mở popup Google' }); }
    } else {
      setToast({ type: 'error', title: 'Lỗi Google', message: 'Google Identity chưa sẵn sàng' });
    }
  };

`;
if (!signupContent.includes('const [googleReady')) {
  signupContent = signupContent.replace('const [loading, setLoading] = React.useState(false);', 'const [loading, setLoading] = React.useState(false);\n' + stateToAdd);
}

// Extract useEffect from Login.tsx
const loginLines = loginContent.split('\n');
const effectStart = loginLines.findIndex(l => l.includes('const clientId = '));
let effectEnd = -1;
let openBrackets = 0;
for (let i = effectStart; i < loginLines.length; i++) {
  if (loginLines[i].includes('{')) openBrackets += (loginLines[i].match(/\{/g) || []).length;
  if (loginLines[i].includes('}')) openBrackets -= (loginLines[i].match(/\}/g) || []).length;
  if (openBrackets === 0) {
    // We want the end of the useEffect
    if (loginLines[i+1] && loginLines[i+1].includes('}, [navigate]);')) {
        effectEnd = i + 1;
        break;
    }
  }
}
const googleEffectLines = loginLines.slice(effectStart - 1, effectEnd + 1).join('\n');

if (!signupContent.includes('const clientId = ')) {
  signupContent = signupContent.replace('const handleChange = ', googleEffectLines + '\n\n  const handleChange = ');
}

// Extract UI from Login.tsx
const uiStart = loginLines.findIndex(l => l.includes('Hoặc đăng nhập với tài khoản'));
let uiEnd = -1;
for (let i = uiStart; i < loginLines.length; i++) {
  if (loginLines[i].includes('Bạn chưa có tài khoản?')) {
    uiEnd = i - 1;
    break;
  }
}
const uiHtml = loginLines.slice(uiStart - 1, uiEnd).join('\n').replace('Hoặc đăng nhập với tài khoản', 'Hoặc đăng ký với tài khoản').replace('Đăng nhập bằng Google', 'Đăng ký bằng Google');

if (!signupContent.includes('Hoặc đăng ký với tài khoản')) {
  signupContent = signupContent.replace('            <p className="text-center text-sm text-slate-500 mt-8">', uiHtml + '\n\n            <p className="text-center text-sm text-slate-500 mt-8">');
}

fs.writeFileSync('src/features/auth/Signup.tsx', signupContent);
console.log('Added Google Login to Signup.tsx');

import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

export default function DifyChatbot() {
  const location = useLocation();

  useEffect(() => {
    const token = localStorage.getItem('token');
    const publicPaths = ['/login', '/signup', '/'];
    const isPublic = publicPaths.includes(location.pathname);
    const shouldShow = Boolean(token) && !isPublic;

    const addCustomControls = (win: HTMLElement) => {
      if (win.querySelector('.dify-custom-controls')) return;

      const controls = document.createElement('div');
      controls.className = 'dify-custom-controls';

      const maxBtn = document.createElement('button');
      maxBtn.className = 'dify-custom-btn';
      maxBtn.title = 'Phóng to / Thu nhỏ toàn màn hình';
      maxBtn.innerHTML = '⛶';

      let isMaximized = false;
      let prevStyle = { left: '', top: '', width: '', height: '', position: '' };

      maxBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        e.preventDefault();

        isMaximized = !isMaximized;
        if (isMaximized) {
          prevStyle = {
            left: win.style.left,
            top: win.style.top,
            width: win.style.width,
            height: win.style.height,
            position: win.style.position,
          };
          win.classList.add('fullscreen');
          maxBtn.innerHTML = '🗗';
        } else {
          win.classList.remove('fullscreen');
          win.style.left = prevStyle.left;
          win.style.top = prevStyle.top;
          win.style.width = prevStyle.width;
          win.style.height = prevStyle.height;
          win.style.position = prevStyle.position;
          maxBtn.innerHTML = '⛶';
        }
      });

      controls.appendChild(maxBtn);
      win.appendChild(controls);
    };

    const makeElementDraggable = (element: HTMLElement, isButton = false) => {
      if (element.dataset.draggable === 'true') return;
      element.dataset.draggable = 'true';

      let isDragging = false;
      let startX = 0;
      let startY = 0;
      let initialLeft = 0;
      let initialTop = 0;
      let movedDistance = 0;

      const getClientPos = (e: MouseEvent | TouchEvent) => {
        if ('touches' in e && e.touches.length > 0) {
          return { x: e.touches[0].clientX, y: e.touches[0].clientY };
        }
        return { x: (e as MouseEvent).clientX, y: (e as MouseEvent).clientY };
      };

      const onStart = (e: MouseEvent | TouchEvent) => {
        // Do not drag window if in fullscreen mode
        if (!isButton && element.classList.contains('fullscreen')) return;

        const target = e.target as HTMLElement;
        if (
          !isButton &&
          target &&
          (['INPUT', 'TEXTAREA', 'BUTTON', 'A', 'SELECT'].includes(target.tagName) ||
            target.closest('.dify-custom-controls'))
        ) {
          return;
        }

        const pos = getClientPos(e);
        const rect = element.getBoundingClientRect();

        // Check if mouse is on resize handle (bottom-right edge) for window
        if (!isButton) {
          const isResizeEdge = pos.x > rect.right - 20 && pos.y > rect.bottom - 20;
          if (isResizeEdge) return;
        }

        startX = pos.x;
        startY = pos.y;
        initialLeft = rect.left;
        initialTop = rect.top;

        element.style.position = 'fixed';
        element.style.bottom = 'auto';
        element.style.right = 'auto';
        element.style.left = `${initialLeft}px`;
        element.style.top = `${initialTop}px`;
        element.style.cursor = 'grabbing';
        element.style.transition = 'none';

        isDragging = true;
        movedDistance = 0;

        window.addEventListener('mousemove', onMove, { passive: false });
        window.addEventListener('touchmove', onMove, { passive: false });
        window.addEventListener('mouseup', onEnd);
        window.addEventListener('touchend', onEnd);
      };

      const onMove = (e: MouseEvent | TouchEvent) => {
        if (!isDragging || (!isButton && element.classList.contains('fullscreen'))) return;

        const pos = getClientPos(e);
        const deltaX = pos.x - startX;
        const deltaY = pos.y - startY;
        movedDistance = Math.hypot(deltaX, deltaY);

        if (movedDistance > 3 && e.cancelable) {
          e.preventDefault();
        }

        let newLeft = initialLeft + deltaX;
        let newTop = initialTop + deltaY;

        const maxLeft = window.innerWidth - element.offsetWidth;
        const maxTop = window.innerHeight - element.offsetHeight;

        newLeft = Math.max(0, Math.min(newLeft, maxLeft));
        newTop = Math.max(0, Math.min(newTop, maxTop));

        element.style.left = `${newLeft}px`;
        element.style.top = `${newTop}px`;
      };

      const onEnd = () => {
        if (!isDragging) return;
        isDragging = false;

        element.style.cursor = '';
        element.style.transition = '';

        window.removeEventListener('mousemove', onMove);
        window.removeEventListener('touchmove', onMove);
        window.removeEventListener('mouseup', onEnd);
        window.removeEventListener('touchend', onEnd);

        // Prevent opening window on drag end if user was dragging the button
        if (isButton && movedDistance > 5) {
          const captureClick = (clickEvent: MouseEvent) => {
            clickEvent.stopPropagation();
            clickEvent.preventDefault();
            window.removeEventListener('click', captureClick, true);
          };
          window.addEventListener('click', captureClick, true);
        }
      };

      element.addEventListener('mousedown', onStart);
      element.addEventListener('touchstart', onStart, { passive: true });
    };

    const updateBot = () => {
      const btn = document.getElementById('dify-chatbot-bubble-button');
      const win = document.getElementById('dify-chatbot-bubble-window');

      if (btn) {
        btn.style.display = shouldShow ? 'flex' : 'none';
        if (shouldShow) makeElementDraggable(btn, true);
      }

      if (win) {
        if (!shouldShow) {
          win.style.display = 'none';
        } else {
          addCustomControls(win);
          makeElementDraggable(win, false);
        }
      }
    };

    updateBot();
    const interval = setInterval(updateBot, 400);
    return () => clearInterval(interval);
  }, [location.pathname]);

  return null;
}

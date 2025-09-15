(function (Scratch) {
  'use strict';

  if (!Scratch.extensions.unsandboxed) {
    throw new Error('Panel GUI requires unsandboxed mode for DOM access.');
  }

  // Try to overlay on the stage; fall back to body
  const stageRoot =
    document.querySelector('.stage_stage_') ||
    document.querySelector('[class*="stage_stage_"]') ||
    document.querySelector('#app') ||
    document.body;

  // ------- state -------
  const windows = {}; // id -> {div,titleBar,content,elements:{},visible,...}
  let zCounter = 10000;

  // ------- helpers: use coordinates relative to parent (stageRoot) -------
  function parentRectFor(el) {
    const parent = el.parentElement || stageRoot;
    return parent.getBoundingClientRect();
  }

  // Robust draggable: positions remain relative to parent
  function makeDraggable(winDiv, titleBar) {
    let dragging = false;
    let startClientX = 0;
    let startClientY = 0;
    let startLeft = 0;
    let startTop = 0;

    function calcStartOffsets() {
      // read style left/top if present, otherwise compute from getBoundingClientRect relative to parent
      const pRect = parentRectFor(winDiv);
      const rect = winDiv.getBoundingClientRect();
      const leftStyle = parseFloat(winDiv.style.left);
      const topStyle = parseFloat(winDiv.style.top);
      startLeft = !isNaN(leftStyle) ? leftStyle : (rect.left - pRect.left);
      startTop = !isNaN(topStyle) ? topStyle : (rect.top - pRect.top);
    }

    function onDown(e) {
      const ev = e.touches ? e.touches[0] : e;
      dragging = true;
      zCounter += 1;
      winDiv.style.zIndex = zCounter;

      calcStartOffsets();
      startClientX = ev.clientX;
      startClientY = ev.clientY;

      document.addEventListener('mousemove', onMove);
      document.addEventListener('mouseup', onUp);
      document.addEventListener('touchmove', onTouchMove, { passive: false });
      document.addEventListener('touchend', onUp);

      e.preventDefault && e.preventDefault();
    }

    function onMove(e) {
      if (!dragging) return;
      const ev = e.touches ? e.touches[0] : e;
      const dx = ev.clientX - startClientX;
      const dy = ev.clientY - startClientY;

      const parentRect = parentRectFor(winDiv);
      const newLeft = startLeft + dx;
      const newTop = startTop + dy;

      // clamp so window stays visible within parent area
      const maxLeft = Math.max(0, parentRect.width - winDiv.offsetWidth);
      const maxTop = Math.max(0, parentRect.height - winDiv.offsetHeight);
      const clampedLeft = Math.min(Math.max(0, newLeft), maxLeft);
      const clampedTop = Math.min(Math.max(0, newTop), maxTop);

      winDiv.style.left = clampedLeft + 'px';
      winDiv.style.top = clampedTop + 'px';
    }

    function onTouchMove(e) {
      if (!dragging) return;
      e.preventDefault();
      onMove(e);
    }

    function onUp() {
      if (!dragging) return;
      dragging = false;
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
      document.removeEventListener('touchmove', onTouchMove);
      document.removeEventListener('touchend', onUp);
    }

    titleBar.addEventListener('mousedown', onDown);
    titleBar.addEventListener('touchstart', onDown, { passive: false });
    titleBar.style.cursor = 'move';
  }

  // Resizable using a corner handle, clamped to parent
  function makeResizable(winDiv) {
    const handle = document.createElement('div');
    Object.assign(handle.style, {
      position: 'absolute',
      width: '14px',
      height: '14px',
      right: '6px',
      bottom: '6px',
      cursor: 'nwse-resize',
      background: 'transparent',
      zIndex: 2147483647
    });
    winDiv.appendChild(handle);

    let resizing = false;
    let startX = 0, startY = 0, startW = 0, startH = 0, startLeft = 0, startTop = 0;

    function onDown(e) {
      e.stopPropagation();
      const ev = e.touches ? e.touches[0] : e;
      resizing = true;
      startX = ev.clientX;
      startY = ev.clientY;
      startW = winDiv.offsetWidth;
      startH = winDiv.offsetHeight;

      // compute offsets relative to parent for clamping
      const pRect = parentRectFor(winDiv);
      const rect = winDiv.getBoundingClientRect();
      startLeft = rect.left - pRect.left;
      startTop = rect.top - pRect.top;

      document.addEventListener('mousemove', onMove);
      document.addEventListener('mouseup', onUp);
      document.addEventListener('touchmove', onTouchMove, { passive: false });
      document.addEventListener('touchend', onUp);
    }

    function onMove(e) {
      if (!resizing) return;
      const ev = e.touches ? e.touches[0] : e;
      const dx = ev.clientX - startX;
      const dy = ev.clientY - startY;

      const parentRect = parentRectFor(winDiv);
      let newW = Math.max(120, startW + dx);
      let newH = Math.max(80, startH + dy);

      // clamp so window stays within parent area
      const maxW = Math.max(120, parentRect.width - startLeft);
      const maxH = Math.max(80, parentRect.height - startTop);
      newW = Math.min(newW, maxW);
      newH = Math.min(newH, maxH);

      winDiv.style.width = newW + 'px';
      winDiv.style.height = newH + 'px';
    }

    function onTouchMove(e) {
      if (!resizing) return;
      e.preventDefault();
      onMove(e);
    }

    function onUp() {
      if (!resizing) return;
      resizing = false;
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
      document.removeEventListener('touchmove', onTouchMove);
      document.removeEventListener('touchend', onUp);
    }

    handle.addEventListener('mousedown', onDown);
    handle.addEventListener('touchstart', onDown, { passive: false });
  }

  // ------- window factory -------
  function ensureWindow(id, title) {
    const stringId = String(id);
    if (windows[stringId]) return windows[stringId];

    const winDiv = document.createElement('div');
    Object.assign(winDiv.style, {
      position: 'absolute',
      left: '120px',
      top: '120px',
      width: '320px',
      height: '220px',
      background: '#ffffff',
      border: '2px solid #333',
      borderRadius: '10px',
      overflow: 'hidden',
      display: 'flex',
      flexDirection: 'column',
      boxShadow: '0 8px 16px rgba(0,0,0,0.25)',
      zIndex: ++zCounter,
      boxSizing: 'border-box'
    });

    const titleBar = document.createElement('div');
    Object.assign(titleBar.style, {
      background: '#2ecc71',
      color: '#ffffff',
      padding: '6px 10px',
      fontWeight: '600',
      cursor: 'move',
      userSelect: 'none',
      flexShrink: 0
    });
    titleBar.textContent = title || stringId;

    const content = document.createElement('div');
    Object.assign(content.style, {
      flex: 1,
      overflow: 'auto',
      padding: '8px',
      color: '#222',
      background: '#fff'
    });

    const closeBtn = document.createElement('button');
    closeBtn.textContent = '✕';
    Object.assign(closeBtn.style, {
      position: 'absolute',
      top: '6px',
      right: '6px',
      width: '22px',
      height: '22px',
      border: 'none',
      background: 'rgba(0,0,0,0.2)',
      color: '#fff',
      borderRadius: '4px',
      cursor: 'pointer',
      lineHeight: '22px',
      padding: 0
    });
    closeBtn.addEventListener('click', () => {
      try { winDiv.remove(); } catch (e) {}
      delete windows[stringId];
    });

    winDiv.appendChild(titleBar);
    winDiv.appendChild(content);
    winDiv.appendChild(closeBtn);

    // Append to stageRoot (parent) and ensure left/top are relative to parent
    stageRoot.appendChild(winDiv);

    // Ensure left/top are numeric px relative to parent (they are already '120px', OK)
    makeDraggable(winDiv, titleBar);
    makeResizable(winDiv);

    windows[stringId] = {
      id: stringId,
      title: title || stringId,
      div: winDiv,
      titleBar,
      content,
      elements: {},
      visible: true,
      styles: { top: '#2ecc71', text: '#222', title: '#fff', bg: '#fff' }
    };
    return windows[stringId];
  }

  function removeElement(winId, elId) {
    const w = windows[String(winId)];
    if (!w) return;
    const info = w.elements[String(elId)];
    if (!info) return;
    if (info.wrapper && info.wrapper.remove) info.wrapper.remove();
    else if (info.element && info.element.remove) info.element.remove();
    delete w.elements[String(elId)];
  }

  // ------- element builders -------
  function labelFor(text) {
    const lbl = document.createElement('label');
    lbl.textContent = text || '';
    lbl.style.marginRight = '6px';
    return lbl;
  }

  function addButton(win, elId, text) {
    removeElement(win.id, elId);
    const btn = document.createElement('button');
    btn.textContent = text || 'Button';
    Object.assign(btn.style, { margin: '4px', padding: '6px 10px', borderRadius: '8px', border: '1px solid #ccc' });
    const wrap = document.createElement('div');
    wrap.style.margin = '4px';
    wrap.appendChild(btn);

    const info = { type: 'button', element: btn, wrapper: wrap, clicked: false };
    btn.addEventListener('click', () => { info.clicked = true; });
    win.content.appendChild(wrap);
    win.elements[elId] = info;
  }

  function addSlider(win, elId, labelText, min, max, defVal) {
    removeElement(win.id, elId);
    const wrap = document.createElement('div');
    wrap.style.margin = '6px';
    wrap.style.display = 'flex';
    wrap.style.alignItems = 'center';
    const lbl = labelFor(labelText || 'Slider');
    const input = document.createElement('input');
    input.type = 'range';
    input.min = isFinite(+min) ? +min : 0;
    input.max = isFinite(+max) ? +max : 100;
    input.value = isFinite(+defVal) ? +defVal : Math.round((+input.min + +input.max) / 2);
    const val = document.createElement('span');
    val.style.marginLeft = '8px';
    val.textContent = input.value;
    input.addEventListener('input', () => { val.textContent = input.value; });
    wrap.appendChild(lbl); wrap.appendChild(input); wrap.appendChild(val);
    win.content.appendChild(wrap);
    win.elements[elId] = { type: 'slider', element: input, wrapper: wrap, meta: { min: input.min, max: input.max } };
  }

  function addDropdown(win, elId, labelText, opts) {
    removeElement(win.id, elId);
    const wrap = document.createElement('div');
    wrap.style.margin = '6px';
    const lbl = labelFor(labelText || 'Choose');
    const sel = document.createElement('select');
    for (const o of (opts || ['Option 1', 'Option 2'])) {
      const opt = document.createElement('option');
      opt.textContent = o;
      sel.appendChild(opt);
    }
    wrap.appendChild(lbl); wrap.appendChild(sel);
    win.content.appendChild(wrap);
    win.elements[elId] = { type: 'drop-down', element: sel, wrapper: wrap };
  }

  function addCheckbox(win, elId, labelText, defBool) {
    removeElement(win.id, elId);
    const wrap = document.createElement('div');
    wrap.style.margin = '6px';
    wrap.style.display = 'flex';
    wrap.style.alignItems = 'center';
    const cb = document.createElement('input');
    cb.type = 'checkbox';
    cb.checked = !!defBool;
    cb.style.marginRight = '6px';
    const lbl = labelFor(labelText || 'Check');
    wrap.appendChild(cb); wrap.appendChild(lbl);
    win.content.appendChild(wrap);
    win.elements[elId] = { type: 'check box', element: cb, wrapper: wrap };
  }

  function addText(win, elId, textType, text) {
    removeElement(win.id, elId);
    let el;
    switch ((textType || 'text').toLowerCase()) {
      case 'header': el = document.createElement('h2'); break;
      case 'footer': el = document.createElement('h4'); break;
      case 'description': el = document.createElement('small'); break;
      default: el = document.createElement('p'); break;
    }
    el.textContent = text || '';
    el.style.margin = '6px';
    win.content.appendChild(el);
    win.elements[elId] = { type: textType, element: el };
  }

  function addInput(win, elId, kind, placeholder) {
    removeElement(win.id, elId);
    const wrap = document.createElement('div');
    wrap.style.margin = '6px';
    const input = document.createElement('input');
    input.type = (kind === 'number') ? 'number' : 'text';
    input.placeholder = placeholder || (kind === 'number' ? '0' : 'Type...');
    input.style.width = '100%';
    input.style.boxSizing = 'border-box';
    wrap.appendChild(input);
    win.content.appendChild(wrap);
    win.elements[elId] = { type: (kind === 'number' ? 'number input' : 'text input'), element: input, wrapper: wrap };
  }

  function addHTML(win, elId, html) {
    removeElement(win.id, elId);
    const block = document.createElement('div');
    block.style.margin = '6px';
    // WARNING: innerHTML is powerful; do not feed untrusted HTML.
    block.innerHTML = html || '<b>HTML</b>';
    win.content.appendChild(block);
    win.elements[elId] = { type: 'html', element: block };
  }

  function setWindowColors(win, topColor, textColor, titleColor, bgColor) {
    if (topColor) win.titleBar.style.background = topColor;
    if (titleColor) win.titleBar.style.color = titleColor;
    if (bgColor) {
      win.div.style.background = bgColor;
      win.content.style.background = bgColor;
    }
    if (textColor) win.content.style.color = textColor;
    win.styles = {
      top: win.titleBar.style.background,
      text: win.content.style.color,
      title: win.titleBar.style.color,
      bg: win.content.style.background
    };
  }

  // ------- Extension -------
  class PanelGUI {
    getInfo() {
      return {
        id: 'panelgui',
        name: 'Panel GUI',
        color1: '#2ecc71',
        color2: '#27ae60',
        blocks: [
          // Windows
          { opcode: 'openWindow', blockType: Scratch.BlockType.COMMAND,
            text: 'Open Window [NAME] with ID: [WID]',
            arguments: { NAME: { type: Scratch.ArgumentType.STRING, defaultValue: 'My Window' }, WID: { type: Scratch.ArgumentType.STRING, defaultValue: 'win1' } } },
          { opcode: 'closeWindow', blockType: Scratch.BlockType.COMMAND,
            text: 'Close Window with ID: [WID]',
            arguments: { WID: { type: Scratch.ArgumentType.STRING, defaultValue: 'win1' } } },
          { opcode: 'closeAll', blockType: Scratch.BlockType.COMMAND, text: 'Close all Windows' },

          { opcode: 'setWindowPos', blockType: Scratch.BlockType.COMMAND,
            text: 'Set Window [WID] Position to X: [X] Y: [Y]',
            arguments: { WID: { type: Scratch.ArgumentType.STRING, defaultValue: 'win1' }, X: { type: Scratch.ArgumentType.NUMBER, defaultValue: 120 }, Y: { type: Scratch.ArgumentType.NUMBER, defaultValue: 120 } } },

          { opcode: 'setWindowSize', blockType: Scratch.BlockType.COMMAND,
            text: 'Set Window [WID] Stretch to Width: [W] Height: [H]',
            arguments: { WID: { type: Scratch.ArgumentType.STRING, defaultValue: 'win1' }, W: { type: Scratch.ArgumentType.NUMBER, defaultValue: 320 }, H: { type: Scratch.ArgumentType.NUMBER, defaultValue: 220 } } },

          { opcode: 'setWindowShowHide', blockType: Scratch.BlockType.COMMAND,
            text: 'Set Window [WID] to [STATE]',
            arguments: { WID: { type: Scratch.ArgumentType.STRING, defaultValue: 'win1' }, STATE: { type: Scratch.ArgumentType.STRING, menu: 'showHide', defaultValue: 'show' } } },

          { opcode: 'setWindowTitle', blockType: Scratch.BlockType.COMMAND,
            text: 'Set Window [WID] Title: [TITLE]',
            arguments: { WID: { type: Scratch.ArgumentType.STRING, defaultValue: 'win1' }, TITLE: { type: Scratch.ArgumentType.STRING, defaultValue: 'New Title' } } },

          { opcode: 'setWindowStyle', blockType: Scratch.BlockType.COMMAND,
            text: 'Set Window [WID] Style to top: [TOP] Text: [TEXT] Title: [TITLECOLOR] BG: [BG]',
            arguments: {
              WID: { type: Scratch.ArgumentType.STRING, defaultValue: 'win1' },
              TOP: { type: Scratch.ArgumentType.COLOR, defaultValue: '#2ecc71' },
              TEXT: { type: Scratch.ArgumentType.COLOR, defaultValue: '#222222' },
              TITLECOLOR: { type: Scratch.ArgumentType.COLOR, defaultValue: '#ffffff' },
              BG: { type: Scratch.ArgumentType.COLOR, defaultValue: '#ffffff' }
            } },

          { opcode: 'getWindowJSON', blockType: Scratch.BlockType.REPORTER,
            text: 'Get [WID] JSON value',
            arguments: { WID: { type: Scratch.ArgumentType.STRING, defaultValue: 'win1' } } },

          // GUI elements (separate)
          { opcode: 'buttonBlock', blockType: Scratch.BlockType.COMMAND,
            text: '[ACTION] button [TEXT] with button ID: [GID] set to Window ID: [WID]',
            arguments: {
              ACTION: { type: Scratch.ArgumentType.STRING, menu: 'createDelete', defaultValue: 'create' },
              TEXT: { type: Scratch.ArgumentType.STRING, defaultValue: 'Click Me' },
              GID: { type: Scratch.ArgumentType.STRING, defaultValue: 'btn1' },
              WID: { type: Scratch.ArgumentType.STRING, defaultValue: 'win1' } } },

          { opcode: 'sliderBlock', blockType: Scratch.BlockType.COMMAND,
            text: '[ACTION] slider [LABEL] Min: [MIN] Max: [MAX] Default: [DEF] slider ID: [GID] set to Window ID: [WID]',
            arguments: {
              ACTION: { type: Scratch.ArgumentType.STRING, menu: 'createDelete', defaultValue: 'create' },
              LABEL: { type: Scratch.ArgumentType.STRING, defaultValue: 'Volume' },
              MIN: { type: Scratch.ArgumentType.NUMBER, defaultValue: 0 },
              MAX: { type: Scratch.ArgumentType.NUMBER, defaultValue: 100 },
              DEF: { type: Scratch.ArgumentType.NUMBER, defaultValue: 50 },
              GID: { type: Scratch.ArgumentType.STRING, defaultValue: 'sld1' },
              WID: { type: Scratch.ArgumentType.STRING, defaultValue: 'win1' } } },

          { opcode: 'dropdownBlock', blockType: Scratch.BlockType.COMMAND,
            text: '[ACTION] drop-down [LABEL] options ([OPTS]) with drop-down ID: [GID] set to Window ID: [WID]',
            arguments: {
              ACTION: { type: Scratch.ArgumentType.STRING, menu: 'createDelete', defaultValue: 'create' },
              LABEL: { type: Scratch.ArgumentType.STRING, defaultValue: 'Choose' },
              OPTS: { type: Scratch.ArgumentType.STRING, defaultValue: 'Option 1, Option 2, Option 3' },
              GID: { type: Scratch.ArgumentType.STRING, defaultValue: 'dd1' },
              WID: { type: Scratch.ArgumentType.STRING, defaultValue: 'win1' } } },

          { opcode: 'checkboxBlock', blockType: Scratch.BlockType.COMMAND,
            text: '[ACTION] check box [LABEL] default: [DEF] with check box ID: [GID] set to Window ID: [WID]',
            arguments: {
              ACTION: { type: Scratch.ArgumentType.STRING, menu: 'createDelete', defaultValue: 'create' },
              LABEL: { type: Scratch.ArgumentType.STRING, defaultValue: 'Enable' },
              DEF: { type: Scratch.ArgumentType.STRING, menu: 'boolMenu', defaultValue: 'false' },
              GID: { type: Scratch.ArgumentType.STRING, defaultValue: 'cb1' },
              WID: { type: Scratch.ArgumentType.STRING, defaultValue: 'win1' } } },

          { opcode: 'textBlock', blockType: Scratch.BlockType.COMMAND,
            text: '[ACTION] [TEXTTYPE] with text: [TEXT] with text ID: [GID] set to Window ID: [WID]',
            arguments: {
              ACTION: { type: Scratch.ArgumentType.STRING, menu: 'createDelete', defaultValue: 'create' },
              TEXTTYPE: { type: Scratch.ArgumentType.STRING, menu: 'textTypes', defaultValue: 'text' },
              TEXT: { type: Scratch.ArgumentType.STRING, defaultValue: 'Hello!' },
              GID: { type: Scratch.ArgumentType.STRING, defaultValue: 'txt1' },
              WID: { type: Scratch.ArgumentType.STRING, defaultValue: 'win1' } } },

          { opcode: 'textInputBlock', blockType: Scratch.BlockType.COMMAND,
            text: '[ACTION] [KIND] input [PLACEHOLDER] with input ID: [GID] set to Window ID: [WID]',
            arguments: {
              ACTION: { type: Scratch.ArgumentType.STRING, menu: 'createDelete', defaultValue: 'create' },
              KIND: { type: Scratch.ArgumentType.STRING, menu: 'inputKinds', defaultValue: 'text' },
              PLACEHOLDER: { type: Scratch.ArgumentType.STRING, defaultValue: 'Type here...' },
              GID: { type: Scratch.ArgumentType.STRING, defaultValue: 'in1' },
              WID: { type: Scratch.ArgumentType.STRING, defaultValue: 'win1' } } },

          { opcode: 'htmlBlock', blockType: Scratch.BlockType.COMMAND,
            text: '[ACTION] HTML: [HTML] with HTML ID: [GID] set to Window ID: [WID]',
            arguments: {
              ACTION: { type: Scratch.ArgumentType.STRING, menu: 'createDelete', defaultValue: 'create' },
              HTML: { type: Scratch.ArgumentType.STRING, defaultValue: '<b>HTML</b>' },
              GID: { type: Scratch.ArgumentType.STRING, defaultValue: 'html1' },
              WID: { type: Scratch.ArgumentType.STRING, defaultValue: 'win1' } } },

          // value reporter
          { opcode: 'getGUIValue', blockType: Scratch.BlockType.REPORTER,
            text: 'Get value of [GID] on Window [WID]',
            arguments: { GID: { type: Scratch.ArgumentType.STRING, defaultValue: 'sld1' }, WID: { type: Scratch.ArgumentType.STRING, defaultValue: 'win1' } } }
        ],
        menus: {
          createDelete: { items: ['create', 'delete'] },
          showHide: { items: ['show', 'hide'] },
          boolMenu: { items: ['true', 'false'] },
          textTypes: { items: ['header', 'footer', 'text', 'description'] },
          inputKinds: { items: ['text', 'number'] }
        }
      };
    }

    // ----- window ops -----
    openWindow({ NAME, WID }) { ensureWindow(String(WID), String(NAME)); }

    closeWindow({ WID }) {
      const w = windows[String(WID)];
      if (!w) return;
      try { w.div.remove(); } catch (e) {}
      delete windows[String(WID)];
    }

    closeAll() {
      for (const id in windows) { try { windows[id].div.remove(); } catch (e) {} }
      for (const id in windows) delete windows[id];
    }

    setWindowPos({ WID, X, Y }) {
      const w = ensureWindow(String(WID));
      // Set left/top relative to parent
      w.div.style.left = (Number(X) || 0) + 'px';
      w.div.style.top = (Number(Y) || 0) + 'px';
    }

    setWindowSize({ WID, W, H }) {
      const w = ensureWindow(String(WID));
      w.div.style.width = (Number(W) || 120) + 'px';
      w.div.style.height = (Number(H) || 80) + 'px';
    }

    setWindowShowHide({ WID, STATE }) {
      const w = ensureWindow(String(WID));
      const show = String(STATE) === 'show';
      w.div.style.display = show ? 'flex' : 'none';
      w.visible = show;
    }

    setWindowTitle({ WID, TITLE }) {
      const w = ensureWindow(String(WID));
      w.titleBar.textContent = String(TITLE);
      w.title = String(TITLE);
    }

    setWindowStyle({ WID, TOP, TEXT, TITLECOLOR, BG }) {
      const w = ensureWindow(String(WID));
      setWindowColors(w, String(TOP), String(TEXT), String(TITLECOLOR), String(BG));
    }

    getWindowJSON({ WID }) {
      const w = windows[String(WID)];
      if (!w) return '{}';
      // snapshot including left/top relative to parent
      const rect = w.div.getBoundingClientRect();
      const parent = w.div.parentElement ? w.div.parentElement.getBoundingClientRect() : { left: 0, top: 0 };
      const left = Math.round(rect.left - parent.left);
      const top = Math.round(rect.top - parent.top);
      const snap = {
        id: w.id,
        title: w.title,
        visible: w.visible,
        left, top,
        width: parseInt(w.div.style.width || w.div.offsetWidth, 10),
        height: parseInt(w.div.style.height || w.div.offsetHeight, 10),
        styles: w.styles,
        elements: {}
      };
      for (const eid in w.elements) {
        const e = w.elements[eid];
        let val = '';
        switch (e.type) {
          case 'button': val = !!e.clicked; break;
          case 'slider': val = e.element.value; break;
          case 'text input': val = e.element.value; break;
          case 'number input': val = e.element.value; break;
          case 'drop-down': val = e.element.value; break;
          case 'check box': val = !!e.element.checked; break;
          case 'header':
          case 'footer':
          case 'text':
          case 'description': val = e.element.textContent; break;
          case 'html': val = e.element.innerHTML; break;
        }
        snap.elements[eid] = { type: e.type, value: val };
      }
      return JSON.stringify(snap);
    }

    // ----- element ops -----
    buttonBlock({ ACTION, TEXT, GID, WID }) {
      const w = ensureWindow(String(WID));
      if (String(ACTION) === 'delete') return removeElement(w.id, String(GID));
      addButton(w, String(GID), String(TEXT));
    }

    sliderBlock({ ACTION, LABEL, MIN, MAX, DEF, GID, WID }) {
      const w = ensureWindow(String(WID));
      if (String(ACTION) === 'delete') return removeElement(w.id, String(GID));
      addSlider(w, String(GID), String(LABEL), Number(MIN), Number(MAX), Number(DEF));
    }

    dropdownBlock({ ACTION, LABEL, OPTS, GID, WID }) {
      const w = ensureWindow(String(WID));
      if (String(ACTION) === 'delete') return removeElement(w.id, String(GID));
      const opts = String(OPTS).split(',').map(s => s.trim()).filter(Boolean);
      addDropdown(w, String(GID), String(LABEL), opts);
    }

    checkboxBlock({ ACTION, LABEL, DEF, GID, WID }) {
      const w = ensureWindow(String(WID));
      if (String(ACTION) === 'delete') return removeElement(w.id, String(GID));
      addCheckbox(w, String(GID), String(LABEL), String(DEF) === 'true');
    }

    textBlock({ ACTION, TEXTTYPE, TEXT, GID, WID }) {
      const w = ensureWindow(String(WID));
      if (String(ACTION) === 'delete') return removeElement(w.id, String(GID));
      addText(w, String(GID), String(TEXTTYPE), String(TEXT));
    }

    textInputBlock({ ACTION, KIND, PLACEHOLDER, GID, WID }) {
      const w = ensureWindow(String(WID));
      if (String(ACTION) === 'delete') return removeElement(w.id, String(GID));
      addInput(w, String(GID), String(KIND), String(PLACEHOLDER));
    }

    htmlBlock({ ACTION, HTML, GID, WID }) {
      const w = ensureWindow(String(WID));
      if (String(ACTION) === 'delete') return removeElement(w.id, String(GID));
      addHTML(w, String(GID), String(HTML));
    }

    // value reporter
    getGUIValue({ GID, WID }) {
      const w = windows[String(WID)];
      if (!w) return '';
      const e = w.elements[String(GID)];
      if (!e) return '';
      switch (e.type) {
        case 'button': return e.clicked ? 'true' : 'false';
        case 'slider': return String(e.element.value);
        case 'text input': return String(e.element.value);
        case 'number input': return String(e.element.value);
        case 'drop-down': return String(e.element.value);
        case 'check box': return e.element.checked ? 'true' : 'false';
        case 'header':
        case 'footer':
        case 'text':
        case 'description': return String(e.element.textContent || '');
        case 'html': return String(e.element.innerHTML || '');
        default: return '';
      }
    }
  }

  Scratch.extensions.register(new PanelGUI());
})(Scratch);

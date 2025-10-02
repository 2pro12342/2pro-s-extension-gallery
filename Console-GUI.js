(function(Scratch) {
  'use strict';

  const vm = Scratch.vm;
  let consoleTitle = "Console";
  let consoleContent = [];
  let lastCommands = {}; // store commands by name
  let container = null;
  let header = null;
  let inputBox = null;

  // Helper: create draggable console window
  function createConsoleWindow() {
    if (container) return container;

    container = document.createElement("div");
    container.id = "scratch-console-container";
    container.style.position = "absolute";
    container.style.left = "50px";
    container.style.top = "50px";
    container.style.width = "400px";
    container.style.height = "200px";
    container.style.background = "#111";
    container.style.color = "#0f0";
    container.style.fontFamily = "monospace";
    container.style.fontSize = "12px";
    container.style.zIndex = "9999";
    container.style.border = "2px solid #0f0";
    container.style.borderRadius = "6px";
    container.style.overflow = "hidden";
    container.style.display = "flex";
    container.style.flexDirection = "column";

    // Header (draggable + close button)
    header = document.createElement("div");
    header.style.background = "#222";
    header.style.color = "#0f0";
    header.style.padding = "4px";
    header.style.cursor = "move";
    header.style.display = "flex";
    header.style.justifyContent = "space-between";
    header.style.alignItems = "center";

    const titleSpan = document.createElement("span");
    titleSpan.id = "scratch-console-title";
    titleSpan.textContent = consoleTitle;

    const closeBtn = document.createElement("button");
    closeBtn.textContent = "✖";
    closeBtn.style.background = "transparent";
    closeBtn.style.color = "#f44";
    closeBtn.style.border = "none";
    closeBtn.style.cursor = "pointer";
    closeBtn.style.fontSize = "14px";
    closeBtn.onclick = () => {
      closeConsoleWindow();
    };

    header.appendChild(titleSpan);
    header.appendChild(closeBtn);

    // Body
    const body = document.createElement("div");
    body.id = "scratch-console-body";
    body.style.flex = "1";
    body.style.overflowY = "auto";
    body.style.padding = "4px";

    // Input box
    inputBox = document.createElement("input");
    inputBox.type = "text";
    inputBox.placeholder = "Enter command...";
    inputBox.style.background = "#000";
    inputBox.style.color = "#0f0";
    inputBox.style.border = "1px solid #0f0";
    inputBox.style.padding = "2px";
    inputBox.style.display = "none"; // hidden by default
    inputBox.onkeydown = (e) => {
      if (e.key === "Enter" && inputBox.value.trim() !== "") {
        const value = inputBox.value.trim();
        lastCommands["input"] = value;
        addLine("[INPUT] " + value, "#ff0");
        inputBox.value = "";
      }
    };

    container.appendChild(header);
    container.appendChild(body);
    container.appendChild(inputBox);

    document.body.appendChild(container);

    // Make draggable
    makeDraggable(container, header);

    renderConsole();
    return container;
  }

  // Helper: draggable logic
  function makeDraggable(element, handle) {
    let offsetX = 0, offsetY = 0, isDown = false;

    handle.onmousedown = function(e) {
      isDown = true;
      offsetX = e.clientX - element.offsetLeft;
      offsetY = e.clientY - element.offsetTop;
      document.onmousemove = dragMouse;
      document.onmouseup = closeDrag;
    };

    function dragMouse(e) {
      if (!isDown) return;
      element.style.left = (e.clientX - offsetX) + "px";
      element.style.top = (e.clientY - offsetY) + "px";
    }

    function closeDrag() {
      isDown = false;
      document.onmousemove = null;
      document.onmouseup = null;
    }
  }

  // Close console
  function closeConsoleWindow() {
    if (container) {
      container.remove();
      container = null;
    }
  }

  // Render console
  function renderConsole() {
    if (!container) return;
    const body = container.querySelector("#scratch-console-body");
    if (body) {
      body.innerHTML = consoleContent.join("<br>");
      body.scrollTop = body.scrollHeight;
    }
    const titleSpan = container.querySelector("#scratch-console-title");
    if (titleSpan) titleSpan.textContent = consoleTitle;
  }

  // Push line into console
  function addLine(text, color = "#0f0") {
    consoleContent.push(`<span style="color:${color}">${text}</span>`);
    if (consoleContent.length > 200) consoleContent.shift();
    renderConsole();
  }

  class ConsoleExtension {
    getInfo() {
      return {
        id: 'consoleExt',
        name: 'Console',
        blocks: [
          { opcode: 'openConsole', blockType: Scratch.BlockType.COMMAND, text: 'Open Console' },
          { opcode: 'closeConsole', blockType: Scratch.BlockType.COMMAND, text: 'Close Console' },
          { opcode: 'setTitle', blockType: Scratch.BlockType.COMMAND, text: 'Set title Console to [TITLE]', arguments: { TITLE: {type: Scratch.ArgumentType.STRING, defaultValue: 'Console'} } },
          { opcode: 'clearConsole', blockType: Scratch.BlockType.COMMAND, text: 'Clear Console' },
          { opcode: 'resizeConsole', blockType: Scratch.BlockType.COMMAND, text: 'resize X: [W] Y: [H]', arguments: { W: {type: Scratch.ArgumentType.NUMBER, defaultValue: 400}, H: {type: Scratch.ArgumentType.NUMBER, defaultValue: 200} } },
          { opcode: 'consoleStretch', blockType: Scratch.BlockType.REPORTER, text: 'Console Stretch [DIM]', arguments: { DIM: {type: Scratch.ArgumentType.STRING, menu: 'dimensionMenu'} } },
          { opcode: 'setPosition', blockType: Scratch.BlockType.COMMAND, text: 'Set Console Position X: [X] Y: [Y]', arguments: { X: {type: Scratch.ArgumentType.NUMBER, defaultValue: 50}, Y: {type: Scratch.ArgumentType.NUMBER, defaultValue: 50} } },
          { opcode: 'getPosition', blockType: Scratch.BlockType.REPORTER, text: 'Console Position [AXIS]', arguments: { AXIS: {type: Scratch.ArgumentType.STRING, menu: 'axisMenu'} } },
          { opcode: 'toggleInputBox', blockType: Scratch.BlockType.COMMAND, text: '[STATE] input commands text box', arguments: { STATE: {type: Scratch.ArgumentType.STRING, menu: 'showHideMenu'} } },
          { opcode: 'warn', blockType: Scratch.BlockType.COMMAND, text: 'warn [MSG]', arguments: { MSG: {type: Scratch.ArgumentType.STRING, defaultValue: 'Warning'} } },
          { opcode: 'log', blockType: Scratch.BlockType.COMMAND, text: 'log [MSG]', arguments: { MSG: {type: Scratch.ArgumentType.STRING, defaultValue: 'Hello'} } },
          { opcode: 'error', blockType: Scratch.BlockType.COMMAND, text: 'error [MSG]', arguments: { MSG: {type: Scratch.ArgumentType.STRING, defaultValue: 'Error!'} } },
          { opcode: 'info', blockType: Scratch.BlockType.COMMAND, text: 'info [MSG]', arguments: { MSG: {type: Scratch.ArgumentType.STRING, defaultValue: 'Info'} } },
          { opcode: 'sendCommand', blockType: Scratch.BlockType.COMMAND, text: 'Send Console command [NAME] as [CMD]', arguments: { NAME: {type: Scratch.ArgumentType.STRING, defaultValue: 'Test'}, CMD: {type: Scratch.ArgumentType.STRING, defaultValue: '/test'} } },
          { opcode: 'didReceiveCommand', blockType: Scratch.BlockType.BOOLEAN, text: 'Did Console receive command [NAME]?', arguments: { NAME: {type: Scratch.ArgumentType.STRING, defaultValue: 'Test'} } },
          { opcode: 'getCommand', blockType: Scratch.BlockType.REPORTER, text: 'Get [NAME] command', arguments: { NAME: {type: Scratch.ArgumentType.STRING, defaultValue: 'Test'} } },
          { opcode: 'insertJS', blockType: Scratch.BlockType.COMMAND, text: 'insert [JS] to DevTools JS Console', arguments: { JS: {type: Scratch.ArgumentType.STRING, defaultValue: 'alert("Hello")'} } }
        ],
        menus: {
          dimensionMenu: { items: ['Width', 'Height'] },
          axisMenu: { items: ['X', 'Y'] },
          showHideMenu: { items: ['show', 'hide'] }
        }
      };
    }

    openConsole() { createConsoleWindow(); }
    closeConsole() { closeConsoleWindow(); }
    setTitle(args) { consoleTitle = args.TITLE; renderConsole(); }
    clearConsole() { consoleContent = []; renderConsole(); }

    resizeConsole(args) {
      if (container) {
        container.style.width = args.W + "px";
        container.style.height = args.H + "px";
      }
    }

    consoleStretch(args) {
      if (!container) return "";
      if (args.DIM === "Width") return container.offsetWidth;
      if (args.DIM === "Height") return container.offsetHeight;
      return "";
    }

    setPosition(args) {
      if (container) {
        container.style.left = args.X + "px";
        container.style.top = args.Y + "px";
      }
    }

    getPosition(args) {
      if (!container) return "";
      if (args.AXIS === "X") return parseInt(container.style.left) || 0;
      if (args.AXIS === "Y") return parseInt(container.style.top) || 0;
      return "";
    }

    toggleInputBox(args) {
      if (!inputBox) return;
      if (args.STATE === "show") inputBox.style.display = "block";
      if (args.STATE === "hide") inputBox.style.display = "none";
    }

    warn(args) { console.warn(args.MSG); addLine("[WARN] " + args.MSG, "yellow"); }
    log(args) { console.log(args.MSG); addLine("[LOG] " + args.MSG, "#0f0"); }
    error(args) { console.error(args.MSG); addLine("[ERROR] " + args.MSG, "red"); }
    info(args) { console.info(args.MSG); addLine("[INFO] " + args.MSG, "cyan"); }

    sendCommand(args) { lastCommands[args.NAME] = args.CMD; addLine("[CMD] " + args.NAME + " → " + args.CMD, "#0ff"); }
    didReceiveCommand(args) { return lastCommands.hasOwnProperty(args.NAME); }
    getCommand(args) { return lastCommands[args.NAME] || ""; }

    insertJS(args) {
      try { eval(args.JS); console.log("Executed custom JS:", args.JS); }
      catch (e) { console.error("JS Error:", e); }
    }
  }

  Scratch.extensions.register(new ConsoleExtension());
})(Scratch);

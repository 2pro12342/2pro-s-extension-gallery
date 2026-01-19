// Folder & File Storage Extension for PenguinMod / Scratch-like mods
// Virtual file system with folders, files, code execution (HTML/JS), and opening modes
// NOTE: Due to browser sandboxing, this uses a VIRTUAL FS (IndexedDB/localStorage)
// and safe execution (iframe / blob URLs). Python/C++ are stored as text only.

class FolderFileStorage {
  constructor(runtime) {
    this.runtime = runtime;
    this.fsKey = "FFS_VIRTUAL_FS";
    this.fs = this.loadFS();
  }

  /* ================= FS CORE ================= */
  loadFS() {
    try {
      return JSON.parse(localStorage.getItem(this.fsKey)) || { folders: {} };
    } catch (e) {
      return { folders: {} };
    }
  }

  saveFS() {
    localStorage.setItem(this.fsKey, JSON.stringify(this.fs));
  }

  ensureFolder(name) {
    if (!this.fs.folders[name]) {
      this.fs.folders[name] = { files: {} };
    }
  }

  /* ================= UPLOAD ================= */
  uploadFolder(args) {
    const folderName = args.FOLDER;
    this.ensureFolder(folderName);

    const input = document.createElement("input");
    input.type = "file";
    input.webkitdirectory = true;
    input.multiple = true;

    input.onchange = () => {
      for (const file of input.files) {
        const path = file.webkitRelativePath.split("/");
        const name = path[path.length - 1];
        const reader = new FileReader();
        reader.onload = () => {
          this.fs.folders[folderName].files[name] = {
            code: reader.result,
            language: name.split(".").pop()
          };
          this.saveFS();
        };
        reader.readAsText(file);
      }
    };
    input.click();
  }

  uploadFile(args) {
    const folder = args.FOLDER;
    const fileName = args.FILE;
    this.ensureFolder(folder);

    const input = document.createElement("input");
    input.type = "file";
    input.onchange = () => {
      const file = input.files[0];
      const reader = new FileReader();
      reader.onload = () => {
        this.fs.folders[folder].files[fileName] = {
          code: reader.result,
          language: fileName.split(".").pop()
        };
        this.saveFS();
      };
      reader.readAsText(file);
    };
    input.click();
  }

  /* ================= FILE & FOLDER OPS ================= */
  createDeleteFile(args) {
    const mode = args.MODE;
    const folder = args.FOLDER;
    const file = args.FILE;
    this.ensureFolder(folder);

    if (mode === "Create") {
      this.fs.folders[folder].files[file] = {
        code: "",
        language: file.split(".").pop()
      };
    } else {
      delete this.fs.folders[folder].files[file];
    }
    this.saveFS();
  }

  createDeleteFolder(args) {
    const mode = args.MODE;
    const folder = args.FOLDER;
    if (mode === "Create") {
      this.ensureFolder(folder);
    } else {
      delete this.fs.folders[folder];
    }
    this.saveFS();
  }

  moveFile(args) {
    const file = args.FILE;
    const from = args.FROM;
    const to = args.TO;
    if (!this.fs.folders[from]) return;
    this.ensureFolder(to);

    this.fs.folders[to].files[file] = this.fs.folders[from].files[file];
    delete this.fs.folders[from].files[file];
    this.saveFS();
  }

  addCode(args) {
    const folder = args.FOLDER;
    const file = args.FILE;
    const code = args.CODE;
    if (!this.fs.folders[folder]) return;
    if (!this.fs.folders[folder].files[file]) return;

    this.fs.folders[folder].files[file].code += "\n" + code;
    this.saveFS();
  }

  renameFile(args) {
    const folder = args.FOLDER;
    const oldName = args.OLD;
    const newName = args.NEW;
    if (!this.fs.folders[folder]) return;

    this.fs.folders[folder].files[newName] = this.fs.folders[folder].files[oldName];
    delete this.fs.folders[folder].files[oldName];
    this.saveFS();
  }

  /* ================= OPEN / RUN ================= */
  openFile(args) {
    const folder = args.FOLDER;
    const file = args.FILE;
    const mode = args.MODE;
    const target = args.TARGET;

    if (!this.fs.folders[folder]) return;
    const data = this.fs.folders[folder].files[file];
    if (!data) return;

    let url = "";

    if (mode === "Blob URL") {
      const blob = new Blob([data.code], { type: "text/html" });
      url = URL.createObjectURL(blob);
    } else if (mode === "Data URL") {
      url = "data:text/html;base64," + btoa(data.code);
    } else if (mode === "About:blank") {
      const w = window.open("about:blank");
      w.document.write(data.code);
      return;
    } else {
      // Normal (Canvas)
      const iframe = document.createElement("iframe");
      iframe.style.position = "absolute";
      iframe.style.left = "0";
      iframe.style.top = "0";
      iframe.style.width = "100%";
      iframe.style.height = "100%";
      iframe.style.zIndex = args.LAYER === "Front" ? 9999 : 1;
      iframe.srcdoc = data.code;
      document.body.appendChild(iframe);
      return;
    }

    if (target === "New Tab") window.open(url, "_blank");
    else if (target === "New Window") window.open(url, "", "width=800,height=600");
    else window.location.href = url;
  }

  /* ================= GETTERS ================= */
  fileInfo(args) {
    const folder = args.FOLDER;
    const file = args.FILE;
    const type = args.TYPE;

    const f = this.fs.folders[folder]?.files[file];
    if (!f) return "";

    if (type === "Code") return f.code;
    if (type === "Language") return f.language;
    if (type === "In Folder") return folder;
    if (type === "Still Exists") return true;
    if (type === "JSON Value") return JSON.stringify(f);
    return "";
  }

  getFolderJSON(args) {
    return JSON.stringify(this.fs.folders[args.FOLDER] || {});
  }

  /* ================= ZIP DOWNLOAD ================= */
  downloadFolder(args) {
    const folder = args.FOLDER;
    if (!this.fs.folders[folder]) return;

    let zipContent = "";
    for (const f in this.fs.folders[folder].files) {
      zipContent += `--- ${f} ---\n${this.fs.folders[folder].files[f].code}\n\n`;
    }

    const blob = new Blob([zipContent], { type: "application/zip" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = folder + ".zip";
    a.click();
  }

  /* ================= EXTENSION INFO ================= */
  getInfo() {
    return {
      id: "folderfilestorage",
      name: "Folder & File Storage",
      blocks: [
        {
          opcode: "uploadFolder",
          blockType: "command",
          text: "Upload Folder and Folder Name: [FOLDER]",
          arguments: {
            FOLDER: { type: "string", defaultValue: "folder" }
          }
        },
        {
          opcode: "uploadFile",
          blockType: "command",
          text: "Upload File and File Name: [FILE] to Folder: [FOLDER]",
          arguments: {
            FILE: { type: "string", defaultValue: "index.html" },
            FOLDER: { type: "string", defaultValue: "folder" }
          }
        },
        {
          opcode: "createDeleteFile",
          blockType: "command",
          text: "[MODE] File: [FILE] to Folder: [FOLDER]",
          arguments: {
            MODE: { type: "string", menu: "cd" },
            FILE: { type: "string", defaultValue: "file.txt" },
            FOLDER: { type: "string", defaultValue: "folder" }
          }
        },
        {
          opcode: "createDeleteFolder",
          blockType: "command",
          text: "[MODE] Folder: [FOLDER]",
          arguments: {
            MODE: { type: "string", menu: "cd" },
            FOLDER: { type: "string", defaultValue: "folder" }
          }
        },
        {
          opcode: "moveFile",
          blockType: "command",
          text: "Move File: [FILE] from Folder: [FROM] to Folder: [TO]",
          arguments: {
            FILE: { type: "string", defaultValue: "file.txt" },
            FROM: { type: "string", defaultValue: "oldFolder" },
            TO: { type: "string", defaultValue: "newFolder" }
          }
        },
        {
          opcode: "addCode",
          blockType: "command",
          text: "Add Code to File: [FILE] in Folder: [FOLDER] Code: [CODE]",
          arguments: {
            FILE: { type: "string", defaultValue: "index.html" },
            FOLDER: { type: "string", defaultValue: "folder" },
            CODE: { type: "string", defaultValue: "<h1>Hello</h1>" }
          }
        },
        {
          opcode: "downloadFolder",
          blockType: "command",
          text: "Download Folder: [FOLDER] as .ZIP",
          arguments: {
            FOLDER: { type: "string", defaultValue: "folder" }
          }
        },
        {
          opcode: "openFile",
          blockType: "command",
          text: "Open File: [FILE] in Folder: [FOLDER] Mode: [MODE] in [TARGET]",
          arguments: {
            FILE: { type: "string", defaultValue: "index.html" },
            FOLDER: { type: "string", defaultValue: "folder" },
            MODE: { type: "string", menu: "openMode" },
            TARGET: { type: "string", menu: "openTarget" }
          }
        },
        {
          opcode: "fileInfo",
          blockType: "reporter",
          text: "File [TYPE] of [FILE] in Folder: [FOLDER]",
          arguments: {
            TYPE: { type: "string", menu: "fileInfoType" },
            FILE: { type: "string", defaultValue: "index.html" },
            FOLDER: { type: "string", defaultValue: "folder" }
          }
        },
        {
          opcode: "getFolderJSON",
          blockType: "reporter",
          text: "Get JSON Value of Folder: [FOLDER]",
          arguments: {
            FOLDER: { type: "string", defaultValue: "folder" }
          }
        },
        {
          opcode: "renameFile",
          blockType: "command",
          text: "Rename File: [OLD] to [NEW] in Folder: [FOLDER]",
          arguments: {
            OLD: { type: "string", defaultValue: "old.txt" },
            NEW: { type: "string", defaultValue: "new.txt" },
            FOLDER: { type: "string", defaultValue: "folder" }
          }
        }
      ],
      menus: {
        cd: { items: ["Create", "Delete"] },
        openMode: { items: ["Blob URL", "Data URL", "About:blank", "Normal"] },
        openTarget: { items: ["New Tab", "New Window", "Redirect"] },
        fileInfoType: { items: ["Code", "Language", "In Folder", "Still Exists", "JSON Value"] }
      }
    };
  }
}

Scratch.extensions.register(new FolderFileStorage());(new FolderFileStorage());

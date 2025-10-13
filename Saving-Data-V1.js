(function(Scratch) {
  'use strict';

  class SavingExtension {
    constructor() {
      this.hidden = false;
    }

    getInfo() {
      return {
        id: 'saving',
        name: 'Saving',
        color1: '#2D89EF',
        color2: '#1E5AA8',
        blocks: [
          {
            opcode: 'createData',
            blockType: Scratch.BlockType.COMMAND,
            text: 'create data [NAME] with value [VALUE]',
            arguments: {
              NAME: { type: Scratch.ArgumentType.STRING, defaultValue: 'example' },
              VALUE: { type: Scratch.ArgumentType.STRING, defaultValue: 'Hello World!' }
            }
          },
          {
            opcode: 'saveData',
            blockType: Scratch.BlockType.COMMAND,
            text: 'save data [NAME] as [VALUE]',
            arguments: {
              NAME: { type: Scratch.ArgumentType.STRING, defaultValue: 'example' },
              VALUE: { type: Scratch.ArgumentType.STRING, defaultValue: 'Updated value' }
            }
          },
          {
            opcode: 'loadData',
            blockType: Scratch.BlockType.REPORTER,
            text: 'load data [NAME]',
            arguments: {
              NAME: { type: Scratch.ArgumentType.STRING, defaultValue: 'example' }
            }
          },
          {
            opcode: 'deleteData',
            blockType: Scratch.BlockType.COMMAND,
            text: 'delete data [NAME]',
            arguments: {
              NAME: { type: Scratch.ArgumentType.STRING, defaultValue: 'example' }
            }
          },
          {
            opcode: 'dataExists',
            blockType: Scratch.BlockType.BOOLEAN,
            text: 'data [NAME] exists?',
            arguments: {
              NAME: { type: Scratch.ArgumentType.STRING, defaultValue: 'example' }
            }
          },
          {
            opcode: 'showAllData',
            blockType: Scratch.BlockType.COMMAND,
            text: 'show all data'
          },
          {
            opcode: 'hideAllData',
            blockType: Scratch.BlockType.COMMAND,
            text: 'hide all data'
          },
          {
            opcode: 'listKeys',
            blockType: Scratch.BlockType.REPORTER,
            text: 'list all data keys'
          },
          {
            opcode: 'clearAllData',
            blockType: Scratch.BlockType.COMMAND,
            text: 'clear all saved data'
          },
          "---",
          {
            opcode: 'encryptData',
            blockType: Scratch.BlockType.REPORTER,
            text: 'encrypt [TEXT] with key [KEY]',
            arguments: {
              TEXT: { type: Scratch.ArgumentType.STRING, defaultValue: 'Secret message' },
              KEY: { type: Scratch.ArgumentType.STRING, defaultValue: 'password123' }
            }
          },
          {
            opcode: 'decryptData',
            blockType: Scratch.BlockType.REPORTER,
            text: 'decrypt [TEXT] with key [KEY]',
            arguments: {
              TEXT: { type: Scratch.ArgumentType.STRING, defaultValue: 'Encrypted text' },
              KEY: { type: Scratch.ArgumentType.STRING, defaultValue: 'password123' }
            }
          }
        ]
      };
    }

    createData(args) {
      if (!localStorage.getItem(args.NAME)) {
        localStorage.setItem(args.NAME, args.VALUE);
        console.log(`[Saving] Created data '${args.NAME}' = '${args.VALUE}'`);
      } else {
        console.warn(`[Saving] Data '${args.NAME}' already exists.`);
      }
    }

    saveData(args) {
      localStorage.setItem(args.NAME, args.VALUE);
      console.log(`[Saving] Saved '${args.NAME}' = '${args.VALUE}'`);
    }

    loadData(args) {
      const val = localStorage.getItem(args.NAME);
      if (val === null) return '';
      return val;
    }

    deleteData(args) {
      localStorage.removeItem(args.NAME);
      console.log(`[Saving] Deleted '${args.NAME}'`);
    }

    dataExists(args) {
      return localStorage.getItem(args.NAME) !== null;
    }

    showAllData() {
      console.table(localStorage);
      alert('All data displayed in console (press F12 to view).');
    }

    hideAllData() {
      console.clear();
      console.log('[Saving] Data hidden from console.');
    }

    listKeys() {
      return Object.keys(localStorage).join(', ');
    }

    clearAllData() {
      localStorage.clear();
      console.warn('[Saving] All saved data cleared!');
    }

    // 🔐 Encryption (simple XOR + Base64)
    xorEncrypt(str, key) {
      const textToChars = (text) => text.split('').map(c => c.charCodeAt(0));
      const byteArray = textToChars(str).map((c, i) => c ^ textToChars(key)[i % key.length]);
      return btoa(String.fromCharCode(...byteArray));
    }

    xorDecrypt(encoded, key) {
      try {
        const data = atob(encoded);
        const textToChars = (text) => text.split('').map(c => c.charCodeAt(0));
        const bytes = textToChars(data).map((c, i) => c ^ textToChars(key)[i % key.length]);
        return String.fromCharCode(...bytes);
      } catch (e) {
        return '[Invalid or Corrupted Data]';
      }
    }

    encryptData(args) {
      return this.xorEncrypt(args.TEXT, args.KEY);
    }

    decryptData(args) {
      return this.xorDecrypt(args.TEXT, args.KEY);
    }
  }

  Scratch.extensions.register(new SavingExtension());
})(Scratch);

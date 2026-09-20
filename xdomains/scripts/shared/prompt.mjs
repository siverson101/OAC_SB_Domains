#!/usr/bin/env node
var __create = Object.create;
var __getProtoOf = Object.getPrototypeOf;
var __defProp = Object.defineProperty;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
function __accessProp(key) {
  return this[key];
}
var __toESMCache_node;
var __toESMCache_esm;
var __toESM = (mod, isNodeMode, target) => {
  var canCache = mod != null && typeof mod === "object";
  if (canCache) {
    var cache = isNodeMode ? __toESMCache_node ??= new WeakMap : __toESMCache_esm ??= new WeakMap;
    var cached = cache.get(mod);
    if (cached)
      return cached;
  }
  target = mod != null ? __create(__getProtoOf(mod)) : {};
  const to = isNodeMode || !mod || !mod.__esModule || !__hasOwnProp.call(mod, "default") ? __defProp(target, "default", { value: mod, enumerable: true }) : target;
  if (mod && typeof mod === "object" || typeof mod === "function") {
    for (let key of __getOwnPropNames(mod))
      if (!__hasOwnProp.call(to, key))
        __defProp(to, key, {
          get: __accessProp.bind(mod, key),
          enumerable: true
        });
  }
  if (canCache)
    cache.set(mod, to);
  return to;
};
var __commonJS = (cb, mod) => () => (mod || cb((mod = { exports: {} }).exports, mod), mod.exports);

// node_modules/sisteransi/src/index.js
var require_src = __commonJS(function(exports, module) {
  var ESC = "\x1B";
  var CSI = `${ESC}[`;
  var beep = "\x07";
  var cursor = {
    to(x, y) {
      if (!y)
        return `${CSI}${x + 1}G`;
      return `${CSI}${y + 1};${x + 1}H`;
    },
    move(x, y) {
      let ret = "";
      if (x < 0)
        ret += `${CSI}${-x}D`;
      else if (x > 0)
        ret += `${CSI}${x}C`;
      if (y < 0)
        ret += `${CSI}${-y}A`;
      else if (y > 0)
        ret += `${CSI}${y}B`;
      return ret;
    },
    up: (count = 1) => `${CSI}${count}A`,
    down: (count = 1) => `${CSI}${count}B`,
    forward: (count = 1) => `${CSI}${count}C`,
    backward: (count = 1) => `${CSI}${count}D`,
    nextLine: (count = 1) => `${CSI}E`.repeat(count),
    prevLine: (count = 1) => `${CSI}F`.repeat(count),
    left: `${CSI}G`,
    hide: `${CSI}?25l`,
    show: `${CSI}?25h`,
    save: `${ESC}7`,
    restore: `${ESC}8`
  };
  var scroll = {
    up: (count = 1) => `${CSI}S`.repeat(count),
    down: (count = 1) => `${CSI}T`.repeat(count)
  };
  var erase = {
    screen: `${CSI}2J`,
    up: (count = 1) => `${CSI}1J`.repeat(count),
    down: (count = 1) => `${CSI}J`.repeat(count),
    line: `${CSI}2K`,
    lineEnd: `${CSI}K`,
    lineStart: `${CSI}1K`,
    lines(count) {
      let clear = "";
      for (let i = 0;i < count; i++)
        clear += this.line + (i < count - 1 ? cursor.up() : "");
      if (count)
        clear += cursor.left;
      return clear;
    }
  };
  module.exports = { cursor, scroll, erase, beep };
});

// node_modules/@clack/core/dist/index.mjs
import { styleText } from "node:util";
import { stdout, stdin } from "node:process";
import l__default from "node:readline";

// node_modules/fast-string-truncated-width/dist/utils.js
var getCodePointsLength = (() => {
  const SURROGATE_PAIR_RE = /[\uD800-\uDBFF][\uDC00-\uDFFF]/g;
  return (input) => {
    let surrogatePairsNr = 0;
    SURROGATE_PAIR_RE.lastIndex = 0;
    while (SURROGATE_PAIR_RE.test(input)) {
      surrogatePairsNr += 1;
    }
    return input.length - surrogatePairsNr;
  };
})();
var isFullWidth = (x) => {
  return x === 12288 || x >= 65281 && x <= 65376 || x >= 65504 && x <= 65510;
};
var isWideNotCJKTNotEmoji = (x) => {
  return x === 8987 || x === 9001 || x >= 12272 && x <= 12287 || x >= 12289 && x <= 12350 || x >= 12441 && x <= 12543 || x >= 12549 && x <= 12591 || x >= 12593 && x <= 12686 || x >= 12688 && x <= 12771 || x >= 12783 && x <= 12830 || x >= 12832 && x <= 12871 || x >= 12880 && x <= 19903 || x >= 65040 && x <= 65049 || x >= 65072 && x <= 65106 || x >= 65108 && x <= 65126 || x >= 65128 && x <= 65131 || x >= 127488 && x <= 127490 || x >= 127504 && x <= 127547 || x >= 127552 && x <= 127560 || x >= 131072 && x <= 196605 || x >= 196608 && x <= 262141;
};

// node_modules/fast-string-truncated-width/dist/index.js
var ANSI_RE = /[\u001b\u009b][[()#;?]*(?:[0-9]{1,4}(?:;[0-9]{0,4})*)?[0-9A-ORZcf-nqry=><]|\u001b\]8;[^;]*;.*?(?:\u0007|\u001b\u005c)/y;
var CONTROL_RE = /[\x00-\x08\x0A-\x1F\x7F-\x9F]{1,1000}/y;
var CJKT_WIDE_RE = /(?:(?![\uFF61-\uFF9F\uFF00-\uFFEF])[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Hangul}\p{Script=Tangut}]){1,1000}/yu;
var TAB_RE = /\t{1,1000}/y;
var EMOJI_RE = /[\u{1F1E6}-\u{1F1FF}]{2}|\u{1F3F4}[\u{E0061}-\u{E007A}]{2}[\u{E0030}-\u{E0039}\u{E0061}-\u{E007A}]{1,3}\u{E007F}|(?:\p{Emoji}\uFE0F\u20E3?|\p{Emoji_Modifier_Base}\p{Emoji_Modifier}?|\p{Emoji_Presentation})(?:\u200D(?:\p{Emoji_Modifier_Base}\p{Emoji_Modifier}?|\p{Emoji_Presentation}|\p{Emoji}\uFE0F\u20E3?))*/yu;
var LATIN_RE = /(?:[\x20-\x7E\xA0-\xFF](?!\uFE0F)){1,1000}/y;
var MODIFIER_RE = /\p{M}+/gu;
var NO_TRUNCATION = { limit: Infinity, ellipsis: "" };
var getStringTruncatedWidth = (input, truncationOptions = {}, widthOptions = {}) => {
  const LIMIT = truncationOptions.limit ?? Infinity;
  const ELLIPSIS = truncationOptions.ellipsis ?? "";
  const ELLIPSIS_WIDTH = truncationOptions?.ellipsisWidth ?? (ELLIPSIS ? getStringTruncatedWidth(ELLIPSIS, NO_TRUNCATION, widthOptions).width : 0);
  const ANSI_WIDTH = 0;
  const CONTROL_WIDTH = widthOptions.controlWidth ?? 0;
  const TAB_WIDTH = widthOptions.tabWidth ?? 8;
  const EMOJI_WIDTH = widthOptions.emojiWidth ?? 2;
  const FULL_WIDTH_WIDTH = 2;
  const REGULAR_WIDTH = widthOptions.regularWidth ?? 1;
  const WIDE_WIDTH = widthOptions.wideWidth ?? FULL_WIDTH_WIDTH;
  const PARSE_BLOCKS = [
    [LATIN_RE, REGULAR_WIDTH],
    [ANSI_RE, ANSI_WIDTH],
    [CONTROL_RE, CONTROL_WIDTH],
    [TAB_RE, TAB_WIDTH],
    [EMOJI_RE, EMOJI_WIDTH],
    [CJKT_WIDE_RE, WIDE_WIDTH]
  ];
  let indexPrev = 0;
  let index = 0;
  let length = input.length;
  let lengthExtra = 0;
  let truncationEnabled = false;
  let truncationIndex = length;
  let truncationLimit = Math.max(0, LIMIT - ELLIPSIS_WIDTH);
  let unmatchedStart = 0;
  let unmatchedEnd = 0;
  let width = 0;
  let widthExtra = 0;
  outer:
    while (true) {
      if (unmatchedEnd > unmatchedStart || index >= length && index > indexPrev) {
        const unmatched = input.slice(unmatchedStart, unmatchedEnd) || input.slice(indexPrev, index);
        lengthExtra = 0;
        for (const char of unmatched.replaceAll(MODIFIER_RE, "")) {
          const codePoint = char.codePointAt(0) || 0;
          if (isFullWidth(codePoint)) {
            widthExtra = FULL_WIDTH_WIDTH;
          } else if (isWideNotCJKTNotEmoji(codePoint)) {
            widthExtra = WIDE_WIDTH;
          } else {
            widthExtra = REGULAR_WIDTH;
          }
          if (width + widthExtra > truncationLimit) {
            truncationIndex = Math.min(truncationIndex, Math.max(unmatchedStart, indexPrev) + lengthExtra);
          }
          if (width + widthExtra > LIMIT) {
            truncationEnabled = true;
            break outer;
          }
          lengthExtra += char.length;
          width += widthExtra;
        }
        unmatchedStart = unmatchedEnd = 0;
      }
      if (index >= length) {
        break outer;
      }
      for (let i = 0, l = PARSE_BLOCKS.length;i < l; i++) {
        const [BLOCK_RE, BLOCK_WIDTH] = PARSE_BLOCKS[i];
        BLOCK_RE.lastIndex = index;
        if (BLOCK_RE.test(input)) {
          lengthExtra = BLOCK_RE === CJKT_WIDE_RE ? getCodePointsLength(input.slice(index, BLOCK_RE.lastIndex)) : BLOCK_RE === EMOJI_RE ? 1 : BLOCK_RE.lastIndex - index;
          widthExtra = lengthExtra * BLOCK_WIDTH;
          if (width + widthExtra > truncationLimit) {
            truncationIndex = Math.min(truncationIndex, index + Math.floor((truncationLimit - width) / BLOCK_WIDTH));
          }
          if (width + widthExtra > LIMIT) {
            truncationEnabled = true;
            break outer;
          }
          width += widthExtra;
          unmatchedStart = indexPrev;
          unmatchedEnd = index;
          index = indexPrev = BLOCK_RE.lastIndex;
          continue outer;
        }
      }
      index += 1;
    }
  return {
    width: truncationEnabled ? truncationLimit : width,
    index: truncationEnabled ? truncationIndex : length,
    truncated: truncationEnabled,
    ellipsed: truncationEnabled && LIMIT >= ELLIPSIS_WIDTH
  };
};
var dist_default = getStringTruncatedWidth;

// node_modules/fast-string-width/dist/index.js
var NO_TRUNCATION2 = {
  limit: Infinity,
  ellipsis: "",
  ellipsisWidth: 0
};
var fastStringWidth = (input, options = {}) => {
  return dist_default(input, NO_TRUNCATION2, options).width;
};
var dist_default2 = fastStringWidth;

// node_modules/fast-wrap-ansi/lib/main.js
var ESC = "\x1B";
var CSI = "";
var END_CODE = 39;
var ANSI_ESCAPE_BELL = "\x07";
var ANSI_CSI = "[";
var ANSI_OSC = "]";
var ANSI_SGR_TERMINATOR = "m";
var ANSI_ESCAPE_LINK = `${ANSI_OSC}8;;`;
var GROUP_REGEX = new RegExp(`(?:\\${ANSI_CSI}(?<code>\\d+)m|\\${ANSI_ESCAPE_LINK}(?<uri>.*)${ANSI_ESCAPE_BELL})`, "y");
var getClosingCode = (openingCode) => {
  if (openingCode >= 30 && openingCode <= 37)
    return 39;
  if (openingCode >= 90 && openingCode <= 97)
    return 39;
  if (openingCode >= 40 && openingCode <= 47)
    return 49;
  if (openingCode >= 100 && openingCode <= 107)
    return 49;
  if (openingCode === 1 || openingCode === 2)
    return 22;
  if (openingCode === 3)
    return 23;
  if (openingCode === 4)
    return 24;
  if (openingCode === 7)
    return 27;
  if (openingCode === 8)
    return 28;
  if (openingCode === 9)
    return 29;
  if (openingCode === 0)
    return 0;
  return;
};
var wrapAnsiCode = (code) => `${ESC}${ANSI_CSI}${code}${ANSI_SGR_TERMINATOR}`;
var wrapAnsiHyperlink = (url) => `${ESC}${ANSI_ESCAPE_LINK}${url}${ANSI_ESCAPE_BELL}`;
var wrapWord = (rows, word, columns) => {
  const characters = word[Symbol.iterator]();
  let isInsideEscape = false;
  let isInsideLinkEscape = false;
  let lastRow = rows.at(-1);
  let visible = lastRow === undefined ? 0 : dist_default2(lastRow);
  let currentCharacter = characters.next();
  let nextCharacter = characters.next();
  let rawCharacterIndex = 0;
  while (!currentCharacter.done) {
    const character = currentCharacter.value;
    const characterLength = dist_default2(character);
    if (visible + characterLength <= columns) {
      rows[rows.length - 1] += character;
    } else {
      rows.push(character);
      visible = 0;
    }
    if (character === ESC || character === CSI) {
      isInsideEscape = true;
      isInsideLinkEscape = word.startsWith(ANSI_ESCAPE_LINK, rawCharacterIndex + 1);
    }
    if (isInsideEscape) {
      if (isInsideLinkEscape) {
        if (character === ANSI_ESCAPE_BELL) {
          isInsideEscape = false;
          isInsideLinkEscape = false;
        }
      } else if (character === ANSI_SGR_TERMINATOR) {
        isInsideEscape = false;
      }
    } else {
      visible += characterLength;
      if (visible === columns && !nextCharacter.done) {
        rows.push("");
        visible = 0;
      }
    }
    currentCharacter = nextCharacter;
    nextCharacter = characters.next();
    rawCharacterIndex += character.length;
  }
  lastRow = rows.at(-1);
  if (!visible && lastRow !== undefined && lastRow.length && rows.length > 1) {
    rows[rows.length - 2] += rows.pop();
  }
};
var stringVisibleTrimSpacesRight = (string) => {
  const words = string.split(" ");
  let last = words.length;
  while (last) {
    if (dist_default2(words[last - 1])) {
      break;
    }
    last--;
  }
  if (last === words.length) {
    return string;
  }
  return words.slice(0, last).join(" ") + words.slice(last).join("");
};
var exec = (string, columns, options = {}) => {
  if (options.trim !== false && string.trim() === "") {
    return "";
  }
  let returnValue = "";
  let escapeCode;
  let escapeUrl;
  const words = string.split(" ");
  let rows = [""];
  let rowLength = 0;
  for (let index = 0;index < words.length; index++) {
    const word = words[index];
    if (options.trim !== false) {
      const row = rows.at(-1) ?? "";
      const trimmed = row.trimStart();
      if (row.length !== trimmed.length) {
        rows[rows.length - 1] = trimmed;
        rowLength = dist_default2(trimmed);
      }
    }
    if (index !== 0) {
      if (rowLength >= columns && (options.wordWrap === false || options.trim === false)) {
        rows.push("");
        rowLength = 0;
      }
      if (rowLength || options.trim === false) {
        rows[rows.length - 1] += " ";
        rowLength++;
      }
    }
    const wordLength = dist_default2(word);
    if (options.hard && wordLength > columns) {
      const remainingColumns = columns - rowLength;
      const breaksStartingThisLine = 1 + Math.floor((wordLength - remainingColumns - 1) / columns);
      const breaksStartingNextLine = Math.floor((wordLength - 1) / columns);
      if (breaksStartingNextLine < breaksStartingThisLine) {
        rows.push("");
      }
      wrapWord(rows, word, columns);
      rowLength = dist_default2(rows.at(-1) ?? "");
      continue;
    }
    if (rowLength + wordLength > columns && rowLength && wordLength) {
      if (options.wordWrap === false && rowLength < columns) {
        wrapWord(rows, word, columns);
        rowLength = dist_default2(rows.at(-1) ?? "");
        continue;
      }
      rows.push("");
      rowLength = 0;
    }
    if (rowLength + wordLength > columns && options.wordWrap === false) {
      wrapWord(rows, word, columns);
      rowLength = dist_default2(rows.at(-1) ?? "");
      continue;
    }
    rows[rows.length - 1] += word;
    rowLength += wordLength;
  }
  if (options.trim !== false) {
    rows = rows.map((row) => stringVisibleTrimSpacesRight(row));
  }
  const preString = rows.join(`
`);
  let inSurrogate = false;
  for (let i = 0;i < preString.length; i++) {
    const character = preString[i];
    returnValue += character;
    if (!inSurrogate) {
      inSurrogate = character >= "\uD800" && character <= "\uDBFF";
      if (inSurrogate) {
        continue;
      }
    } else {
      inSurrogate = false;
    }
    if (character === ESC || character === CSI) {
      GROUP_REGEX.lastIndex = i + 1;
      const groupsResult = GROUP_REGEX.exec(preString);
      const groups = groupsResult?.groups;
      if (groups?.code !== undefined) {
        const code = Number.parseFloat(groups.code);
        escapeCode = code === END_CODE ? undefined : code;
      } else if (groups?.uri !== undefined) {
        escapeUrl = groups.uri.length === 0 ? undefined : groups.uri;
      }
    }
    if (preString[i + 1] === `
`) {
      if (escapeUrl) {
        returnValue += wrapAnsiHyperlink("");
      }
      const closingCode = escapeCode ? getClosingCode(escapeCode) : undefined;
      if (escapeCode && closingCode) {
        returnValue += wrapAnsiCode(closingCode);
      }
    } else if (character === `
`) {
      if (escapeCode && getClosingCode(escapeCode)) {
        returnValue += wrapAnsiCode(escapeCode);
      }
      if (escapeUrl) {
        returnValue += wrapAnsiHyperlink(escapeUrl);
      }
    }
  }
  return returnValue;
};
var CRLF_OR_LF = /\r?\n/;
function wrapAnsi(string, columns, options) {
  return String(string).normalize().split(CRLF_OR_LF).map((line) => exec(line, columns, options)).join(`
`);
}

// node_modules/@clack/core/dist/index.mjs
var import_sisteransi = __toESM(require_src(), 1);
function findCursor(s, o, l) {
  if (!l.some((r) => !r.disabled))
    return s;
  const t = s + o, n = Math.max(l.length - 1, 0), e = t < 0 ? n : t > n ? 0 : t;
  return l[e]?.disabled ? findCursor(e, o < 0 ? -1 : 1, l) : e;
}
var a$1 = ["up", "down", "left", "right", "space", "enter", "cancel"];
var t = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December"
];
var settings = {
  actions: new Set(a$1),
  aliases: /* @__PURE__ */ new Map([
    ["k", "up"],
    ["j", "down"],
    ["h", "left"],
    ["l", "right"],
    ["\x03", "cancel"],
    ["escape", "cancel"]
  ]),
  messages: {
    cancel: "Canceled",
    error: "Something went wrong"
  },
  withGuide: true,
  accessible: undefined,
  date: {
    monthNames: [...t],
    messages: {
      required: "Please enter a valid date",
      invalidMonth: "There are only 12 months in a year",
      invalidDay: (n, e) => `There are only ${n} days in ${e}`,
      afterMin: (n) => `Date must be on or after ${n.toISOString().slice(0, 10)}`,
      beforeMax: (n) => `Date must be on or before ${n.toISOString().slice(0, 10)}`
    }
  }
};
function isAccessible(n) {
  if (n !== undefined)
    return n;
  if (settings.accessible !== undefined)
    return settings.accessible;
  const e = process.env.ACCESSIBLE;
  return e !== undefined && e !== "" && e !== "0" && e !== "false";
}
function isActionKey(n, e) {
  if (typeof n == "string")
    return settings.aliases.get(n) === e;
  for (const s of n)
    if (s !== undefined && isActionKey(s, e))
      return true;
  return false;
}
function diffLines(i, s) {
  if (i === s)
    return;
  const e = i.split(`
`), t = s.split(`
`), r = Math.max(e.length, t.length), f = [];
  for (let n = 0;n < r; n++)
    e[n] !== t[n] && f.push(n);
  return {
    lines: f,
    numLinesBefore: e.length,
    numLinesAfter: t.length,
    numLines: r
  };
}
var R = globalThis.process.platform.startsWith("win");
var CANCEL_SYMBOL = Symbol("clack:cancel");
function isCancel(e) {
  return e === CANCEL_SYMBOL;
}
function setRawMode(e, r) {
  const o = e;
  o.isTTY && o.setRawMode(r);
}
var getColumns = (e) => ("columns" in e) && typeof e.columns == "number" ? e.columns : 80;
var getRows = (e) => ("rows" in e) && typeof e.rows == "number" ? e.rows : 20;
function wrapTextWithPrefix(e, r, o, n = o, s = o, t) {
  const f = getColumns(e ?? stdout);
  return wrapAnsi(r, f - o.length, {
    hard: true,
    trim: false
  }).split(`
`).map((c, i, m) => {
    const d = t ? t(c, i) : c;
    return i === 0 ? `${n}${d}` : i === m.length - 1 ? `${s}${d}` : `${o}${d}`;
  }).join(`
`);
}
function runValidation(e, a) {
  if ("~standard" in e) {
    const n = e["~standard"].validate(a);
    return n instanceof Promise ? n.then((r) => r.issues?.at(0)?.message) : n.issues?.at(0)?.message;
  }
  return e(a);
}

class y {
  input;
  output;
  _abortSignal;
  rl;
  opts;
  _render;
  _track = false;
  _prevFrame = "";
  _subscribers = /* @__PURE__ */ new Map;
  _cursor = 0;
  state = "initial";
  error = "";
  value;
  userInput = "";
  get accessible() {
    return isAccessible(this.opts.accessible);
  }
  constructor(t, e = true) {
    const { input: i = stdin, output: s = stdout, render: r, signal: n, ...o } = t;
    this.opts = o, this.onKeypress = this.onKeypress.bind(this), this.close = this.close.bind(this), this.render = this.render.bind(this), this._render = r.bind(this), this._track = e, this._abortSignal = n, this.input = i, this.output = s;
  }
  unsubscribe() {
    this._subscribers.clear();
  }
  setSubscriber(t, e) {
    const i = this._subscribers.get(t) ?? [];
    i.push(e), this._subscribers.set(t, i);
  }
  on(t, e) {
    this.setSubscriber(t, { cb: e });
  }
  once(t, e) {
    this.setSubscriber(t, { cb: e, once: true });
  }
  emit(t, ...e) {
    const i = this._subscribers.get(t) ?? [], s = [];
    for (const r of i)
      r.cb(...e), r.once && s.push(() => i.splice(i.indexOf(r), 1));
    for (const r of s)
      r();
  }
  prompt() {
    return new Promise((t) => {
      if (this._abortSignal) {
        if (this._abortSignal.aborted)
          return this.state = "cancel", this.close(), t(CANCEL_SYMBOL);
        this._abortSignal.addEventListener("abort", () => {
          this.state = "cancel", this.close();
        }, { once: true });
      }
      this.rl = l__default.createInterface({
        input: this.input,
        tabSize: 2,
        prompt: "",
        escapeCodeTimeout: 50,
        terminal: true
      }), this.rl.prompt(), this.opts.initialUserInput !== undefined && this._setUserInput(this.opts.initialUserInput, true), this.input.on("keypress", this.onKeypress), setRawMode(this.input, true), this.output.on("resize", this.render), this.render(), this.once("submit", () => {
        this.output.write(import_sisteransi.cursor.show), this.output.off("resize", this.render), setRawMode(this.input, false), t(this.value);
      }), this.once("cancel", () => {
        this.output.write(import_sisteransi.cursor.show), this.output.off("resize", this.render), setRawMode(this.input, false), t(CANCEL_SYMBOL);
      });
    });
  }
  _isActionKey(t, e) {
    return t === "\t";
  }
  _shouldSubmit(t, e) {
    return true;
  }
  _setValue(t) {
    this.value = t, this.emit("value", this.value);
  }
  _setUserInput(t, e) {
    this.userInput = t ?? "", this.emit("userInput", this.userInput), e && this._track && this.rl && (this.rl.write(this.userInput), this._cursor = this.rl.cursor);
  }
  _clearUserInput() {
    this.rl?.write(null, { ctrl: true, name: "u" }), this._setUserInput("");
  }
  async onKeypress(t, e) {
    if (this.state !== "validating") {
      if (this._track && e.name !== "return" && (e.name && this._isActionKey(t, e) && this.rl?.write(null, { ctrl: true, name: "h" }), this._cursor = this.rl?.cursor ?? 0, this._setUserInput(this.rl?.line)), this.state === "error" && (this.state = "active"), e?.name && (!this._track && settings.aliases.has(e.name) && this.emit("cursor", settings.aliases.get(e.name)), settings.actions.has(e.name) && this.emit("cursor", e.name)), t && (t.toLowerCase() === "y" || t.toLowerCase() === "n") && this.emit("confirm", t.toLowerCase() === "y"), this.emit("key", t, e), e?.name === "return" && this._shouldSubmit(t, e)) {
        if (this.opts.validate) {
          const i = runValidation(this.opts.validate, this.value);
          let s;
          i instanceof Promise ? (this.state = "validating", this.render(), s = await i) : s = i, s && (this.error = s instanceof Error ? s.message : s, this.state = "error", this.rl?.write(this.userInput));
        }
        this.state !== "error" && (this.state = "submit");
      }
      isActionKey([t, e?.name, e?.sequence], "cancel") && (this.state = "cancel"), (this.state === "submit" || this.state === "cancel") && this.emit("finalize"), this.render(), (this.state === "submit" || this.state === "cancel") && this.close();
    }
  }
  close() {
    this.input.unpipe(), this.input.removeListener("keypress", this.onKeypress), this.output.write(`
`), setRawMode(this.input, false), this.rl?.close(), this.rl = undefined, this.emit(`${this.state}`, this.value), this.unsubscribe();
  }
  restoreCursor() {
    const t = wrapAnsi(this._prevFrame, process.stdout.columns, { hard: true, trim: false }).split(`
`).length - 1;
    this.output.write(import_sisteransi.cursor.move(-999, t * -1));
  }
  render() {
    const t = wrapAnsi(this._render(this) ?? "", process.stdout.columns, {
      hard: true,
      trim: false
    });
    if (t !== this._prevFrame) {
      if (this.state === "initial")
        this.output.write(import_sisteransi.cursor.hide);
      else {
        const e = diffLines(this._prevFrame, t), i = getRows(this.output);
        if (this.restoreCursor(), e) {
          const s = Math.max(0, e.numLinesAfter - i), r = Math.max(0, e.numLinesBefore - i);
          let n = e.lines.find((o) => o >= s);
          if (n === undefined) {
            this._prevFrame = t;
            return;
          }
          if (e.lines.length === 1) {
            this.output.write(import_sisteransi.cursor.move(0, n - r)), this.output.write(import_sisteransi.erase.lines(1));
            const o = t.split(`
`);
            this.output.write(o[n]), this._prevFrame = t, this.output.write(import_sisteransi.cursor.move(0, o.length - n - 1));
            return;
          } else if (e.lines.length > 1) {
            if (s < r)
              n = s;
            else {
              const h = n - r;
              h > 0 && this.output.write(import_sisteransi.cursor.move(0, h));
            }
            this.output.write(import_sisteransi.erase.down());
            const f = t.split(`
`).slice(n);
            this.output.write(f.join(`
`)), this._prevFrame = t;
            return;
          }
        }
        this.output.write(import_sisteransi.erase.down());
      }
      this.output.write(t), this.state === "initial" && (this.state = "active"), this._prevFrame = t;
    }
  }
}
class r extends y {
  get cursor() {
    return this.value ? 0 : 1;
  }
  get _value() {
    return this.cursor === 0;
  }
  constructor(t) {
    super(t, false), this.value = !!t.initialValue, this.on("userInput", () => {
      this.value = this._value;
    }), this.on("confirm", (i) => {
      this.output.write(import_sisteransi.cursor.move(0, -1)), this.value = i, this.state = "submit", this.close();
    }), this.on("cursor", () => {
      this.value = !this.value;
    });
  }
}
class a extends y {
  options;
  cursor = 0;
  get _value() {
    return this.options[this.cursor]?.value;
  }
  get _enabledOptions() {
    return this.options.filter((e) => e.disabled !== true);
  }
  toggleAll() {
    const e = this._enabledOptions, i = this.value !== undefined && this.value.length === e.length;
    this.value = i ? [] : e.map((t) => t.value);
  }
  toggleInvert() {
    const e = this.value;
    if (!e)
      return;
    const i = this._enabledOptions.filter((t) => !e.includes(t.value));
    this.value = i.map((t) => t.value);
  }
  toggleValue() {
    this.value === undefined && (this.value = []);
    const e = this.value.includes(this._value);
    this.value = e ? this.value.filter((i) => i !== this._value) : [...this.value, this._value];
  }
  constructor(e) {
    super(e, false), this.options = e.options, this.value = [...e.initialValues ?? []];
    const i = Math.max(this.options.findIndex(({ value: t }) => t === e.cursorAt), 0);
    this.cursor = this.options[i]?.disabled ? findCursor(i, 1, this.options) : i, this.on("key", (t, l) => {
      l.name === "a" && this.toggleAll(), l.name === "i" && this.toggleInvert();
    }), this.on("cursor", (t) => {
      switch (t) {
        case "left":
        case "up":
          this.cursor = findCursor(this.cursor, -1, this.options);
          break;
        case "down":
        case "right":
          this.cursor = findCursor(this.cursor, 1, this.options);
          break;
        case "space":
          this.toggleValue();
          break;
      }
    });
  }
}
var n$1 = class n extends y {
  options;
  cursor = 0;
  get _selectedValue() {
    return this.options[this.cursor];
  }
  changeValue() {
    const e = this._selectedValue;
    this.value = e === undefined ? undefined : e.value;
  }
  constructor(e) {
    super(e, false), this.options = e.options;
    const o = this.options.findIndex(({ value: s }) => s === e.initialValue), t = o === -1 ? 0 : o;
    this.cursor = this.options[t]?.disabled ? findCursor(t, 1, this.options) : t, this.changeValue(), this.on("cursor", (s) => {
      switch (s) {
        case "left":
        case "up":
          this.cursor = findCursor(this.cursor, -1, this.options);
          break;
        case "down":
        case "right":
          this.cursor = findCursor(this.cursor, 1, this.options);
          break;
      }
      this.changeValue();
    });
  }
};
class n extends y {
  get userInputWithCursor() {
    if (this.state === "submit")
      return this.userInput;
    const t = this.userInput;
    if (this.cursor >= t.length)
      return `${this.userInput}█`;
    const r = t.slice(0, this.cursor), s = t.slice(this.cursor, this.cursor + 1), e = t.slice(this.cursor + 1);
    return `${r}${styleText("inverse", s)}${e}`;
  }
  get cursor() {
    return this._cursor;
  }
  constructor(t) {
    super({
      ...t,
      initialUserInput: t.initialUserInput ?? t.initialValue
    }), this.on("userInput", (r) => {
      this._setValue(r);
    }), this.on("finalize", () => {
      this.value || (this.value = t.defaultValue), this.value === undefined && (this.value = "");
    });
  }
}

// node_modules/@clack/prompts/dist/index.mjs
import { styleText as styleText2, stripVTControlCharacters } from "node:util";
import process$1 from "node:process";
var import_sisteransi2 = __toESM(require_src(), 1);
function isUnicodeSupported() {
  if (process$1.platform !== "win32") {
    return process$1.env.TERM !== "linux";
  }
  return Boolean(process$1.env.CI) || Boolean(process$1.env.WT_SESSION) || Boolean(process$1.env.TERMINUS_SUBLIME) || process$1.env.ConEmuTask === "{cmd::Cmder}" || process$1.env.TERM_PROGRAM === "Terminus-Sublime" || process$1.env.TERM_PROGRAM === "vscode" || process$1.env.TERM === "xterm-256color" || process$1.env.TERM === "alacritty" || process$1.env.TERMINAL_EMULATOR === "JetBrains-JediTerm";
}
var unicode = isUnicodeSupported();
var unicodeOr = (o, e) => unicode ? o : e;
var S_STEP_ACTIVE = unicodeOr("◆", "*");
var S_STEP_CANCEL = unicodeOr("■", "x");
var S_STEP_ERROR = unicodeOr("▲", "x");
var S_STEP_SUBMIT = unicodeOr("◇", "o");
var S_BAR_START = unicodeOr("┌", "T");
var S_BAR = unicodeOr("│", "|");
var S_BAR_END = unicodeOr("└", "—");
var S_BAR_START_RIGHT = unicodeOr("┐", "T");
var S_BAR_END_RIGHT = unicodeOr("┘", "—");
var S_RADIO_ACTIVE = unicodeOr("●", ">");
var S_RADIO_INACTIVE = unicodeOr("○", " ");
var S_CHECKBOX_ACTIVE = unicodeOr("◻", "[•]");
var S_CHECKBOX_SELECTED = unicodeOr("◼", "[+]");
var S_CHECKBOX_INACTIVE = unicodeOr("◻", "[ ]");
var S_PASSWORD_MASK = unicodeOr("▪", "•");
var S_BAR_H = unicodeOr("─", "-");
var S_CORNER_TOP_RIGHT = unicodeOr("╮", "+");
var S_CONNECT_LEFT = unicodeOr("├", "+");
var S_CORNER_BOTTOM_RIGHT = unicodeOr("╯", "+");
var S_CORNER_BOTTOM_LEFT = unicodeOr("╰", "+");
var S_CORNER_TOP_LEFT = unicodeOr("╭", "+");
var S_INFO = unicodeOr("●", "•");
var S_SUCCESS = unicodeOr("◆", "*");
var S_WARN = unicodeOr("▲", "!");
var S_ERROR = unicodeOr("■", "x");
var symbol = (o) => {
  switch (o) {
    case "initial":
    case "active":
      return styleText2("cyan", S_STEP_ACTIVE);
    case "cancel":
      return styleText2("red", S_STEP_CANCEL);
    case "error":
      return styleText2("yellow", S_STEP_ERROR);
    case "submit":
      return styleText2("green", S_STEP_SUBMIT);
    case "validating":
      return styleText2("dim", S_STEP_ACTIVE);
  }
};
var symbolBar = (o) => {
  switch (o) {
    case "initial":
    case "active":
      return styleText2("cyan", S_BAR);
    case "cancel":
      return styleText2("red", S_BAR);
    case "error":
      return styleText2("yellow", S_BAR);
    case "submit":
      return styleText2("green", S_BAR);
  }
};
function formatInstructionFooter(o, e) {
  const r = [`${e ? `${styleText2("cyan", S_BAR)}  ` : ""}${o.join(" • ")}`];
  return e && r.push(styleText2("cyan", S_BAR_END)), r;
}
var I = (l, e, w, p, b, C = false) => {
  let r = e, O = 0;
  if (C)
    for (let i = p - 1;i >= w; i--) {
      const m = l[i];
      if (m && (r -= m.length), O++, r <= b)
        break;
    }
  else
    for (let i = w;i < p; i++) {
      const m = l[i];
      if (m && (r -= m.length), O++, r <= b)
        break;
    }
  return { lineCount: r, removals: O };
};
var limitOptions = ({
  cursor: l,
  options: e,
  style: w,
  output: p = process.stdout,
  maxItems: b = Number.POSITIVE_INFINITY,
  columnPadding: C = 0,
  rowPadding: r = 4
}) => {
  const i = getColumns(p) - C, m = getRows(p), M = styleText2("dim", "..."), v = Math.max(m - r, 0), a = Math.max(Math.min(b, v), 5);
  let f = 0;
  l >= a - 3 && (f = Math.max(Math.min(l - a + 3, e.length - a), 0));
  let d = a < e.length && f > 0, c = a < e.length && f + a < e.length;
  const W = Math.min(f + a, e.length), s = [];
  let g = 0;
  d && g++, c && g++;
  const T = f + (d ? 1 : 0), y = W - (c ? 1 : 0);
  for (let t = T;t < y; t++) {
    const n = e[t], o = n ? w(n, t === l) : "", h = wrapAnsi(o, i, {
      hard: true,
      trim: false
    }).split(`
`);
    s.push(h), g += h.length;
  }
  if (g > v) {
    let t = 0, n = 0, o = g;
    const h = l - T;
    let u = v;
    const L = () => I(s, o, 0, h, u), E = () => I(s, o, h + 1, s.length, u, true);
    d ? ({ lineCount: o, removals: t } = L(), o > u && (c || (u -= 1), { lineCount: o, removals: n } = E())) : (c || (u -= 1), { lineCount: o, removals: n } = E(), o > u && (u -= 1, { lineCount: o, removals: t } = L())), t > 0 && (d = true, s.splice(0, t)), n > 0 && (c = true, s.splice(s.length - n, n));
  }
  const x = [];
  d && x.push(M);
  for (const t of s)
    for (const n of t)
      x.push(n);
  return c && x.push(M), x;
};
var confirm = (e) => {
  const a = e.active ?? "Yes", o = e.inactive ?? "No";
  return new r({
    active: a,
    inactive: o,
    signal: e.signal,
    input: e.input,
    output: e.output,
    initialValue: e.initialValue ?? true,
    render() {
      const i = e.withGuide ?? settings.withGuide, u = `${symbol(this.state)}  `, l = i ? `${styleText2("gray", S_BAR)}  ` : "", f = wrapTextWithPrefix(e.output, e.message, l, u), s = `${i ? `${styleText2("gray", S_BAR)}
` : ""}${f}
`, c = this.value ? a : o;
      switch (this.state) {
        case "submit": {
          const r = i ? `${styleText2("gray", S_BAR)}  ` : "";
          return `${s}${r}${styleText2("dim", c)}`;
        }
        case "cancel": {
          const r = i ? `${styleText2("gray", S_BAR)}  ` : "";
          return `${s}${r}${styleText2(["strikethrough", "dim"], c)}${i ? `
${styleText2("gray", S_BAR)}` : ""}`;
        }
        default: {
          const r = i ? `${styleText2("cyan", S_BAR)}  ` : "", g = i ? styleText2("cyan", S_BAR_END) : "";
          return `${s}${r}${this.value ? `${styleText2("green", S_RADIO_ACTIVE)} ${a}` : `${styleText2("dim", S_RADIO_INACTIVE)} ${styleText2("dim", a)}`}${e.vertical ? i ? `
${styleText2("cyan", S_BAR)}  ` : `
` : ` ${styleText2("dim", "/")} `}${this.value ? `${styleText2("dim", S_RADIO_INACTIVE)} ${styleText2("dim", o)}` : `${styleText2("green", S_RADIO_ACTIVE)} ${o}`}
${g}
`;
        }
      }
    }
  }).prompt();
};
var MULTISELECT_INSTRUCTIONS = [
  `${styleText2("dim", "↑/↓")} to navigate`,
  `${styleText2("dim", "Space:")} select`,
  `${styleText2("dim", "Enter:")} confirm`
];
var m = (i, u) => i.split(`
`).map((d) => u(d)).join(`
`);
var multiselect = (i) => {
  const u = (t, a) => {
    const r = t.label ?? String(t.value);
    return a === "disabled" ? `${styleText2("gray", S_CHECKBOX_INACTIVE)} ${m(r, (o) => styleText2(["strikethrough", "gray"], o))}${t.hint ? ` ${styleText2("dim", `(${t.hint ?? "disabled"})`)}` : ""}` : a === "active" ? `${styleText2("cyan", S_CHECKBOX_ACTIVE)} ${r}${t.hint ? ` ${styleText2("dim", `(${t.hint})`)}` : ""}` : a === "selected" ? `${styleText2("green", S_CHECKBOX_SELECTED)} ${m(r, (o) => styleText2("dim", o))}${t.hint ? ` ${styleText2("dim", `(${t.hint})`)}` : ""}` : a === "cancelled" ? `${m(r, (o) => styleText2(["strikethrough", "dim"], o))}` : a === "active-selected" ? `${styleText2("green", S_CHECKBOX_SELECTED)} ${r}${t.hint ? ` ${styleText2("dim", `(${t.hint})`)}` : ""}` : a === "submitted" ? `${m(r, (o) => styleText2("dim", o))}` : `${styleText2("dim", S_CHECKBOX_INACTIVE)} ${m(r, (o) => styleText2("dim", o))}`;
  }, d = i.required ?? true, x = i.showInstructions ?? true;
  return new a({
    options: i.options,
    signal: i.signal,
    input: i.input,
    output: i.output,
    initialValues: i.initialValues,
    required: d,
    cursorAt: i.cursorAt,
    validate(t) {
      if (d && (t === undefined || t.length === 0))
        return `Please select at least one option.
${styleText2("reset", styleText2("dim", `Press ${styleText2(["gray", "bgWhite", "inverse"], " space ")} to select, ${styleText2("gray", styleText2("bgWhite", styleText2("inverse", " enter ")))} to submit`))}`;
    },
    render() {
      const t = i.withGuide ?? settings.withGuide, a = wrapTextWithPrefix(i.output, i.message, t ? `${symbolBar(this.state)}  ` : "", `${symbol(this.state)}  `), r = `${t ? `${styleText2("gray", S_BAR)}
` : ""}${a}
`, o = this.value ?? [], g = (n, l) => {
        if (n.disabled)
          return u(n, "disabled");
        const s = o.includes(n.value);
        return l && s ? u(n, "active-selected") : s ? u(n, "selected") : u(n, l ? "active" : "inactive");
      };
      switch (this.state) {
        case "submit": {
          const n = this.options.filter(({ value: s }) => o.includes(s)).map((s) => u(s, "submitted")).join(styleText2("dim", ", ")) || styleText2("dim", "none"), l = wrapTextWithPrefix(i.output, n, t ? `${styleText2("gray", S_BAR)}  ` : "");
          return `${r}${l}`;
        }
        case "cancel": {
          const n = this.options.filter(({ value: s }) => o.includes(s)).map((s) => u(s, "cancelled")).join(styleText2("dim", ", "));
          if (n.trim() === "")
            return `${r}${styleText2("gray", S_BAR)}`;
          const l = wrapTextWithPrefix(i.output, n, t ? `${styleText2("gray", S_BAR)}  ` : "");
          return `${r}${l}${t ? `
${styleText2("gray", S_BAR)}` : ""}`;
        }
        case "error": {
          const n = t ? `${styleText2("yellow", S_BAR)}  ` : "", l = this.error.split(`
`).map(($, v) => v === 0 ? `${t ? `${styleText2("yellow", S_BAR_END)}  ` : ""}${styleText2("yellow", $)}` : `   ${$}`).join(`
`), s = r.split(`
`).length, h = l.split(`
`).length + 1;
          return `${r}${n}${limitOptions({
            output: i.output,
            options: this.options,
            cursor: this.cursor,
            maxItems: i.maxItems,
            columnPadding: n.length,
            rowPadding: s + h,
            style: g
          }).join(`
${n}`)}
${l}
`;
        }
        default: {
          const n = t ? `${styleText2("cyan", S_BAR)}  ` : "", l = r.split(`
`).length, s = x ? formatInstructionFooter(MULTISELECT_INSTRUCTIONS, t) : t ? [styleText2("cyan", S_BAR_END)] : [], h = s.join(`
`), $ = s.length + 1;
          return `${r}${n}${limitOptions({
            output: i.output,
            options: this.options,
            cursor: this.cursor,
            maxItems: i.maxItems,
            columnPadding: n.length,
            rowPadding: l + $,
            style: g
          }).join(`
${n}`)}
${h}
`;
        }
      }
    }
  }).prompt();
};
var cancel = (o = "", t) => {
  const i = t?.output ?? process.stdout, e = t?.withGuide ?? settings.withGuide ? `${styleText2("gray", S_BAR_END)}  ` : "";
  i.write(`${e}${styleText2("red", o)}

`);
};
var intro = (o = "", t) => {
  const i = t?.output ?? process.stdout, e = t?.withGuide ?? settings.withGuide ? `${styleText2("gray", S_BAR_START)}  ` : "";
  i.write(`${e}${o}
`);
};
var outro = (o = "", t) => {
  const i = t?.output ?? process.stdout, e = t?.withGuide ?? settings.withGuide ? `${styleText2("gray", S_BAR)}
${styleText2("gray", S_BAR_END)}  ` : "";
  i.write(`${e}${o}

`);
};
var W$1 = (o) => o;
var C = (o, e, s) => {
  const a = {
    hard: true,
    trim: false
  }, i = wrapAnsi(o, e, a).split(`
`), c = i.reduce((n, t) => Math.max(dist_default2(t), n), 0), u = i.map(s).reduce((n, t) => Math.max(dist_default2(t), n), 0), g = e - (u - c);
  return wrapAnsi(o, g, a);
};
var note = (o = "", e = "", s) => {
  const a = s?.output ?? process$1.stdout, i = s?.withGuide ?? settings.withGuide, c = s?.format ?? W$1, g = ["", ...C(o, getColumns(a) - 6, c).split(`
`).map(c), ""], n = dist_default2(e), t = Math.max(g.reduce((m, F) => {
    const O = dist_default2(F);
    return O > m ? O : m;
  }, 0), n) + 2, h = g.map((m) => `${styleText2("gray", S_BAR)}  ${m}${" ".repeat(t - dist_default2(m))}${styleText2("gray", S_BAR)}`).join(`
`), T = i ? `${styleText2("gray", S_BAR)}
` : "", l$1 = i ? S_CONNECT_LEFT : S_CORNER_BOTTOM_LEFT;
  a.write(`${T}${styleText2("green", S_STEP_SUBMIT)}  ${styleText2("reset", e)} ${styleText2("gray", S_BAR_H.repeat(Math.max(t - n - 1, 1)) + S_CORNER_TOP_RIGHT)}
${h}
${styleText2("gray", l$1 + S_BAR_H.repeat(t + 2) + S_CORNER_BOTTOM_RIGHT)}
`);
};
var u2 = {
  light: unicodeOr("─", "-"),
  heavy: unicodeOr("━", "="),
  block: unicodeOr("█", "#")
};
var SELECT_INSTRUCTIONS = [
  `${styleText2("dim", "↑/↓")} to navigate`,
  `${styleText2("dim", "Enter:")} confirm`
];
var c = (t, o) => t.includes(`
`) ? t.split(`
`).map((d) => o(d)).join(`
`) : o(t);
var select = (t) => {
  const o = (n, m) => {
    if (n === undefined)
      return "";
    const s = n.label ?? String(n.value);
    switch (m) {
      case "disabled":
        return `${styleText2("gray", S_RADIO_INACTIVE)} ${c(s, (i) => styleText2("gray", i))}${n.hint ? ` ${styleText2("dim", `(${n.hint ?? "disabled"})`)}` : ""}`;
      case "selected":
        return `${c(s, (i) => styleText2("dim", i))}`;
      case "active":
        return `${styleText2("green", S_RADIO_ACTIVE)} ${s}${n.hint ? ` ${styleText2("dim", `(${n.hint})`)}` : ""}`;
      case "cancelled":
        return `${c(s, (i) => styleText2(["strikethrough", "dim"], i))}`;
      default:
        return `${styleText2("dim", S_RADIO_INACTIVE)} ${c(s, (i) => styleText2("dim", i))}`;
    }
  }, d = t.showInstructions ?? true;
  return new n$1({
    options: t.options,
    signal: t.signal,
    input: t.input,
    output: t.output,
    initialValue: t.initialValue,
    render() {
      const n = t.withGuide ?? settings.withGuide, m = `${symbol(this.state)}  `, s = `${symbolBar(this.state)}  `, i = wrapTextWithPrefix(t.output, t.message, s, m), u = `${n ? `${styleText2("gray", S_BAR)}
` : ""}${i}
`;
      switch (this.state) {
        case "submit": {
          const r = n ? `${styleText2("gray", S_BAR)}  ` : "", a = wrapTextWithPrefix(t.output, o(this.options[this.cursor], "selected"), r);
          return `${u}${a}`;
        }
        case "cancel": {
          const r = n ? `${styleText2("gray", S_BAR)}  ` : "", a = wrapTextWithPrefix(t.output, o(this.options[this.cursor], "cancelled"), r);
          return `${u}${a}${n ? `
${styleText2("gray", S_BAR)}` : ""}`;
        }
        default: {
          const r = n ? `${styleText2("cyan", S_BAR)}  ` : "", a = u.split(`
`).length, p = d ? formatInstructionFooter(SELECT_INSTRUCTIONS, n) : n ? [styleText2("cyan", S_BAR_END)] : [], f = p.join(`
`), b = p.length + 1;
          return `${u}${r}${limitOptions({
            output: t.output,
            cursor: this.cursor,
            options: this.options,
            maxItems: t.maxItems,
            columnPadding: r.length,
            rowPadding: a + b,
            style: (g, x) => o(g, g.disabled ? "disabled" : x ? "active" : "inactive")
          }).join(`
${r}`)}
${f}
`;
        }
      }
    }
  }).prompt();
};
var i = `${styleText2("gray", S_BAR)}  `;
var text = (t) => new n({
  validate: t.validate,
  placeholder: t.placeholder,
  defaultValue: t.defaultValue,
  initialValue: t.initialValue,
  output: t.output,
  signal: t.signal,
  input: t.input,
  render() {
    const r = t?.withGuide ?? settings.withGuide, l = `${`${r ? `${styleText2("gray", S_BAR)}
` : ""}${symbol(this.state)}  `}${t.message}
`, d = t.placeholder && t.placeholder.length > 0 ? styleText2("inverse", t.placeholder[0]) + styleText2("dim", t.placeholder.slice(1)) : styleText2(["inverse", "hidden"], "_"), o = this.userInput ? this.userInputWithCursor : d, s = this.value ?? "";
    switch (this.state) {
      case "validating": {
        const n = r ? `${styleText2("cyan", S_BAR)}  ` : "", i = r ? styleText2("cyan", S_BAR_END) : "", c = styleText2("dim", o), $ = styleText2("dim", "Validating...");
        return `${l}${n}${c}
${i}  ${$}
`;
      }
      case "error": {
        const n = this.error ? `  ${styleText2("yellow", this.error)}` : "", i = r ? `${styleText2("yellow", S_BAR)}  ` : "", c = r ? styleText2("yellow", S_BAR_END) : "";
        return `${l.trim()}
${i}${o}
${c}${n}
`;
      }
      case "submit": {
        const n = s ? `${r ? "  " : ""}${styleText2("dim", s)}` : "", i = r ? styleText2("gray", S_BAR) : "";
        return `${l}${i}${n}`;
      }
      case "cancel": {
        const n = s ? `  ${styleText2(["strikethrough", "dim"], s)}` : "", i = r ? styleText2("gray", S_BAR) : "";
        return `${l}${i}${n}${s.trim() ? `
${i}` : ""}`;
      }
      default: {
        const n = r ? `${styleText2("cyan", S_BAR)}  ` : "", i = r ? styleText2("cyan", S_BAR_END) : "";
        return `${l}${n}${o}
${i}
`;
      }
    }
  }
}).prompt();

// tools/shared/prompts/src/prompt.mjs
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import process2 from "node:process";
function parseArgs(argv) {
  const out = {};
  let i = 0;
  while (i < argv.length) {
    const arg = argv[i];
    if (arg.startsWith("--") && arg.includes("=")) {
      const eq = arg.indexOf("=");
      out[arg.slice(2, eq)] = arg.slice(eq + 1);
      i++;
      continue;
    }
    if (arg.startsWith("--")) {
      const key = arg.slice(2);
      const next = argv[i + 1];
      if (next && !next.startsWith("--")) {
        out[key] = next;
        i += 2;
      } else {
        out[key] = true;
        i++;
      }
      continue;
    }
    i++;
  }
  return out;
}
function readInput(pathOrDash) {
  if (pathOrDash === "-") {
    return readFileSync(0, "utf8");
  }
  return readFileSync(resolve(pathOrDash), "utf8");
}
function writeOutput(pathOrDash, value) {
  const body = JSON.stringify(value, null, 2) + `
`;
  if (!pathOrDash || pathOrDash === "-") {
    process2.stdout.write(body);
    return;
  }
  const dest = resolve(pathOrDash);
  mkdirSync(dirname(dest), { recursive: true });
  writeFileSync(dest, body);
}
function normalizeOptions(options, questionId) {
  if (!Array.isArray(options) || options.length === 0) {
    throw new Error(`Question "${questionId}" must define a non-empty options array`);
  }
  return options.map((opt) => {
    if (typeof opt === "string")
      return { value: opt, label: opt };
    if (!opt || typeof opt !== "object" || opt.value === undefined) {
      throw new Error(`Question "${questionId}" has an option without a value`);
    }
    return { value: opt.value, label: opt.label ?? String(opt.value), hint: opt.hint };
  });
}
function defaultAnswer(question) {
  switch (question.type) {
    case "select": {
      const options = normalizeOptions(question.options, question.id);
      return question.initialValue ?? options[0].value;
    }
    case "multiselect":
      return question.initialValues ?? [];
    case "text":
      return question.defaultValue ?? "";
    case "confirm":
      return question.initialValue ?? false;
    default:
      throw new Error(`Unknown question type: ${question.type}`);
  }
}
function validateSpec(spec) {
  if (!spec || typeof spec !== "object")
    throw new Error("Spec must be a JSON object");
  if (!Array.isArray(spec.questions) || spec.questions.length === 0) {
    throw new Error('Spec must contain a non-empty "questions" array');
  }
  const seen = new Set;
  for (const q of spec.questions) {
    if (!q.id || typeof q.id !== "string")
      throw new Error('Every question needs a string "id"');
    if (seen.has(q.id))
      throw new Error(`Duplicate question id: ${q.id}`);
    seen.add(q.id);
    if (!q.message)
      throw new Error(`Question "${q.id}" needs a "message"`);
    if (!["select", "multiselect", "text", "confirm"].includes(q.type)) {
      throw new Error(`Question "${q.id}" has unsupported type: ${q.type}`);
    }
    if (q.type === "select" || q.type === "multiselect")
      normalizeOptions(q.options, q.id);
  }
}
async function askQuestions(spec, { defaults }) {
  const answers = {};
  if (defaults) {
    for (const q of spec.questions)
      answers[q.id] = defaultAnswer(q);
    return answers;
  }
  if (spec.title)
    intro(spec.title);
  for (const q of spec.questions) {
    let value;
    switch (q.type) {
      case "select":
        value = await select({
          message: q.message,
          options: normalizeOptions(q.options, q.id),
          initialValue: q.initialValue
        });
        break;
      case "multiselect":
        value = await multiselect({
          message: q.message,
          options: normalizeOptions(q.options, q.id),
          initialValues: q.initialValues,
          required: q.required !== false
        });
        break;
      case "text":
        value = await text({
          message: q.message,
          placeholder: q.placeholder,
          defaultValue: q.defaultValue,
          initialValue: q.initialValue
        });
        break;
      case "confirm":
        value = await confirm({
          message: q.message,
          initialValue: q.initialValue ?? false
        });
        break;
      default:
        throw new Error(`Unknown question type: ${q.type}`);
    }
    if (isCancel(value)) {
      cancel("Cancelled");
      return null;
    }
    answers[q.id] = value;
  }
  if (spec.title)
    outro("Answers recorded");
  return answers;
}
function printHelp() {
  process2.stdout.write([
    "prompt.mjs - run a JSON-defined set of interactive questions",
    "",
    "Usage:",
    '  node prompt.mjs --spec <file|-> [--out <file|->] [--defaults] [--title "..."]',
    "",
    "Options:",
    "  --spec FILE    JSON question spec (use - for stdin). Required.",
    "  --out FILE     Where to write answers JSON (use - or omit for stdout).",
    "  --defaults     Answer from initial/default values without prompting.",
    "  --title TEXT   Override the spec title used for the intro/outro.",
    "  --help, -h     Show this help.",
    ""
  ].join(`
`));
}
async function main() {
  const argv = parseArgs(process2.argv.slice(2));
  if (argv.help || argv.h) {
    printHelp();
    return;
  }
  if (!argv.spec) {
    printHelp();
    process2.exitCode = 2;
    return;
  }
  const spec = JSON.parse(readInput(argv.spec));
  if (argv.title)
    spec.title = argv.title;
  validateSpec(spec);
  const defaults = Boolean(argv.defaults);
  const answers = await askQuestions(spec, { defaults });
  if (answers === null) {
    writeOutput(argv.out, { title: spec.title ?? null, cancelled: true, answers: {} });
    process2.exitCode = 130;
    return;
  }
  if (defaults && spec.title)
    note("Using default answers (--defaults)", "non-interactive");
  writeOutput(argv.out, { title: spec.title ?? null, cancelled: false, answers });
}
main().catch((err) => {
  process2.stderr.write(`prompt.mjs: ${err && err.message ? err.message : String(err)}
`);
  process2.exitCode = 1;
});

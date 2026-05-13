require('./sourcemap-register.js');/******/ (() => { // webpackBootstrap
/******/ 	"use strict";
/******/ 	var __webpack_modules__ = ({

/***/ 2929:
/***/ (function(__unused_webpack_module, exports, __nccwpck_require__) {


var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.run = run;
const fs = __importStar(__nccwpck_require__(1455));
const annotate_1 = __nccwpck_require__(3927);
const diff_1 = __nccwpck_require__(9952);
const scanner_1 = __nccwpck_require__(4105);
async function run(core) {
    const actionCore = core ?? (await loadCore());
    try {
        const failOnWarning = parseBooleanInput(actionCore, "fail-on-warning", false);
        const includeZeroWidth = parseBooleanInput(actionCore, "include-zero-width", true);
        const maxAnnotations = parsePositiveIntegerInput(actionCore, "max-annotations", 50);
        const diffText = await readDiffText(actionCore);
        const addedLines = (0, diff_1.parseAddedLines)(diffText);
        const findings = addedLines.flatMap((line) => (0, scanner_1.scanAddedLine)(line, { includeZeroWidth }));
        (0, annotate_1.annotateFindings)(findings, { maxAnnotations }, actionCore);
        const errorCount = countSeverity(findings, "error");
        const warningCount = countSeverity(findings, "warning");
        actionCore.setOutput("error-count", String(errorCount));
        actionCore.setOutput("warning-count", String(warningCount));
        actionCore.setOutput("finding-count", String(findings.length));
        if (errorCount > 0 || (failOnWarning && warningCount > 0)) {
            actionCore.setFailed(`Detected ${errorCount} error(s) and ${warningCount} warning(s).`);
        }
    }
    catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        actionCore.setFailed(message);
    }
}
async function loadCore() {
    return __nccwpck_require__.e(/* import() */ 421).then(__nccwpck_require__.bind(__nccwpck_require__, 6421));
}
async function readDiffText(core) {
    const diffFile = core.getInput("diff-file");
    const diff = core.getInput("diff", { trimWhitespace: false });
    if (diffFile !== "" && diff !== "") {
        throw new Error('Use only one of "diff-file" or "diff".');
    }
    if (diffFile !== "") {
        return fs.readFile(diffFile, "utf8");
    }
    if (diff !== "" || hasRawActionInput("diff")) {
        return diff;
    }
    throw new Error('Input "diff-file" or "diff" is required.');
}
function hasRawActionInput(name) {
    return Object.prototype.hasOwnProperty.call(process.env, inputEnvironmentName(name));
}
function inputEnvironmentName(name) {
    return `INPUT_${name.replace(/ /g, "_").toUpperCase()}`;
}
function parseBooleanInput(core, name, defaultValue) {
    const rawValue = core.getInput(name);
    const value = rawValue === "" ? String(defaultValue) : rawValue;
    if (value === "true") {
        return true;
    }
    if (value === "false") {
        return false;
    }
    throw new Error(`Input "${name}" must be either "true" or "false".`);
}
function parsePositiveIntegerInput(core, name, defaultValue) {
    const rawValue = core.getInput(name);
    const value = rawValue === "" ? String(defaultValue) : rawValue;
    const parsed = Number.parseInt(value, 10);
    if (!/^[1-9]\d*$/.test(value) || parsed < 1) {
        throw new Error(`Input "${name}" must be a positive integer.`);
    }
    return parsed;
}
function countSeverity(findings, severity) {
    return findings.filter((finding) => finding.severity === severity).length;
}


/***/ }),

/***/ 3927:
/***/ ((__unused_webpack_module, exports) => {


Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.annotateFindings = annotateFindings;
const TITLE = "Potential Trojan Source character";
function annotateFindings(findings, options, core) {
    const annotationsToEmit = findings.slice(0, options.maxAnnotations);
    for (const finding of annotationsToEmit) {
        const message = formatMessage(finding);
        const properties = {
            title: TITLE,
            file: finding.file,
            startLine: finding.line,
            startColumn: finding.column,
            endLine: finding.line,
            endColumn: finding.column + 1
        };
        if (finding.severity === "error") {
            core.error(message, properties);
        }
        else {
            core.warning(message, properties);
        }
    }
    if (findings.length > options.maxAnnotations) {
        core.notice(`Detected ${findings.length} finding(s), but emitted only the first ${options.maxAnnotations} annotation(s).`);
    }
}
function formatMessage(finding) {
    return `${finding.codePoint} ${finding.name} (${finding.severity}): suspicious invisible, bidirectional, or control character. Remove it unless it is intentionally required.`;
}


/***/ }),

/***/ 9952:
/***/ ((__unused_webpack_module, exports) => {


Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.parseAddedLines = parseAddedLines;
const HUNK_HEADER_PATTERN = /^@@ -\d+(?:,\d+)? \+(\d+)(?:,\d+)? @@/;
function parseAddedLines(diffText) {
    const addedLines = [];
    let currentFile;
    let currentNewLine;
    let scanCurrentFile = false;
    for (const rawLine of diffText.split(/\r?\n/)) {
        if (rawLine.startsWith("+++ ")) {
            currentFile = parseNewFilePath(rawLine);
            scanCurrentFile = currentFile !== undefined;
            currentNewLine = undefined;
            continue;
        }
        const hunkMatch = HUNK_HEADER_PATTERN.exec(rawLine);
        if (hunkMatch !== null) {
            currentNewLine = Number.parseInt(hunkMatch[1], 10);
            continue;
        }
        if (rawLine.startsWith("\\ No newline at end of file")) {
            continue;
        }
        if (!scanCurrentFile || currentFile === undefined || currentNewLine === undefined) {
            continue;
        }
        if (rawLine.startsWith("+")) {
            addedLines.push({
                file: currentFile,
                line: currentNewLine,
                content: rawLine.slice(1)
            });
            currentNewLine += 1;
            continue;
        }
        if (rawLine.startsWith("-")) {
            continue;
        }
        if (rawLine.startsWith(" ")) {
            currentNewLine += 1;
        }
    }
    return addedLines;
}
function parseNewFilePath(line) {
    const path = line.slice(4).split("\t", 1)[0];
    if (path === "/dev/null") {
        return undefined;
    }
    if (path.startsWith("b/")) {
        return path.slice(2);
    }
    return path;
}


/***/ }),

/***/ 4105:
/***/ ((__unused_webpack_module, exports) => {


Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.scanAddedLine = scanAddedLine;
const ERROR_CODE_POINTS = new Map([
    [0x202a, "LEFT-TO-RIGHT EMBEDDING"],
    [0x202b, "RIGHT-TO-LEFT EMBEDDING"],
    [0x202c, "POP DIRECTIONAL FORMATTING"],
    [0x202d, "LEFT-TO-RIGHT OVERRIDE"],
    [0x202e, "RIGHT-TO-LEFT OVERRIDE"],
    [0x2066, "LEFT-TO-RIGHT ISOLATE"],
    [0x2067, "RIGHT-TO-LEFT ISOLATE"],
    [0x2068, "FIRST STRONG ISOLATE"],
    [0x2069, "POP DIRECTIONAL ISOLATE"]
]);
const WARNING_CODE_POINTS = new Map([
    [0x200b, "ZERO WIDTH SPACE"],
    [0x200c, "ZERO WIDTH NON-JOINER"],
    [0x200d, "ZERO WIDTH JOINER"],
    [0xfeff, "ZERO WIDTH NO-BREAK SPACE / BOM"],
    [0x00ad, "SOFT HYPHEN"],
    [0x034f, "COMBINING GRAPHEME JOINER"],
    [0x061c, "ARABIC LETTER MARK"]
]);
const C0_CONTROL_CODE_POINT_NAMES = new Map([
    [0x0000, "NULL"],
    [0x0001, "START OF HEADING"],
    [0x0002, "START OF TEXT"],
    [0x0003, "END OF TEXT"],
    [0x0004, "END OF TRANSMISSION"],
    [0x0005, "ENQUIRY"],
    [0x0006, "ACKNOWLEDGE"],
    [0x0007, "BELL"],
    [0x0008, "BACKSPACE"],
    [0x000a, "LINE FEED"],
    [0x000b, "LINE TABULATION"],
    [0x000c, "FORM FEED"],
    [0x000d, "CARRIAGE RETURN"],
    [0x000e, "SHIFT OUT"],
    [0x000f, "SHIFT IN"],
    [0x0010, "DATA LINK ESCAPE"],
    [0x0011, "DEVICE CONTROL ONE"],
    [0x0012, "DEVICE CONTROL TWO"],
    [0x0013, "DEVICE CONTROL THREE"],
    [0x0014, "DEVICE CONTROL FOUR"],
    [0x0015, "NEGATIVE ACKNOWLEDGE"],
    [0x0016, "SYNCHRONOUS IDLE"],
    [0x0017, "END OF TRANSMISSION BLOCK"],
    [0x0018, "CANCEL"],
    [0x0019, "END OF MEDIUM"],
    [0x001a, "SUBSTITUTE"],
    [0x001b, "ESCAPE"],
    [0x001c, "INFORMATION SEPARATOR FOUR"],
    [0x001d, "INFORMATION SEPARATOR THREE"],
    [0x001e, "INFORMATION SEPARATOR TWO"],
    [0x001f, "INFORMATION SEPARATOR ONE"],
    [0x007f, "DELETE"]
]);
const C1_CONTROL_CODE_POINT_NAMES = new Map([
    [0x0080, "PADDING CHARACTER"],
    [0x0081, "HIGH OCTET PRESET"],
    [0x0082, "BREAK PERMITTED HERE"],
    [0x0083, "NO BREAK HERE"],
    [0x0084, "INDEX"],
    [0x0085, "NEXT LINE"],
    [0x0086, "START OF SELECTED AREA"],
    [0x0087, "END OF SELECTED AREA"],
    [0x0088, "CHARACTER TABULATION SET"],
    [0x0089, "CHARACTER TABULATION WITH JUSTIFICATION"],
    [0x008a, "LINE TABULATION SET"],
    [0x008b, "PARTIAL LINE FORWARD"],
    [0x008c, "PARTIAL LINE BACKWARD"],
    [0x008d, "REVERSE LINE FEED"],
    [0x008e, "SINGLE SHIFT TWO"],
    [0x008f, "SINGLE SHIFT THREE"],
    [0x0090, "DEVICE CONTROL STRING"],
    [0x0091, "PRIVATE USE ONE"],
    [0x0092, "PRIVATE USE TWO"],
    [0x0093, "SET TRANSMIT STATE"],
    [0x0094, "CANCEL CHARACTER"],
    [0x0095, "MESSAGE WAITING"],
    [0x0096, "START OF GUARDED AREA"],
    [0x0097, "END OF GUARDED AREA"],
    [0x0098, "START OF STRING"],
    [0x0099, "SINGLE GRAPHIC CHARACTER INTRODUCER"],
    [0x009a, "SINGLE CHARACTER INTRODUCER"],
    [0x009b, "CONTROL SEQUENCE INTRODUCER"],
    [0x009c, "STRING TERMINATOR"],
    [0x009d, "OPERATING SYSTEM COMMAND"],
    [0x009e, "PRIVACY MESSAGE"],
    [0x009f, "APPLICATION PROGRAM COMMAND"]
]);
function scanAddedLine(line, options) {
    const findings = [];
    let column = 1;
    for (const character of line.content) {
        const value = character.codePointAt(0);
        if (value === undefined) {
            column += 1;
            continue;
        }
        const errorName = getErrorCodePointName(value);
        if (errorName !== undefined) {
            findings.push(toFinding(line, column, value, errorName, "error", character));
            column += 1;
            continue;
        }
        const warningName = WARNING_CODE_POINTS.get(value);
        if (options.includeZeroWidth && warningName !== undefined) {
            findings.push(toFinding(line, column, value, warningName, "warning", character));
        }
        column += 1;
    }
    return findings;
}
function getErrorCodePointName(value) {
    const mappedName = ERROR_CODE_POINTS.get(value);
    if (mappedName !== undefined) {
        return mappedName;
    }
    return getVariationSelectorName(value) ?? getControlCodePointName(value);
}
function getVariationSelectorName(value) {
    if (value >= 0xfe00 && value <= 0xfe0f) {
        return `VARIATION SELECTOR-${value - 0xfe00 + 1}`;
    }
    if (value >= 0xe0100 && value <= 0xe01ef) {
        return `VARIATION SELECTOR-${value - 0xe0100 + 17}`;
    }
    return undefined;
}
function getControlCodePointName(value) {
    return C0_CONTROL_CODE_POINT_NAMES.get(value) ?? C1_CONTROL_CODE_POINT_NAMES.get(value);
}
function toFinding(line, column, value, name, severity, character) {
    return {
        file: line.file,
        line: line.line,
        column,
        codePoint: formatCodePoint(value),
        name,
        severity,
        character
    };
}
function formatCodePoint(value) {
    return `U+${value.toString(16).toUpperCase().padStart(4, "0")}`;
}


/***/ }),

/***/ 2613:
/***/ ((module) => {

module.exports = require("assert");

/***/ }),

/***/ 5317:
/***/ ((module) => {

module.exports = require("child_process");

/***/ }),

/***/ 6982:
/***/ ((module) => {

module.exports = require("crypto");

/***/ }),

/***/ 4434:
/***/ ((module) => {

module.exports = require("events");

/***/ }),

/***/ 9896:
/***/ ((module) => {

module.exports = require("fs");

/***/ }),

/***/ 8611:
/***/ ((module) => {

module.exports = require("http");

/***/ }),

/***/ 5692:
/***/ ((module) => {

module.exports = require("https");

/***/ }),

/***/ 9278:
/***/ ((module) => {

module.exports = require("net");

/***/ }),

/***/ 4589:
/***/ ((module) => {

module.exports = require("node:assert");

/***/ }),

/***/ 6698:
/***/ ((module) => {

module.exports = require("node:async_hooks");

/***/ }),

/***/ 4573:
/***/ ((module) => {

module.exports = require("node:buffer");

/***/ }),

/***/ 7540:
/***/ ((module) => {

module.exports = require("node:console");

/***/ }),

/***/ 7598:
/***/ ((module) => {

module.exports = require("node:crypto");

/***/ }),

/***/ 3053:
/***/ ((module) => {

module.exports = require("node:diagnostics_channel");

/***/ }),

/***/ 610:
/***/ ((module) => {

module.exports = require("node:dns");

/***/ }),

/***/ 8474:
/***/ ((module) => {

module.exports = require("node:events");

/***/ }),

/***/ 1455:
/***/ ((module) => {

module.exports = require("node:fs/promises");

/***/ }),

/***/ 7067:
/***/ ((module) => {

module.exports = require("node:http");

/***/ }),

/***/ 2467:
/***/ ((module) => {

module.exports = require("node:http2");

/***/ }),

/***/ 7030:
/***/ ((module) => {

module.exports = require("node:net");

/***/ }),

/***/ 6760:
/***/ ((module) => {

module.exports = require("node:path");

/***/ }),

/***/ 643:
/***/ ((module) => {

module.exports = require("node:perf_hooks");

/***/ }),

/***/ 1792:
/***/ ((module) => {

module.exports = require("node:querystring");

/***/ }),

/***/ 99:
/***/ ((module) => {

module.exports = require("node:sqlite");

/***/ }),

/***/ 7075:
/***/ ((module) => {

module.exports = require("node:stream");

/***/ }),

/***/ 7997:
/***/ ((module) => {

module.exports = require("node:timers");

/***/ }),

/***/ 1692:
/***/ ((module) => {

module.exports = require("node:tls");

/***/ }),

/***/ 3136:
/***/ ((module) => {

module.exports = require("node:url");

/***/ }),

/***/ 7975:
/***/ ((module) => {

module.exports = require("node:util");

/***/ }),

/***/ 3429:
/***/ ((module) => {

module.exports = require("node:util/types");

/***/ }),

/***/ 5919:
/***/ ((module) => {

module.exports = require("node:worker_threads");

/***/ }),

/***/ 8522:
/***/ ((module) => {

module.exports = require("node:zlib");

/***/ }),

/***/ 857:
/***/ ((module) => {

module.exports = require("os");

/***/ }),

/***/ 6928:
/***/ ((module) => {

module.exports = require("path");

/***/ }),

/***/ 3193:
/***/ ((module) => {

module.exports = require("string_decoder");

/***/ }),

/***/ 3557:
/***/ ((module) => {

module.exports = require("timers");

/***/ }),

/***/ 4756:
/***/ ((module) => {

module.exports = require("tls");

/***/ }),

/***/ 9023:
/***/ ((module) => {

module.exports = require("util");

/***/ })

/******/ 	});
/************************************************************************/
/******/ 	// The module cache
/******/ 	var __webpack_module_cache__ = {};
/******/ 	
/******/ 	// The require function
/******/ 	function __nccwpck_require__(moduleId) {
/******/ 		// Check if module is in cache
/******/ 		var cachedModule = __webpack_module_cache__[moduleId];
/******/ 		if (cachedModule !== undefined) {
/******/ 			return cachedModule.exports;
/******/ 		}
/******/ 		// Create a new module (and put it into the cache)
/******/ 		var module = __webpack_module_cache__[moduleId] = {
/******/ 			id: moduleId,
/******/ 			loaded: false,
/******/ 			exports: {}
/******/ 		};
/******/ 	
/******/ 		// Execute the module function
/******/ 		var threw = true;
/******/ 		try {
/******/ 			__webpack_modules__[moduleId].call(module.exports, module, module.exports, __nccwpck_require__);
/******/ 			threw = false;
/******/ 		} finally {
/******/ 			if(threw) delete __webpack_module_cache__[moduleId];
/******/ 		}
/******/ 	
/******/ 		// Flag the module as loaded
/******/ 		module.loaded = true;
/******/ 	
/******/ 		// Return the exports of the module
/******/ 		return module.exports;
/******/ 	}
/******/ 	
/******/ 	// expose the modules object (__webpack_modules__)
/******/ 	__nccwpck_require__.m = __webpack_modules__;
/******/ 	
/************************************************************************/
/******/ 	/* webpack/runtime/create fake namespace object */
/******/ 	(() => {
/******/ 		var getProto = Object.getPrototypeOf ? (obj) => (Object.getPrototypeOf(obj)) : (obj) => (obj.__proto__);
/******/ 		var leafPrototypes;
/******/ 		// create a fake namespace object
/******/ 		// mode & 1: value is a module id, require it
/******/ 		// mode & 2: merge all properties of value into the ns
/******/ 		// mode & 4: return value when already ns object
/******/ 		// mode & 16: return value when it's Promise-like
/******/ 		// mode & 8|1: behave like require
/******/ 		__nccwpck_require__.t = function(value, mode) {
/******/ 			if(mode & 1) value = this(value);
/******/ 			if(mode & 8) return value;
/******/ 			if(typeof value === 'object' && value) {
/******/ 				if((mode & 4) && value.__esModule) return value;
/******/ 				if((mode & 16) && typeof value.then === 'function') return value;
/******/ 			}
/******/ 			var ns = Object.create(null);
/******/ 			__nccwpck_require__.r(ns);
/******/ 			var def = {};
/******/ 			leafPrototypes = leafPrototypes || [null, getProto({}), getProto([]), getProto(getProto)];
/******/ 			for(var current = mode & 2 && value; typeof current == 'object' && !~leafPrototypes.indexOf(current); current = getProto(current)) {
/******/ 				Object.getOwnPropertyNames(current).forEach((key) => (def[key] = () => (value[key])));
/******/ 			}
/******/ 			def['default'] = () => (value);
/******/ 			__nccwpck_require__.d(ns, def);
/******/ 			return ns;
/******/ 		};
/******/ 	})();
/******/ 	
/******/ 	/* webpack/runtime/define property getters */
/******/ 	(() => {
/******/ 		// define getter functions for harmony exports
/******/ 		__nccwpck_require__.d = (exports, definition) => {
/******/ 			for(var key in definition) {
/******/ 				if(__nccwpck_require__.o(definition, key) && !__nccwpck_require__.o(exports, key)) {
/******/ 					Object.defineProperty(exports, key, { enumerable: true, get: definition[key] });
/******/ 				}
/******/ 			}
/******/ 		};
/******/ 	})();
/******/ 	
/******/ 	/* webpack/runtime/ensure chunk */
/******/ 	(() => {
/******/ 		__nccwpck_require__.f = {};
/******/ 		// This file contains only the entry chunk.
/******/ 		// The chunk loading function for additional chunks
/******/ 		__nccwpck_require__.e = (chunkId) => {
/******/ 			return Promise.all(Object.keys(__nccwpck_require__.f).reduce((promises, key) => {
/******/ 				__nccwpck_require__.f[key](chunkId, promises);
/******/ 				return promises;
/******/ 			}, []));
/******/ 		};
/******/ 	})();
/******/ 	
/******/ 	/* webpack/runtime/get javascript chunk filename */
/******/ 	(() => {
/******/ 		// This function allow to reference async chunks
/******/ 		__nccwpck_require__.u = (chunkId) => {
/******/ 			// return url for filenames based on template
/******/ 			return "" + chunkId + ".index.js";
/******/ 		};
/******/ 	})();
/******/ 	
/******/ 	/* webpack/runtime/hasOwnProperty shorthand */
/******/ 	(() => {
/******/ 		__nccwpck_require__.o = (obj, prop) => (Object.prototype.hasOwnProperty.call(obj, prop))
/******/ 	})();
/******/ 	
/******/ 	/* webpack/runtime/make namespace object */
/******/ 	(() => {
/******/ 		// define __esModule on exports
/******/ 		__nccwpck_require__.r = (exports) => {
/******/ 			if(typeof Symbol !== 'undefined' && Symbol.toStringTag) {
/******/ 				Object.defineProperty(exports, Symbol.toStringTag, { value: 'Module' });
/******/ 			}
/******/ 			Object.defineProperty(exports, '__esModule', { value: true });
/******/ 		};
/******/ 	})();
/******/ 	
/******/ 	/* webpack/runtime/node module decorator */
/******/ 	(() => {
/******/ 		__nccwpck_require__.nmd = (module) => {
/******/ 			module.paths = [];
/******/ 			if (!module.children) module.children = [];
/******/ 			return module;
/******/ 		};
/******/ 	})();
/******/ 	
/******/ 	/* webpack/runtime/compat */
/******/ 	
/******/ 	if (typeof __nccwpck_require__ !== 'undefined') __nccwpck_require__.ab = __dirname + "/";
/******/ 	
/******/ 	/* webpack/runtime/require chunk loading */
/******/ 	(() => {
/******/ 		// no baseURI
/******/ 		
/******/ 		// object to store loaded chunks
/******/ 		// "1" means "loaded", otherwise not loaded yet
/******/ 		var installedChunks = {
/******/ 			792: 1
/******/ 		};
/******/ 		
/******/ 		// no on chunks loaded
/******/ 		
/******/ 		var installChunk = (chunk) => {
/******/ 			var moreModules = chunk.modules, chunkIds = chunk.ids, runtime = chunk.runtime;
/******/ 			for(var moduleId in moreModules) {
/******/ 				if(__nccwpck_require__.o(moreModules, moduleId)) {
/******/ 					__nccwpck_require__.m[moduleId] = moreModules[moduleId];
/******/ 				}
/******/ 			}
/******/ 			if(runtime) runtime(__nccwpck_require__);
/******/ 			for(var i = 0; i < chunkIds.length; i++)
/******/ 				installedChunks[chunkIds[i]] = 1;
/******/ 		
/******/ 		};
/******/ 		
/******/ 		// require() chunk loading for javascript
/******/ 		__nccwpck_require__.f.require = (chunkId, promises) => {
/******/ 			// "1" is the signal for "already loaded"
/******/ 			if(!installedChunks[chunkId]) {
/******/ 				if(true) { // all chunks have JS
/******/ 					installChunk(require("./" + __nccwpck_require__.u(chunkId)));
/******/ 				} else installedChunks[chunkId] = 1;
/******/ 			}
/******/ 		};
/******/ 		
/******/ 		// no external install chunk
/******/ 		
/******/ 		// no HMR
/******/ 		
/******/ 		// no HMR manifest
/******/ 	})();
/******/ 	
/************************************************************************/
var __webpack_exports__ = {};
// This entry need to be wrapped in an IIFE because it uses a non-standard name for the exports (exports).
(() => {
var exports = __webpack_exports__;

Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.run = void 0;
const action_1 = __nccwpck_require__(2929);
var action_2 = __nccwpck_require__(2929);
Object.defineProperty(exports, "run", ({ enumerable: true, get: function () { return action_2.run; } }));
void (0, action_1.run)();

})();

module.exports = __webpack_exports__;
/******/ })()
;
//# sourceMappingURL=index.js.map
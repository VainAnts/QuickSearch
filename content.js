// 内容脚本 - 用于获取用户选中的文本和处理快捷键

const STORAGE_KEY = 'shortcuts';

// 快捷键映射
let shortcutMap = {
  default: null,
  allEngines: null
};

// 加载快捷键配置
function loadShortcuts() {
  chrome.storage.local.get(STORAGE_KEY, (result) => {
    const shortcuts = result[STORAGE_KEY] || {};
    shortcutMap = {
      default: shortcuts.default || null,
      allEngines: shortcuts.allEngines || null
    };
  });
}

// 解析快捷键字符串
function parseShortcut(shortcut) {
  if (!shortcut) return null;

  const parts = shortcut.split('+');
  const keys = {
    ctrl: false,
    alt: false,
    shift: false,
    key: ''
  };

  parts.forEach(part => {
    const p = part.trim();
    if (p === 'Ctrl') keys.ctrl = true;
    else if (p === 'Alt') keys.alt = true;
    else if (p === 'Shift') keys.shift = true;
    else keys.key = p;
  });

  return keys;
}

// 检查是否匹配快捷键
function matchShortcut(e, shortcutStr) {
  if (!shortcutStr) return false;

  const shortcut = parseShortcut(shortcutStr);
  if (!shortcut || !shortcut.key) return false;

  const key = e.key.length === 1 ? e.key.toUpperCase() : e.key;

  return e.ctrlKey === shortcut.ctrl &&
         e.altKey === shortcut.alt &&
         e.shiftKey === shortcut.shift &&
         key === shortcut.key;
}

// 执行搜索
function performSearch(searchAll = false) {
  const selection = window.getSelection();
  const selectedText = selection ? selection.toString().trim() : '';

  if (!selectedText) {
    // 显示提示
    return;
  }

  try {
    chrome.runtime.sendMessage({
      action: searchAll ? 'searchWithAllEngines' : 'searchWithDefault',
      text: selectedText
    });
  } catch (e) {
    // 扩展上下文已失效（Service Worker 被终止/重载），忽略
  }
}

// 键盘事件监听
document.addEventListener('keydown', (e) => {
  // 忽略输入框内的按键
  if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.isContentEditable) {
    return;
  }

  // 检查默认引擎快捷键
  if (shortcutMap.default && matchShortcut(e, shortcutMap.default)) {
    e.preventDefault();
    performSearch(false);
    return;
  }

  // 检查全引擎快捷键
  if (shortcutMap.allEngines && matchShortcut(e, shortcutMap.allEngines)) {
    e.preventDefault();
    performSearch(true);
    return;
  }
});

// 存储变化监听
chrome.storage.onChanged.addListener((changes, areaName) => {
  if (changes[STORAGE_KEY]) {
    loadShortcuts();
  }
});

// 监听来自popup的消息
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'getSelection') {
    const selection = window.getSelection();
    const selectedText = selection ? selection.toString().trim() : '';
    sendResponse({ text: selectedText });
  }

  if (message.action === 'updateShortcuts') {
    loadShortcuts();
  }

  return true;
});

// 初始化
loadShortcuts();
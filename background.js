// 存储键名
const STORAGE_KEY = 'searchEngines';
const STORAGE_SYNC_KEY = 'sync_engines';

// 默认搜索引擎配置
const defaultEngines = [
  {
    id: 'baidu',
    name: '百度',
    urlTemplate: 'https://www.baidu.com/s?wd=%s',
    isDefault: true
  },
  {
    id: 'bing',
    name: '必应',
    urlTemplate: 'https://www.bing.com/search?q=%s',
    isDefault: false
  },
  {
    id: 'google',
    name: 'Google',
    urlTemplate: 'https://www.google.com.hk/search?q=%s',
    isDefault: false
  }
];

/**
 * 初始化右键菜单
 */
function initializeContextMenu() {
  console.log('[QuickSearch] 开始初始化右键菜单...');
  
  // 获取已存储的引擎配置
  chrome.storage.local.get(STORAGE_KEY, (result) => {
    const engines = result[STORAGE_KEY] || defaultEngines;
    console.log('[QuickSearch] 当前引擎配置:', engines);

    // 清除现有菜单（避免重复创建）
    chrome.contextMenus.removeAll(() => {
      console.log('[QuickSearch] 已清除现有菜单');
      
      try {
        // 创建唯一的一级菜单项：QuickSearch
        chrome.contextMenus.create({
          id: 'quickSearchSubmenu',
          title: 'QuickSearch',
          contexts: ['selection']
        }, () => {
          if (chrome.runtime.lastError) {
            console.error('[QuickSearch] 创建 QuickSearch 菜单失败:', chrome.runtime.lastError);
            return;
          }
          
          console.log('[QuickSearch] QuickSearch 菜单创建成功，开始创建引擎菜单项');
          
          // 为每个搜索引擎创建子菜单项
          engines.forEach((engine) => {
            const defaultBadge = engine.isDefault ? ' ⭐' : '';
            chrome.contextMenus.create({
              id: engine.id,
              parentId: 'quickSearchSubmenu',
              title: `${engine.name}${defaultBadge}`,
              contexts: ['selection']
            }, () => {
              if (chrome.runtime.lastError) {
                console.error(`[QuickSearch] 创建引擎菜单项失败 (${engine.name}):`, chrome.runtime.lastError);
              }
            });
          });

          // 添加分隔线
          chrome.contextMenus.create({
            id: 'submenuSeparator',
            parentId: 'quickSearchSubmenu',
            type: 'separator',
            contexts: ['selection']
          });

          // 添加快捷键提示
          chrome.contextMenus.create({
            id: 'submenuHint',
            parentId: 'quickSearchSubmenu',
            title: '💡 提示: 可在弹出窗口中自定义快捷键',
            contexts: ['selection']
          });
          
          console.log('[QuickSearch] 所有菜单项创建完成');
        });
      } catch (error) {
        console.error('[QuickSearch] 初始化菜单时发生错误:', error);
      }
    });
  });
}

/**
 * 获取选中的文本
 * @param {number} tabId - 标签页ID
 * @param {function} callback - 回调函数
 */
function getSelectedText(tabId, callback) {
  chrome.tabs.sendMessage(tabId, { action: 'getSelection' }, (response) => {
    if (chrome.runtime.lastError) {
      console.error('获取选中文本失败:', chrome.runtime.lastError);
      callback('');
      return;
    }
    callback(response?.text || '');
  });
}

/**
 * 执行搜索
 * @param {string} engineId - 引擎ID（'default' 表示使用默认引擎）
 * @param {string} selectedText - 选中的文本
 */
function performSearch(engineId, selectedText) {
  chrome.storage.local.get(STORAGE_KEY, (result) => {
    const engines = result[STORAGE_KEY] || defaultEngines;

    let engine;
    if (engineId === 'default') {
      // 使用默认引擎
      engine = engines.find(e => e.isDefault) || engines[0];
    } else {
      engine = engines.find(e => e.id === engineId);
    }

    if (!engine) {
      console.error('未找到搜索引擎:', engineId);
      return;
    }

    // 编码搜索关键词并构建URL
    const encodedText = encodeURIComponent(selectedText.trim());
    const searchUrl = engine.urlTemplate.replace('%s', encodedText);

    // 在新标签页打开搜索结果
    chrome.tabs.create({ url: searchUrl }, (tab) => {
      // 显示操作反馈（角标闪烁）
      showBadgeFeedback(tab.id);
    });
  });
}

/**
 * 使用所有引擎搜索（Alt+Shift+S 触发）
 * @param {string} selectedText - 选中的文本
 */
function searchWithAllEngines(selectedText) {
  chrome.storage.local.get(STORAGE_KEY, (result) => {
    const engines = result[STORAGE_KEY] || defaultEngines;
    const encodedText = encodeURIComponent(selectedText.trim());

    // 逐个打开搜索结果（每次延迟200ms避免被浏览器拦截）
    engines.forEach((engine, index) => {
      setTimeout(() => {
        const searchUrl = engine.urlTemplate.replace('%s', encodedText);
        chrome.tabs.create({ url: searchUrl });
      }, index * 200);
    });
  });
}

/**
 * 显示角标反馈
 * @param {number} tabId - 标签页ID
 */
function showBadgeFeedback(tabId) {
  // 设置角标
  chrome.action.setBadgeText({ text: '✓', tabId: tabId });
  chrome.action.setBadgeBackgroundColor({ color: '#4CAF50', tabId: tabId });

  // 2秒后清除角标
  setTimeout(() => {
    chrome.action.setBadgeText({ text: '', tabId: tabId });
  }, 2000);
}

/**
 * 同步存储数据到sync（用于跨设备同步）
 */
function syncToSyncStorage() {
  chrome.storage.local.get(STORAGE_KEY, (result) => {
    const engines = result[STORAGE_KEY] || defaultEngines;
    const syncData = {};
    syncData[STORAGE_SYNC_KEY] = engines;

    chrome.storage.sync.set(syncData, () => {
      if (chrome.runtime.lastError) {
        console.log('同步到sync存储失败，将仅使用本地存储');
      }
    });
  });
}

/**
 * 从sync存储恢复数据到local
 */
function restoreFromSyncStorage() {
  chrome.storage.sync.get(STORAGE_SYNC_KEY, (result) => {
    if (result[STORAGE_SYNC_KEY]) {
      const localData = {};
      localData[STORAGE_KEY] = result[STORAGE_SYNC_KEY];
      chrome.storage.local.set(localData, () => {
        initializeContextMenu();
      });
    }
  });
}

// 扩展安装时初始化
chrome.runtime.onInstalled.addListener((details) => {
  console.log('[QuickSearch] 扩展已安装/更新，原因:', details.reason);

  // 首次安装时设置默认数据
  if (details.reason === 'install') {
    console.log('[QuickSearch] 首次安装，设置默认数据');
    const localData = {};
    localData[STORAGE_KEY] = defaultEngines;
    chrome.storage.local.set(localData, () => {
      if (chrome.runtime.lastError) {
        console.error('[QuickSearch] 保存默认数据失败:', chrome.runtime.lastError);
      } else {
        console.log('[QuickSearch] 默认数据保存成功');
        initializeContextMenu();
      }
    });
  } else if (details.reason === 'update') {
    console.log('[QuickSearch] 扩展更新，尝试从sync恢复');
    // 更新时尝试从sync恢复
    restoreFromSyncStorage();
  } else {
    console.log('[QuickSearch] 其他原因触发 onInstalled');
    initializeContextMenu();
  }

  // 确保sync存储也更新
  syncToSyncStorage();
});

// 扩展启动时初始化
chrome.runtime.onStartup.addListener(() => {
  console.log('[QuickSearch] 扩展已启动');
  restoreFromSyncStorage();
  syncToSyncStorage();
});

// 右键菜单点击事件
chrome.contextMenus.onClicked.addListener((info, tab) => {
  const selectedText = info.selectionText;

  // 忽略分隔线、提示和父菜单项
  if (info.menuItemId === 'submenuSeparator' || 
      info.menuItemId === 'submenuHint' || 
      info.menuItemId === 'quickSearchSubmenu') {
    return;
  }

  if (!selectedText || selectedText.trim() === '') {
    return;
  }

  // 直接使用对应的搜索引擎进行搜索
  performSearch(info.menuItemId, selectedText);
});

// 监听来自popup和content的消息
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'getSelection') {
    // 从内容脚本获取选中文本
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0]) {
        chrome.tabs.sendMessage(tabs[0].id, { action: 'getSelection' }, (response) => {
          sendResponse(response);
        });
        return true; // 异步响应
      }
    });
  }

  if (message.action === 'search') {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0]) {
        chrome.tabs.sendMessage(tabs[0].id, { action: 'getSelection' }, (response) => {
          if (response?.text) {
            performSearch(message.engineId, response.text);
          }
        });
      }
    });
  }

  // 处理内容脚本触发的搜索
  if (message.action === 'searchWithDefault') {
    chrome.storage.local.get(STORAGE_KEY, (result) => {
      const engines = result[STORAGE_KEY] || defaultEngines;
      const defaultEngine = engines.find(e => e.isDefault) || engines[0];
      if (defaultEngine && message.text) {
        performSearch(defaultEngine.id, message.text);
      }
    });
  }

  if (message.action === 'searchWithAllEngines') {
    if (message.text) {
      searchWithAllEngines(message.text);
    }
  }

  if (message.action === 'updateContextMenu') {
    initializeContextMenu();
  }

  if (message.action === 'updateShortcuts') {
    // 通知所有内容脚本更新快捷键
    chrome.tabs.query({}, (tabs) => {
      tabs.forEach(tab => {
        chrome.tabs.sendMessage(tab.id, { action: 'updateShortcuts' });
      });
    });
  }

  return true;
});

// 监听存储变化 - 仅在 API 可用时注册
if (chrome.storage && chrome.storage.onChanged) {
  chrome.storage.onChanged.addListener((changes, areaName) => {
    if (changes[STORAGE_KEY]) {
      // 重新初始化右键菜单
      initializeContextMenu();

      // 同步到sync存储
      if (areaName === 'local') {
        syncToSyncStorage();
      }
    }
  });
}

// 初始化 - Service Worker 会在需要时自动激活
console.log('[QuickSearch] background.js 加载完成');
initializeContextMenu();

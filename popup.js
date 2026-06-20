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

// 存储键名
const STORAGE_KEY = 'searchEngines';
const STORAGE_SYNC_KEY = 'sync_engines';
const SHORTCUT_KEY = 'shortcuts';

// DOM元素
const engineListEl = document.getElementById('engineList');
const engineModal = document.getElementById('engineModal');
const engineForm = document.getElementById('engineForm');
const modalTitle = document.getElementById('modalTitle');
const statusBar = document.getElementById('statusBar');

// 表单字段
const engineIdInput = document.getElementById('engineId');
const engineNameInput = document.getElementById('engineName');
const engineUrlInput = document.getElementById('engineUrl');

// 按钮
const addEngineBtn = document.getElementById('addEngineBtn');
const closeModalBtn = document.getElementById('closeModalBtn');
const cancelBtn = document.getElementById('cancelBtn');

// 快捷键元素
const defaultShortcutInput = document.getElementById('defaultShortcut');
const allEnginesShortcutInput = document.getElementById('allEnginesShortcut');
const clearDefaultBtn = document.getElementById('clearDefaultShortcut');
const clearAllEnginesBtn = document.getElementById('clearAllEnginesShortcut');
const shortcutStatus = document.getElementById('shortcutStatus');

// 备份和同步元素
const exportConfigBtn = document.getElementById('exportConfigBtn');
const importConfigBtn = document.getElementById('importConfigBtn');
const importFileInput = document.getElementById('importFileInput');

// 当前正在录制的输入框
let recordingInput = null;

// 无效快捷键列表
const invalidShortcuts = [
  'Ctrl+C', 'Ctrl+V', 'Ctrl+X', 'Ctrl+Z', 'Ctrl+A', 'Ctrl+S', 'Ctrl+F',
  'Ctrl+W', 'Ctrl+T', 'Ctrl+N', 'Ctrl+R', 'Ctrl+T', 'Ctrl+H',
  'Alt+F4', 'Alt+Tab', 'Alt+Enter'
];

/**
 * 显示状态消息
 */
function showStatus(message, isError = false) {
  statusBar.textContent = message;
  statusBar.className = isError ? 'status-bar error' : 'status-bar success';
  setTimeout(() => {
    statusBar.textContent = '';
    statusBar.className = 'status-bar';
  }, 3000);
}

/**
 * 加载引擎列表
 */
function loadEngines() {
  chrome.storage.local.get(STORAGE_KEY, (result) => {
    const engines = result[STORAGE_KEY] || defaultEngines;
    renderEngineList(engines);
  });
}

/**
 * 渲染引擎列表
 */
function renderEngineList(engines) {
  engineListEl.innerHTML = '';

  engines.forEach((engine, index) => {
    const engineItem = document.createElement('div');
    engineItem.className = 'engine-item';
    engineItem.dataset.id = engine.id;
    engineItem.draggable = true; // 启用拖拽

    const defaultBadge = engine.isDefault ? '<span class="badge">默认</span>' : '';
    const isDefaultDisabled = engine.isDefault ? 'disabled' : '';

    engineItem.innerHTML = `
      <div class="engine-info">
        <div class="engine-name">
          <span>${escapeHtml(engine.name)}</span>
          ${defaultBadge}
        </div>
        <div class="engine-url" title="${escapeHtml(engine.urlTemplate)}">
          ${escapeHtml(truncateUrl(engine.urlTemplate))}
        </div>
      </div>
      <div class="engine-actions">
        <button class="btn btn-small btn-default" data-action="default" ${isDefaultDisabled} title="设为默认">
          ★
        </button>
        <button class="btn btn-small btn-edit" data-action="edit" title="编辑">✎</button>
        <button class="btn btn-small btn-delete" data-action="delete" title="删除">✕</button>
      </div>
    `;

    engineListEl.appendChild(engineItem);
  });

  bindEngineEvents();
  bindDragAndDrop(); // 绑定拖拽事件
}

/**
 * HTML转义
 */
function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

/**
 * 截断URL显示
 */
function truncateUrl(url, maxLength = 40) {
  if (url.length <= maxLength) return url;
  return url.substring(0, maxLength) + '...';
}

/**
 * 绑定引擎项的事件
 */
function bindEngineEvents() {
  const items = engineListEl.querySelectorAll('.engine-item');

  items.forEach(item => {
    const actions = item.querySelectorAll('.engine-actions button');

    actions.forEach(btn => {
      btn.addEventListener('click', (e) => {
        const action = e.target.dataset.action;
        const engineId = item.dataset.id;

        switch (action) {
          case 'default':
            setAsDefault(engineId);
            break;
          case 'edit':
            editEngine(engineId);
            break;
          case 'delete':
            deleteEngine(engineId);
            break;
        }
      });
    });
  });
}

/**
 * 绑定拖拽排序功能
 */
function bindDragAndDrop() {
  const items = engineListEl.querySelectorAll('.engine-item');
  let draggedItem = null;

  items.forEach(item => {
    // 拖拽开始
    item.addEventListener('dragstart', (e) => {
      draggedItem = item;
      item.classList.add('dragging');
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData('text/html', item.innerHTML);
    });

    // 拖拽结束
    item.addEventListener('dragend', () => {
      item.classList.remove('dragging');
      
      // 移除所有 drag-over 类
      items.forEach(i => i.classList.remove('drag-over'));
      
      // 保存新的顺序
      saveEngineOrder();
      
      draggedItem = null;
    });

    // 拖拽经过
    item.addEventListener('dragover', (e) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
      
      if (item !== draggedItem) {
        item.classList.add('drag-over');
      }
    });

    // 拖拽离开
    item.addEventListener('dragleave', () => {
      item.classList.remove('drag-over');
    });

    // 放下
    item.addEventListener('drop', (e) => {
      e.preventDefault();
      item.classList.remove('drag-over');
      
      if (draggedItem && item !== draggedItem) {
        // 获取所有引擎项的数组
        const allItems = Array.from(engineListEl.querySelectorAll('.engine-item'));
        const draggedIndex = allItems.indexOf(draggedItem);
        const targetIndex = allItems.indexOf(item);
        
        // 重新排列 DOM 元素
        if (draggedIndex < targetIndex) {
          engineListEl.insertBefore(draggedItem, item.nextSibling);
        } else {
          engineListEl.insertBefore(draggedItem, item);
        }
      }
    });
  });
}

/**
 * 保存引擎顺序
 */
function saveEngineOrder() {
  chrome.storage.local.get(STORAGE_KEY, (result) => {
    let engines = result[STORAGE_KEY] || defaultEngines;
    
    // 根据 DOM 顺序重新排列引擎数组
    const items = engineListEl.querySelectorAll('.engine-item');
    const newOrder = [];
    
    items.forEach(item => {
      const engineId = item.dataset.id;
      const engine = engines.find(e => e.id === engineId);
      if (engine) {
        newOrder.push(engine);
      }
    });
    
    // 保存新顺序
    saveEngines(newOrder);
    showStatus('已更新搜索引擎顺序');
  });
}

/**
 * 设置为默认引擎
 */
function setAsDefault(engineId) {
  chrome.storage.local.get(STORAGE_KEY, (result) => {
    let engines = result[STORAGE_KEY] || defaultEngines;

    engines = engines.map(engine => ({
      ...engine,
      isDefault: engine.id === engineId
    }));

    saveEngines(engines);
    showStatus('已设为默认搜索引擎');
  });
}

/**
 * 编辑引擎
 */
function editEngine(engineId) {
  chrome.storage.local.get(STORAGE_KEY, (result) => {
    const engines = result[STORAGE_KEY] || defaultEngines;
    const engine = engines.find(e => e.id === engineId);

    if (engine) {
      modalTitle.textContent = '编辑搜索引擎';
      engineIdInput.value = engine.id;
      engineNameInput.value = engine.name;
      engineUrlInput.value = engine.urlTemplate;
      openModal();
    }
  });
}

/**
 * 删除引擎
 */
function deleteEngine(engineId) {
  chrome.storage.local.get(STORAGE_KEY, (result) => {
    let engines = result[STORAGE_KEY] || defaultEngines;
    const engine = engines.find(e => e.id === engineId);

    if (!engine) return;

    if (engines.length <= 1) {
      showStatus('至少需要保留一个搜索引擎', true);
      return;
    }

    const wasDefault = engine.isDefault;
    engines = engines.filter(e => e.id !== engineId);

    if (wasDefault && engines.length > 0) {
      engines[0].isDefault = true;
    }

    saveEngines(engines);
    showStatus('已删除搜索引擎');
  });
}

/**
 * 保存引擎列表到存储
 */
function saveEngines(engines) {
  const data = {};
  data[STORAGE_KEY] = engines;

  chrome.storage.local.set(data, () => {
    if (chrome.runtime.lastError) {
      showStatus('保存失败: ' + chrome.runtime.lastError.message, true);
      return;
    }

    const syncData = {};
    syncData[STORAGE_SYNC_KEY] = engines;
    chrome.storage.sync.set(syncData, () => {
      loadEngines();
    });
  });
}

/**
 * 打开弹窗
 */
function openModal() {
  engineModal.classList.add('show');
  engineNameInput.focus();
}

/**
 * 关闭弹窗
 */
function closeModal() {
  engineModal.classList.remove('show');
  engineForm.reset();
  engineIdInput.value = '';
  modalTitle.textContent = '添加搜索引擎';
}

/**
 * 生成唯一ID
 */
function generateId(engines) {
  const existingIds = engines.map(e => e.id);
  let id = 'engine_' + Date.now();

  while (existingIds.includes(id)) {
    id = 'engine_' + (Date.now() + Math.random() * 1000);
  }

  return id;
}

/**
 * 验证URL模板
 */
function validateUrlTemplate(url) {
  return url.includes('%s') || url.includes('{searchTerm}') || url.includes('{q}');
}

/**
 * 格式化快捷键显示
 */
function formatShortcut(e) {
  const parts = [];
  if (e.ctrlKey) parts.push('Ctrl');
  if (e.altKey) parts.push('Alt');
  if (e.shiftKey) parts.push('Shift');

  const key = e.key.length === 1 ? e.key.toUpperCase() : e.key;
  parts.push(key);

  return parts.join('+');
}

/**
 * 检查快捷键是否有效
 */
function isValidShortcut(shortcut) {
  // 不能只有修饰键
  if (['Ctrl', 'Alt', 'Shift', 'Ctrl+Alt', 'Ctrl+Shift', 'Alt+Shift', 'Ctrl+Alt+Shift'].includes(shortcut)) {
    return { valid: false, reason: '不能只有修饰键' };
  }

  // 检查是否在无效列表中
  if (invalidShortcuts.includes(shortcut)) {
    return { valid: false, reason: '该快捷键被系统占用' };
  }

  // 必须包含至少一个修饰键
  if (!shortcut.includes('Ctrl') && !shortcut.includes('Alt') && !shortcut.includes('Shift')) {
    return { valid: false, reason: '必须配合 Ctrl/Alt/Shift 使用' };
  }

  return { valid: true };
}

/**
 * 显示快捷键状态
 */
function showShortcutStatus(message, type) {
  shortcutStatus.textContent = message;
  shortcutStatus.className = 'shortcut-status show ' + type;
}

/**
 * 检查快捷键冲突
 */
function checkConflict(shortcut, currentType) {
  return new Promise((resolve) => {
    chrome.storage.local.get(SHORTCUT_KEY, (result) => {
      const shortcuts = result[SHORTCUT_KEY] || {};
      const otherType = currentType === 'default' ? 'allEngines' : 'default';

      if (shortcuts[otherType] === shortcut) {
        resolve({ conflict: true, message: '与"全引擎搜索"快捷键冲突' });
      } else {
        resolve({ conflict: false });
      }
    });
  });
}

/**
 * 保存快捷键
 */
async function saveShortcut(shortcut, type) {
  // 验证快捷键
  const validation = isValidShortcut(shortcut);
  if (!validation.valid) {
    showShortcutStatus(validation.reason, 'error');
    return false;
  }

  // 检查冲突
  const conflict = await checkConflict(shortcut, type);
  if (conflict.conflict) {
    showShortcutStatus(conflict.message, 'warning');
    return false;
  }

  // 保存到存储
  chrome.storage.local.get(SHORTCUT_KEY, (result) => {
    const shortcuts = result[SHORTCUT_KEY] || {};
    shortcuts[type] = shortcut;

    chrome.storage.local.set({ [SHORTCUT_KEY]: shortcuts }, () => {
      showShortcutStatus('快捷键已保存', 'success');

      // 通知 background 和 content scripts 更新快捷键
      chrome.runtime.sendMessage({ action: 'updateShortcuts' });
    });
  });

  return true;
}

/**
 * 加载保存的快捷键
 */
function loadShortcuts() {
  chrome.storage.local.get(SHORTCUT_KEY, (result) => {
    const shortcuts = result[SHORTCUT_KEY] || {};

    const helpShortcutEl = document.getElementById('helpDefaultShortcut');

    if (shortcuts.default) {
      defaultShortcutInput.value = shortcuts.default;
      if (helpShortcutEl) helpShortcutEl.textContent = shortcuts.default;
    } else {
      if (helpShortcutEl) helpShortcutEl.textContent = '未设置';
    }

    if (shortcuts.allEngines) {
      allEnginesShortcutInput.value = shortcuts.allEngines;
    }
  });
}

/**
 * 清除快捷键
 */
function clearShortcut(type) {
  chrome.storage.local.get(SHORTCUT_KEY, (result) => {
    const shortcuts = result[SHORTCUT_KEY] || {};
    delete shortcuts[type];

    chrome.storage.local.set({ [SHORTCUT_KEY]: shortcuts }, () => {
      if (type === 'default') {
        defaultShortcutInput.value = '';
        const helpShortcutEl = document.getElementById('helpDefaultShortcut');
        if (helpShortcutEl) helpShortcutEl.textContent = '未设置';
      } else {
        allEnginesShortcutInput.value = '';
      }
      showShortcutStatus('已清除快捷键', 'success');
    });
  });
}

/**
 * 处理快捷键录制
 */
function handleShortcutRecord(e, input) {
  e.preventDefault();

  // 忽略单独的修饰键
  if (['Control', 'Alt', 'Shift'].includes(e.key)) {
    return;
  }

  // ESC 取消录制
  if (e.key === 'Escape') {
    if (recordingInput) {
      recordingInput.classList.remove('recording');
      recordingInput.value = recordingInput.dataset.previous || '';
      recordingInput = null;
    }
    return;
  }

  const shortcut = formatShortcut(e);
  recordingInput = input;
  input.value = shortcut;
  input.classList.remove('recording');

  saveShortcut(shortcut, input.id === 'defaultShortcut' ? 'default' : 'allEngines');
  recordingInput = null;
}

// 事件监听 - 引擎管理
addEngineBtn.addEventListener('click', () => {
  modalTitle.textContent = '添加搜索引擎';
  engineForm.reset();
  engineIdInput.value = '';
  openModal();
});

closeModalBtn.addEventListener('click', closeModal);
cancelBtn.addEventListener('click', closeModal);

engineModal.addEventListener('click', (e) => {
  if (e.target === engineModal) {
    closeModal();
  }
});

engineForm.addEventListener('submit', (e) => {
  e.preventDefault();

  const name = engineNameInput.value.trim();
  const url = engineUrlInput.value.trim();
  const existingId = engineIdInput.value;

  if (!validateUrlTemplate(url)) {
    showStatus('URL必须包含 %s 占位符', true);
    return;
  }

  chrome.storage.local.get(STORAGE_KEY, (result) => {
    let engines = result[STORAGE_KEY] || [...defaultEngines];

    if (existingId) {
      const index = engines.findIndex(e => e.id === existingId);
      if (index !== -1) {
        engines[index].name = name;
        engines[index].urlTemplate = url;
      }
    } else {
      const newEngine = {
        id: generateId(engines),
        name: name,
        urlTemplate: url,
        isDefault: engines.length === 0
      };
      engines.push(newEngine);
    }

    saveEngines(engines);
    closeModal();
    showStatus(existingId ? '已更新搜索引擎' : '已添加搜索引擎');
  });
});

// 事件监听 - 快捷键配置
defaultShortcutInput.addEventListener('focus', (e) => {
  if (recordingInput && recordingInput !== defaultShortcutInput) {
    recordingInput.classList.remove('recording');
    recordingInput.value = recordingInput.dataset.previous || '';
  }
  recordingInput = defaultShortcutInput;
  defaultShortcutInput.dataset.previous = defaultShortcutInput.value;
  defaultShortcutInput.value = '';
  defaultShortcutInput.classList.add('recording');
  showShortcutStatus('按下快捷键（ESC取消）', 'warning');
});

allEnginesShortcutInput.addEventListener('focus', (e) => {
  if (recordingInput && recordingInput !== allEnginesShortcutInput) {
    recordingInput.classList.remove('recording');
    recordingInput.value = recordingInput.dataset.previous || '';
  }
  recordingInput = allEnginesShortcutInput;
  allEnginesShortcutInput.dataset.previous = allEnginesShortcutInput.value;
  allEnginesShortcutInput.value = '';
  allEnginesShortcutInput.classList.add('recording');
  showShortcutStatus('按下快捷键（ESC取消）', 'warning');
});

defaultShortcutInput.addEventListener('keydown', (e) => handleShortcutRecord(e, defaultShortcutInput));
allEnginesShortcutInput.addEventListener('keydown', (e) => handleShortcutRecord(e, allEnginesShortcutInput));

defaultShortcutInput.addEventListener('blur', () => {
  if (recordingInput === defaultShortcutInput) {
    defaultShortcutInput.classList.remove('recording');
    defaultShortcutInput.value = defaultShortcutInput.dataset.previous || '';
    recordingInput = null;
    showShortcutStatus('', '');
  }
});

allEnginesShortcutInput.addEventListener('blur', () => {
  if (recordingInput === allEnginesShortcutInput) {
    allEnginesShortcutInput.classList.remove('recording');
    allEnginesShortcutInput.value = allEnginesShortcutInput.dataset.previous || '';
    recordingInput = null;
    showShortcutStatus('', '');
  }
});

clearDefaultBtn.addEventListener('click', () => clearShortcut('default'));
clearAllEnginesBtn.addEventListener('click', () => clearShortcut('allEngines'));

// ==================== 配置导入导出功能 ====================

/**
 * 导出配置到文件
 */
function exportConfig() {
  chrome.storage.local.get([STORAGE_KEY, SHORTCUT_KEY], (result) => {
    const config = {
      version: '1.0.0',
      exportDate: new Date().toISOString(),
      engines: result[STORAGE_KEY] || [],
      shortcuts: result[SHORTCUT_KEY] || {}
    };

    const blob = new Blob([JSON.stringify(config, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `quicksearch-config-${new Date().getTime()}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    showStatus('配置已导出');
  });
}

/**
 * 从文件导入配置
 */
function importConfig(file) {
  const reader = new FileReader();
  
  reader.onload = (e) => {
    try {
      const config = JSON.parse(e.target.result);
      
      // 验证配置格式
      if (!config.version || !config.engines) {
        throw new Error('无效的配置文件格式');
      }

      // 确认导入
      if (!confirm(`确定要导入配置吗？这将覆盖当前的 ${config.engines.length} 个搜索引擎配置和快捷键设置。`)) {
        return;
      }

      // 保存引擎配置
      if (config.engines && config.engines.length > 0) {
        chrome.storage.local.set({ [STORAGE_KEY]: config.engines }, () => {
          console.log('引擎配置已导入');
        });
      }

      // 保存快捷键配置
      if (config.shortcuts) {
        chrome.storage.local.set({ [SHORTCUT_KEY]: config.shortcuts }, () => {
          console.log('快捷键配置已导入');
        });
      }

      // 重新加载界面
      setTimeout(() => {
        loadEngines();
        loadShortcuts();
        showStatus('配置导入成功，请刷新页面查看效果');
      }, 500);

    } catch (error) {
      showStatus('配置导入失败: ' + error.message, true);
    }
  };

  reader.onerror = () => {
    showStatus('文件读取失败', true);
  };

  reader.readAsText(file);
}

// 事件监听 - 配置导入导出
exportConfigBtn.addEventListener('click', exportConfig);

importConfigBtn.addEventListener('click', () => {
  importFileInput.click();
});

importFileInput.addEventListener('change', (e) => {
  const file = e.target.files[0];
  if (file) {
    importConfig(file);
    importFileInput.value = ''; // 清空以便下次选择同一文件
  }
});

// ESC键关闭弹窗
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && engineModal.classList.contains('show')) {
    closeModal();
  }
});

// 页面加载时读取数据
document.addEventListener('DOMContentLoaded', () => {
  loadEngines();
  loadShortcuts();
});

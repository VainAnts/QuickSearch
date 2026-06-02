# QuickSearch Extension

浏览器扩展，可在 Microsoft Edge 和 Google Chrome 上快速搜索选中的文本。

## 功能特性

- **右键菜单搜索**: 选中网页文本后，右键点击选择搜索引擎
- **快捷键搜索**: 按 `Ctrl+Shift+S` 使用默认引擎快速搜索
- **多引擎管理**: 内置百度、必应、谷歌，支持添加/编辑/删除自定义引擎
- **设置默认引擎**: 自由切换默认搜索引擎
- **跨设备同步**: 使用 chrome.storage.sync 在登录设备间同步配置
- **操作反馈**: 搜索触发时显示角标和通知

## 文件结构

```
quicksearch/
├── manifest.json          # 清单文件 (Manifest V3)
├── background.js          # Service Worker，处理右键菜单和搜索
├── content.js             # 内容脚本，获取选中文本
├── popup.html             # 配置界面 HTML
├── popup.js               # 配置界面交互逻辑
├── popup.css              # 配置界面样式
├── icons/
│   └── icon.svg           # 扩展图标
└── README.md              # 本文件
```

## 安装步骤

### 1. 下载/克隆代码

将 `quicksearch` 文件夹保存到本地。

### 2. 加载扩展 (Edge / Chrome)

#### Edge
1. 打开 Edge，进入 `edge://extensions/`
2. 开启右上角「开发者模式」
3. 点击「加载扩展」
4. 选择 `quicksearch` 文件夹

#### Chrome
1. 打开 Chrome，进入 `chrome://extensions/`
2. 开启右上角「开发者模式」
3. 点击「加载已解压的扩展程序」
4. 选择 `quicksearch` 文件夹

## 使用方法

### 基础操作

1. **搜索选中文本**:
   - 在网页上选中一段文字
   - 右键点击，选择「使用 XXX 搜索」
   - 或按 `Ctrl+Shift+S` 使用默认引擎

2. **管理搜索引擎**:
   - 点击浏览器工具栏的扩展图标
   - 在弹窗中管理搜索引擎列表
   - 设置默认引擎、添加自定义引擎

### 添加自定义引擎

URL 模板中需包含 `%s` 占位符，表示搜索关键词。

示例:
- `https://www.baidu.com/s?wd=%s`
- `https://www.bing.com/search?q=%s`
- `https://www.google.com/search?q=%s`

### 快捷键

| 快捷键 | 功能 | 说明 |
|--------|------|------|
| `Ctrl+Shift+S` | 快速搜索 | 使用默认引擎搜索选中文本 |

可在扩展管理页面自定义快捷键。

## 技术说明

- **Manifest V3**: 兼容最新浏览器版本
- **Service Worker**: 后台服务，处理右键菜单和搜索逻辑
- **chrome.storage.local**: 主存储，快速响应
- **chrome.storage.sync**: 跨设备同步（需登录 Chrome/Edge）
- **本地存储降级**: sync 失败时自动使用 local 存储

## 权限说明

| 权限 | 用途 |
|------|------|
| contextMenus | 右键菜单功能 |
| storage | 存储引擎配置 |
| activeTab | 获取当前标签页信息 |
| scripting | 执行内容脚本获取选中文本 |
| notifications | 显示搜索操作通知 |

## 注意事项

1. 图标使用 SVG 格式，无需额外图片文件
2. 首次安装会初始化默认搜索引擎
3. 配置变更会自动同步到已登录设备
4. 快捷键可在浏览器扩展管理页面修改

## 许可

MIT License
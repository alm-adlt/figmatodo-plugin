# Figma TodoList-plugin
这是一个可以在网页版figma design里使用的todo list工具，是一个悬浮按钮，可以@部件和快速跳转，支持根据todo跳转design界面，可以一键导出/导入list内容。A Todo List tool for Figma Design that lets you mention components with @, jump from todos directly to the related design area, and import or export list content with one click.


## 功能特点

- 根据 Figma 文件独立保存 Todo，不同设计文件之间互不干扰
- 在页面中显示悬浮按钮，可拖动位置
- 鼠标悬停或点击悬浮按钮即可打开 Todo 面板
- 支持添加、完成、删除 Todo
- 支持一次输入多行 Todo，每一行会创建一条待办
- 支持查看所有已有 Todo 的设计文件列表
- 支持固定面板，避免鼠标离开后自动收起
- Todo 数据保存在浏览器本地，不依赖后端服务

## 安装方法

### Chrome / Edge 开发者模式安装

1. 下载或克隆本仓库到本地。
2. 打开浏览器扩展管理页面：
   - Chrome：`chrome://extensions/`
   - Edge：`edge://extensions/`
3. 开启右上角的“开发者模式”。
4. 点击“加载已解压的扩展程序”。
5. 选择本项目中的 `extension` 文件夹。
6. 安装完成后，打开 Figma 设计文件页面即可使用。

> 注意：需要选择 `extension` 文件夹，而不是整个仓库根目录。

## 使用方法

1. 打开任意 Figma 设计文件，例如 `https://www.figma.com/design/...`。
2. 页面中会出现 Figma TodoList 的悬浮按钮。
3. 将鼠标移到按钮上，或点击按钮，打开 Todo 面板。
4. 在输入框中输入待办内容，按 `Enter` 添加。
5. 如需一次添加多条待办，可以粘贴多行内容，每行会生成一条 Todo。
6. 点击圆形勾选按钮可标记完成，再次点击可恢复未完成状态。
7. 点击删除按钮可移除对应 Todo。
8. 点击面板中的 `List` 可以查看所有记录过 Todo 的 Figma 文件。
9. 点击 `Pin` 可以固定面板，避免面板自动收起。

## 项目结构

```text
.
+-- README.md
`-- extension
    +-- manifest.json
    +-- popup.html
    +-- assets
    |   `-- icons
    `-- dist
        +-- background
        |   `-- service-worker.js
        `-- content
            `-- index.js
```

## 权限说明

本扩展会请求以下权限：

- `storage`：用于保存 Todo 数据。
- `activeTab`：用于读取当前标签页状态。
- `https://www.figma.com/*`：用于在 Figma 页面中注入 Todo 面板。

所有 Todo 数据都保存在浏览器本地，不会上传到服务器。

## 适用范围

当前扩展会在以下页面生效：

- `https://www.figma.com/design/*`
- `https://www.figma.com/file/*`

## 开发说明

当前仓库已经包含可直接加载的扩展文件，不需要额外构建即可安装使用。修改代码后，如浏览器未自动更新，可以在扩展管理页面点击“重新加载”。

## 许可证

本项目采用 PolyForm Noncommercial License 1.0.0，允许个人学习、研究、测试和非商业使用，禁止未经授权的商业使用。详见 [LICENSE](./LICENSE)。

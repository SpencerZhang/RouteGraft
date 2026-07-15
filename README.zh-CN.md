# RouteGraft

[English](README.md) | [简体中文](README.zh-CN.md)

![RouteGraft 图标](assets/icons/icon-128.png)

RouteGraft 是一个开源的 Manifest V3 浏览器扩展，用于在不同开发环境之间切换 HTTP 请求。重定向目标地址完全由用户配置，可以指向 localhost、局域网主机、测试环境或任意其他 HTTP(S) 服务。

## 功能

- 支持多个可复用 Profile，并可同时启用多个 Profile
- 提供全局暂停、Profile 开关和规则开关
- 支持 URL 前缀、通配符和正则表达式匹配
- 支持设置或移除匹配请求的请求与响应 Header
- 源地址和目标地址均可自由配置
- 可选择保留剩余路径与查询参数
- 使用 `chrome.storage.local` 在本地持久化配置
- 支持 RouteGraft JSON 导入和导出
- 尽可能兼容常见的旧版 ModHeader 导出格式
- 根据浏览器语言自动选择英文或简体中文界面
- 无账号、统计分析、广告、远程脚本或后端服务

## 示例

配置一条 URL 前缀重定向：

```text
源地址：https://api.example.com/v1
目标地址：http://127.0.0.1:8080
保留剩余路径和查询参数：启用
```

将产生如下映射：

```text
https://api.example.com/v1/users?id=42
→ http://127.0.0.1:8080/users?id=42
```

目标地址同样可以是 `https://api.staging.example.net`，localhost 并未写死。

## 开发版安装

1. 在 Chrome、Edge、Brave 或其他 Chromium 浏览器中打开 `chrome://extensions`。
2. 启用右上角的“开发者模式”。
3. 点击“加载已解压的扩展程序”。
4. 选择本仓库目录，即包含 `manifest.json` 的目录。
5. 固定 RouteGraft，然后打开扩展弹窗。

无需构建，也无需安装依赖。

## 重定向模式

### URL 前缀

这是最简单、最安全的模式。源地址必须是 HTTP(S) URL。RouteGraft 会匹配完全相同的基础地址，或以 `/`、`?`、`#` 为边界的后续内容，因此 `/v1` 不会误匹配 `/v10`。末尾的 `/*` 可作为常用简写，其效果与去掉 `/*` 后的基础前缀相同。

### 通配符

源地址中的每个 `*` 都会产生一个捕获值，在目标地址中使用 `$1` 至 `$9` 引用。

```text
源地址：https://*.example.com/api/*
目标地址：http://dev.internal/$2
```

### 正则表达式

使用 Chrome `declarativeNetRequest` 支持的 RE2 语法。目标地址可使用 `$1` 至 `$9` 引用捕获内容。

## Header 规则

Header 规则可以为匹配的 URL 设置或移除请求 Header、响应 Header。每条规则支持 URL 前缀、通配符、正则表达式三种匹配方式，也可限定为 Fetch / XHR、文档 / Frame 等资源类型。Header 修改由 Chrome Manifest V3 原生 `modifyHeaders` 规则执行，并受所属 Profile 和规则开关控制。

## 浏览器行为说明

- 请求重定向不会绕过 CORS。涉及跨域时，目标服务必须允许 Web 应用所在的 Origin。
- HTTPS 到 HTTP 的行为由浏览器控制。回环开发地址通常可以使用，但本地 HTTPS 服务最为稳定。
- 测试路由变化时，可能需要清理 Service Worker 和应用缓存。
- 扩展需要访问所有 URL，因为用户可以配置任意源地址和目标地址。所有规则数据只保存在本地浏览器存储中。
- 其他重定向类扩展可能影响规则执行优先级。

## 测试

需要较新的 Node.js，无第三方依赖：

```sh
npm test
```

## 项目结构

```text
manifest.json       扩展清单
src/background.js   Profile 编译与 DNR 规则应用
src/rules.js        URL 与 Header 规则编译器
src/model.js        持久化数据模型与标准化处理
src/import.js       RouteGraft 与旧版 ModHeader 配置导入
src/popup.*         扩展用户界面
test/               Node.js 自动测试
```

## 隐私与安全

RouteGraft 本身不会发起数据上传请求，也不会上传 Profile、请求元数据、URL 或 Header。导出包含 `Authorization` 等凭据的配置时请谨慎处理。

请参阅[隐私政策](PRIVACY.zh-CN.md)。

## 许可证

[MIT](LICENSE)

# RouteGraft 隐私政策

生效日期：2026 年 7 月 13 日

RouteGraft 是一款开发工具，根据用户配置的规则重定向浏览器请求。本政策说明扩展如何处理信息。

## 处理的信息

RouteGraft 会在用户设备本地处理请求 URL，以判断请求是否匹配已启用的重定向规则。用户创建的 Profile、重定向规则和偏好设置保存在 `chrome.storage.local` 中。为便于诊断，扩展会在 `chrome.storage.session` 中临时保存少量已匹配请求 URL 及其重定向目标。

RouteGraft 不会向开发者或任何第三方收集、传输、出售或共享这些信息。扩展不包含统计分析、广告、跟踪、账号系统或后端服务。

## 权限用途

- 访问 HTTP 和 HTTPS 网站：用户可能为任意开发主机配置重定向规则。
- `declarativeNetRequest`：应用用户配置的重定向规则。
- `declarativeNetRequestFeedback`：报告实际命中的规则，帮助用户诊断路由行为。
- `storage`：在本地保存 Profile，并在当前浏览器会话中保存临时诊断记录。

## 保留与删除

Profile 会一直保存在浏览器的扩展本地存储中，直到用户修改配置、清除扩展数据或卸载 RouteGraft。会话诊断日志是临时数据，也可以在扩展界面中手动清空。

## 远程代码与外部服务

RouteGraft 不下载或执行远程代码，也不会将信息发送到外部服务。

## 有限使用

RouteGraft 仅将信息用于提供和改进其单一的用户功能：根据用户配置的规则路由开发请求。信息不会用于广告、信贷决策或其他无关用途，也不会提供给人工查看。

## 政策变更

本政策如有重大变化，将随新的扩展版本发布，并同步更新 Chrome Web Store 商店信息。

## 联系方式

如有问题，请通过 [GitHub Issues](https://github.com/SpencerZhang/RouteGraft/issues) 提交。

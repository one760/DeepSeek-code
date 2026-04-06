# Deepseek Code 使用说明

这是 `deepseek-code@0.1.0` 的离线安装包。

## 环境要求

- Node.js 20 或更高版本
- 可以访问 DeepSeek API

## 包含文件

- `deepseek-code-0.1.0.tgz`：CLI 安装包
- `INSTALL.md`：本说明文件

## 安装方式

### 方式一：全局安装

```bash
npm install -g ./deepseek-code-0.1.0.tgz
```

安装完成后可执行：

```bash
deepseek code
```

### 方式二：不安装，直接运行

```bash
npx ./deepseek-code-0.1.0.tgz code
```

## 首次使用

先登录 DeepSeek API Key：

```bash
deepseek code login
```

然后启动：

```bash
deepseek code
```

## 常用命令

查看版本：

```bash
deepseek code version
```

查看配置：

```bash
deepseek code config
```

环境诊断：

```bash
deepseek code doctor
```

设置日志级别：

```bash
deepseek code log-level debug
```

## 常见问题

如果安装时报权限错误，可以尝试：

```bash
npm install -g ./deepseek-code-0.1.0.tgz --cache /tmp/deepseek-npm-cache
```

如果命令找不到，请确认全局 npm bin 目录已加入 `PATH`。

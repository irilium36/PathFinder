# Railway 部署说明

## 1. 上传到 GitHub

确保仓库中包含以下文件：

- `app.py`
- `requirements.txt`
- `Procfile`
- `runtime.txt`
- `railway.json`
- `templates/`
- `static/`

## 2. 创建 Railway 项目

- 打开 Railway
- 选择 New Project
- 选择 Deploy from GitHub repo
- 授权并选择仓库

## 3. 配置环境变量

在 Railway Variables 中添加：

```env
COZE_API_URL=https://api.coze.cn/open_api/v2/chat
COZE_API_KEY=your_api_key_here
COZE_API_TYPE=chat
COZE_BOT_ID=your_bot_id_here
COZE_USER_ID=pathfinder-user
```

## 4. 启动命令

Railway 会读取 `Procfile`：

```bash
web: gunicorn app:app
```

如果你手动填写启动命令，也可以直接写：

```bash
gunicorn app:app
```

## 5. 注意事项

- 不要把 `.env` 上传到 GitHub
- 上传前确认 `uploads/` 已被 `.gitignore` 忽略
- 如果后续需要持久化上传文件，建议改为对象存储

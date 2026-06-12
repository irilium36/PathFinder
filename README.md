# AI 知识树生成器

一个基于 Flask + Jinja2 + vis.js 的知识图谱生成器，支持 PDF / PPT 上传、Coze 接口调用、节点知识详情展示与 LocalStorage 保存。

## 本地运行

```bash
pip install -r requirements.txt
python app.py
```

## 环境变量

请在项目根目录创建 `.env`：

```env
COZE_API_URL=https://api.coze.cn/open_api/v2/chat
COZE_API_KEY=your_api_key_here
COZE_API_TYPE=chat
COZE_BOT_ID=your_bot_id_here
COZE_USER_ID=pathfinder-user
```

## 部署到云平台

### Render

1. 将项目上传到 GitHub
2. 在 Render 创建 Web Service
3. 选择仓库后，Render 会自动读取 `render.yaml`
4. 在 Render 控制台配置环境变量
5. 部署完成后即可在线访问

### 其他平台

如果平台支持 Python Web 服务，使用以下命令即可：

- Build：`pip install -r requirements.txt`
- Start：`gunicorn app:app`

## 功能

- PDF / PPT / PPTX 文本提取
- Coze 智能体生成图谱
- vis.js 可视化网络图
- 节点详情与完整知识内容
- LocalStorage 保存历史

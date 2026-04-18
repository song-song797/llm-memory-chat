# LLM + 永久记忆 Chat

基于 LLM + 永久记忆模块的 Chat API 和 Web UI。

## 快速开始

### 后端

```bash
cd backend
pip install -r requirements.txt
cp .env.example .env
# 编辑 .env 填入你的 API Key
uvicorn app.main:app --reload --port 8000
```

### 前端

```bash
cd frontend
npm install
npm run dev
```

访问 http://localhost:5173 即可使用。

## 项目结构

```
├── backend/
│   ├── app/
│   │   ├── main.py              # FastAPI 入口
│   │   ├── config.py            # 配置管理
│   │   ├── database.py          # 数据库连接
│   │   ├── models.py            # 数据模型
│   │   ├── schemas.py           # API 模型
│   │   ├── routers/             # API 路由
│   │   └── services/            # 业务逻辑
│   └── requirements.txt
├── frontend/                     # React + Vite + TypeScript
└── README.md
```

## API 文档

启动后端后访问 http://localhost:8000/docs 查看自动生成的 API 文档。

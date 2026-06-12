from __future__ import annotations

import json
import os
from pathlib import Path
from typing import Any

import re

import pdfplumber
import pptx
import requests
from flask import Flask, jsonify, render_template, request
from dotenv import load_dotenv
load_dotenv()

BASE_DIR = Path(__file__).resolve().parent
UPLOAD_DIR = BASE_DIR / 'uploads'
UPLOAD_DIR.mkdir(exist_ok=True)

app = Flask(__name__)
app.config['MAX_CONTENT_LENGTH'] = 20 * 1024 * 1024


def extract_json_from_content(content: str) -> dict[str, Any]:
    """从 Bot 回复内容中提取 JSON 数据"""
    # 尝试提取 markdown 代码块中的 JSON
    json_block_pattern = r'```(?:json)?\s*([\s\S]*?)\s*```'
    matches = re.findall(json_block_pattern, content)

    for match in matches:
        try:
            data = json.loads(match.strip())
            if isinstance(data, dict):
                return data
        except json.JSONDecodeError:
            continue

    # 尝试直接解析整个内容为 JSON
    try:
        data = json.loads(content.strip())
        if isinstance(data, dict):
            return data
    except json.JSONDecodeError:
        pass

    # 尝试查找 JSON 对象（以 { 开头，以 } 结尾）
    json_obj_pattern = r'\{[\s\S]*\}'
    match = re.search(json_obj_pattern, content)
    if match:
        try:
            data = json.loads(match.group())
            if isinstance(data, dict):
                return data
        except json.JSONDecodeError:
            pass

    raise Exception(f'无法从 Bot 回复中解析 JSON 数据，回复内容: {content[:200]}...')


def extract_pdf_text(file_path: Path) -> str:
    text_parts: list[str] = []
    with pdfplumber.open(str(file_path)) as pdf:
        for page in pdf.pages:
            text = page.extract_text() or ''
            if text.strip():
                text_parts.append(text.strip())
    return '\n\n'.join(text_parts)


def extract_ppt_text(file_path: Path) -> str:
    """从 PowerPoint 文件中提取所有文本内容"""
    text_parts: list[str] = []
    prs = pptx.Presentation(str(file_path))
    for i, slide in enumerate(prs.slides, 1):
        slide_texts: list[str] = []
        for shape in slide.shapes:
            if hasattr(shape, "text") and shape.text.strip():
                slide_texts.append(shape.text.strip())
        if slide_texts:
            text_parts.append(f"--- 第{i}页 ---\n" + "\n".join(slide_texts))
    return '\n\n'.join(text_parts) if text_parts else ''


def call_ai_api(text: str) -> dict[str, Any]:
    api_url = os.getenv('COZE_API_URL', os.getenv('AI_API_URL', '')).strip()
    api_key = os.getenv('COZE_API_KEY', os.getenv('AI_API_KEY', '')).strip()
    api_type = os.getenv('COZE_API_TYPE', 'chat').strip().lower()
    bot_id = os.getenv('COZE_BOT_ID', '').strip() or os.getenv('AI_BOT_ID', '').strip()
    workflow_id = os.getenv('COZE_WORKFLOW_ID', '').strip() or os.getenv('AI_WORKFLOW_ID', '').strip()
    user_id = os.getenv('COZE_USER_ID', 'pathfinder-user').strip()

    def demo_data(summary: str) -> dict[str, Any]:
        return {
            'topic': '软件需求分析',
            'nodes': [
                {'id': 'n1', 'label': '需求获取', 'group': 'core'},
                {'id': 'n2', 'label': '需求建模', 'group': 'core'},
                {'id': 'n3', 'label': '需求验证', 'group': 'recommended'},
                {'id': 'n4', 'label': '需求规格说明书', 'group': 'mastered'},
            ],
            'edges': [
                {'from': 'n1', 'to': 'n2'},
                {'from': 'n2', 'to': 'n3'},
                {'from': 'n3', 'to': 'n4'},
            ],
            'summary': summary,
        }

    if not api_url:
        return demo_data(f'演示模式：未配置 COZE_API_URL，使用内置示例。文本长度 {len(text)}。')
    if not api_key:
        return {'topic': '配置错误', 'summary': '缺少 COZE_API_KEY，请检查 .env 或系统环境变量。', 'nodes': [], 'edges': []}

    headers = {'Authorization': f'Bearer {api_key}', 'Content-Type': 'application/json', 'Accept': 'application/json'}

    def post_json(payload: dict[str, Any]) -> dict[str, Any]:
        response = requests.post(api_url, json=payload, headers=headers, timeout=(10, 120))
        raw_text = response.text
        response.raise_for_status()
        result = response.json()
        if result.get('code') != 0:
            raise Exception(f"Coze API 业务错误: {result.get('msg', '未知错误')}")
        return {'result': result, 'raw_text': raw_text}

    try:
        def parse_graph_payload(payload_result: dict[str, Any], raw_text: str) -> dict[str, Any] | None:
            candidates: list[Any] = []
            data = payload_result.get('data')

            # 1) 优先解析 data
            candidates.append(data)
            # 2) 再解析整个返回体本身
            candidates.append(payload_result)
            # 3) 明确补充顶层常见字段
            for key in ('messages', 'answer', 'output', 'content', 'text', 'result'):
                value = payload_result.get(key)
                if value is not None:
                    candidates.append(value)
            # 4) 如果 data 也是字典，再继续往里找一层
            if isinstance(data, dict):
                for key in ('messages', 'answer', 'output', 'content', 'text', 'result'):
                    value = data.get(key)
                    if value is not None:
                        candidates.append(value)

            for candidate in candidates:
                if isinstance(candidate, dict):
                    # 兼容 {messages:[{role:'assistant', content:'...'}]} 这种形态
                    messages = candidate.get('messages')
                    if isinstance(messages, list):
                        for msg in messages:
                            if not isinstance(msg, dict):
                                continue
                            if msg.get('role') == 'assistant' and msg.get('content'):
                                try:
                                    return extract_json_from_content(str(msg.get('content')))
                                except Exception:
                                    pass

                    # 兼容扁平字段 answer/output/content/text/result
                    for key in ('answer', 'output', 'content', 'text', 'result'):
                        value = candidate.get(key)
                        if isinstance(value, str) and value.strip():
                            try:
                                return extract_json_from_content(value)
                            except Exception:
                                pass

                elif isinstance(candidate, str) and candidate.strip():
                    try:
                        return extract_json_from_content(candidate)
                    except Exception:
                        pass

            # 最后直接从原始响应里抠 JSON
            try:
                return extract_json_from_content(raw_text)
            except Exception:
                return None

        if api_type == 'workflow':
            if not workflow_id:
                return {'topic': '配置错误', 'summary': 'COZE_API_TYPE=workflow 时必须配置 COZE_WORKFLOW_ID。', 'nodes': [], 'edges': []}
            payload = {'workflow_id': workflow_id, 'parameters': {'input': text}}
            outcome = post_json(payload)
            graph_data = parse_graph_payload(outcome['result'], outcome['raw_text'])
            if graph_data is None:
                raise Exception(f'Coze 工作流返回内容无法解析为图谱 JSON，原始响应：{outcome["raw_text"][:800]}')
        else:
            if not bot_id:
                return {'topic': '配置错误', 'summary': 'COZE_API_TYPE=chat 时必须配置 COZE_BOT_ID。', 'nodes': [], 'edges': []}
            chat_payloads = [
                {'bot_id': bot_id, 'user': user_id, 'stream': False, 'auto_save_history': True, 'query': text},
                {'bot_id': bot_id, 'user_id': user_id, 'stream': False, 'auto_save_history': True, 'query': text},
                {'bot_id': bot_id, 'user': user_id, 'stream': False, 'query': text},
                {'bot_id': bot_id, 'user_id': user_id, 'stream': False, 'query': text},
                {'bot_id': bot_id, 'user': user_id, 'stream': False, 'auto_save_history': True, 'additional_messages': [{'role': 'user', 'content': text, 'content_type': 'text'}]},
                {'bot_id': bot_id, 'user_id': user_id, 'stream': False, 'auto_save_history': True, 'additional_messages': [{'role': 'user', 'content': text, 'content_type': 'text'}]},
            ]
            graph_data = None
            last_error = None
            last_raw = ''
            for payload in chat_payloads:
                try:
                    outcome = post_json(payload)
                    last_raw = outcome['raw_text']
                    graph_data = parse_graph_payload(outcome['result'], last_raw)
                    if graph_data is not None:
                        break
                except Exception as exc:
                    last_error = exc
            if graph_data is None:
                raise Exception(f'Coze API 业务错误: {last_error}')

        if graph_data is None:
            raise Exception('Coze 返回内容无法解析为图谱 JSON')

        required_keys = {'topic', 'nodes', 'edges', 'summary'}
        if not required_keys.issubset(graph_data.keys()):
            raise Exception('Coze 返回的 JSON 缺少必要字段 (topic/nodes/edges/summary)')
        return graph_data

    except Exception as e:
        return demo_data(f'调用 Coze API 时出错：{str(e)}。请检查环境变量和网络。')

@app.get('/')
def index():
    return render_template('index.html')


@app.post('/api/extract')
def extract():
    uploaded = request.files.get('file')
    if not uploaded:
        return jsonify({'error': '未找到上传文件'}), 400

    save_path = UPLOAD_DIR / uploaded.filename
    uploaded.save(save_path)

    suffix = save_path.suffix.lower()
    if suffix == '.pdf':
        text = extract_pdf_text(save_path)
    elif suffix in ['.pptx', '.ppt']:
        text = extract_ppt_text(save_path)
    else:
        return jsonify({'error': '仅支持 PDF 和 PPT 文件（.pdf, .pptx, .ppt）'}), 400

    return jsonify({'text': text, 'filename': uploaded.filename})


@app.post('/api/generate')
def generate():
    data = request.get_json(silent=True) or {}
    text = str(data.get('text', '')).strip()
    if not text:
        return jsonify({'error': '缺少文本内容'}), 400

    result = call_ai_api(text)
    return jsonify(result)


if __name__ == '__main__':
    app.run(debug=True)

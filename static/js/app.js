const state = {
  mode: 'path',
  data: null,
  network: null,
  selectedNode: null,
};

const NODE_CONTENT_LIBRARY = {
  '需求获取': '需求获取是通过访谈、问卷、观察、原型等方式从干系人那里收集对系统的期望与约束。\n\n要点：\n1. 明确干系人是谁。\n2. 区分业务目标与功能需求。\n3. 记录来源、优先级和冲突。',
  '需求建模': '需求建模用于把自然语言需求转成更清晰的结构表达，常见方法包括用例图、场景图、活动图和数据流图。\n\n要点：\n1. 识别参与者与系统边界。\n2. 划分主流程、备选流程和异常流程。\n3. 保证模型与需求原文可追溯。',
  '需求验证': '需求验证关注“写下来的需求是不是对的”。常见方式包括正式评审、原型确认、测试用例推导和一致性检查。\n\n要点：\n1. 检查正确性、一致性、完整性、可行性。\n2. 尽量让用户提前确认。\n3. 发现问题后及时回到前面阶段修订。',
  '规格说明书': '需求规格说明书（SRS）是需求阶段的正式产物，通常应包含引言、总体描述、具体需求、接口需求、约束与附录等内容。\n\n要点：\n1. 语言清晰、无歧义。\n2. 每条需求可编号、可追踪。\n3. 便于评审、验证和后续开发。',
};

const defaultData = {
  topic: '软件需求分析',
  summary: '演示模式：可直接在浏览器中构建图谱，并将学习状态保存到本地。',
  nodes: [
    { id: 'n1', label: '需求获取', group: 'core', title: '访谈、问卷、观察' },
    { id: 'n2', label: '需求建模', group: 'core', title: '用例图、场景图' },
    { id: 'n3', label: '需求验证', group: 'recommended', title: '评审、原型、测试' },
    { id: 'n4', label: '规格说明书', group: 'mastered', title: '结构化文档输出' },
  ],
  edges: [
    { from: 'n1', to: 'n2' },
    { from: 'n2', to: 'n3' },
    { from: 'n3', to: 'n4' },
  ],
};

function getSavedGraphs() {
  try {
    return JSON.parse(localStorage.getItem('knowledgeGraphs') || '[]');
  } catch {
    return [];
  }
}

function saveCurrentGraph() {
  if (!state.data) return;
  const saved = getSavedGraphs();
  saved.unshift({
    topic: state.data.topic,
    savedAt: new Date().toISOString(),
    nodeCount: state.data.nodes.length,
  });
  localStorage.setItem('knowledgeGraphs', JSON.stringify(saved.slice(0, 20)));
  updateSavedCount();
}

function updateSavedCount() {
  document.getElementById('savedCount').textContent = String(getSavedGraphs().length);
}

function setSummary(text) {
  document.getElementById('summary').textContent = text;
}

function updateStats(data) {
  document.getElementById('nodeCount').textContent = String(data.nodes.length);
  document.getElementById('edgeCount').textContent = String(data.edges.length);
}

function updateDetails(node) {
  state.selectedNode = node || null;
  document.getElementById('detailName').textContent = node?.label || '未选择节点';
  document.getElementById('detailText').textContent = node?.title || '点击左侧图谱中的节点查看内容。';
  const tags = document.getElementById('detailTags');
  tags.innerHTML = '';
  if (!node) return;
  ['高频考点', node.group, state.mode === 'path' ? '推荐学习' : '知识节点'].forEach((tag) => {
    const span = document.createElement('span');
    span.textContent = tag;
    tags.appendChild(span);
  });
  renderFullContent(node);
}

function renderFullContent(node) {
  const title = document.getElementById('fullContentTitle');
  const body = document.getElementById('fullContentBody');
  title.textContent = node?.label || '请选择一个节点';
  const content = node?.content || NODE_CONTENT_LIBRARY[node?.label] || '';
  body.textContent = content || '该节点没有完整内容。';
}

function renderNetwork(data) {
  const container = document.getElementById('network');
  const isLightTheme = document.documentElement.classList.contains('theme-light');
  const fontColor = isLightTheme ? '#0f172a' : '#e2e8f0';
  
  const nodes = data.nodes.map((node) => ({
    ...node,
    shape: 'dot',
    size: node.group === 'recommended' ? 28 : node.group === 'mastered' ? 22 : 20,
    color: {
      background: node.group === 'recommended' ? '#f59e0b' : node.group === 'mastered' ? '#10b981' : '#6366f1',
      border: isLightTheme ? '#cbd5e1' : '#e2e8f0',
      highlight: { background: '#38bdf8', border: isLightTheme ? '#0f172a' : '#ffffff' },
    },
    font: { color: fontColor, size: 18 },
  }));

  const edges = data.edges.map((edge) => ({
    ...edge,
    smooth: true,
    arrows: 'to',
    color: state.mode === 'path' ? { color: '#38bdf8', highlight: '#8b5cf6' } : { color: isLightTheme ? '#94a3b8' : '#64748b' },
  }));

  const visData = {
    nodes: new vis.DataSet(nodes),
    edges: new vis.DataSet(edges),
  };

  const options = {
    physics: { stabilization: false, barnesHut: { gravitationalConstant: -18000, springLength: 140 } },
    interaction: { hover: true, navigationButtons: true, keyboard: true },
    nodes: { borderWidth: 2, shadow: true },
    edges: { width: 2, shadow: true },
  };

  if (state.network) state.network.destroy();
  state.network = new vis.Network(container, visData, options);
  state.network.on('click', (params) => {
    if (!params.nodes.length) return;
    const node = data.nodes.find((n) => n.id === params.nodes[0]);
    updateDetails(node);
  });
}

async function generateGraph(text) {
  const response = await fetch('/api/generate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text }),
  });
  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.error || '生成图谱失败');
  }
  return response.json();
}

function applyTheme() {
  document.documentElement.classList.toggle('theme-light');
  if (state.data) renderNetwork(state.data);
}

function bindEvents() {
  document.getElementById('modeToggle').addEventListener('click', () => {
    state.mode = state.mode === 'path' ? 'map' : 'path';
    document.getElementById('modeToggle').textContent = state.mode === 'path' ? '学习路径模式' : '知识图谱模式';
    if (state.data) renderNetwork(state.data);
  });

  document.getElementById('themeToggle').addEventListener('click', applyTheme);

  document.getElementById('expandContentBtn').addEventListener('click', () => {
    if (state.selectedNode) {
      renderFullContent(state.selectedNode);
    }
  });

  document.getElementById('saveBtn').addEventListener('click', saveCurrentGraph);

  document.getElementById('clearStorageBtn').addEventListener('click', () => {
    localStorage.removeItem('knowledgeGraphs');
    updateSavedCount();
  });

  document.getElementById('uploadForm').addEventListener('submit', async (event) => {
    event.preventDefault();
    const file = document.getElementById('pdfFile').files[0];
    if (!file) return;
    const formData = new FormData();
    formData.append('file', file);
    document.getElementById('uploadStatus').textContent = '正在提取文本...';
    const response = await fetch('/api/extract', { method: 'POST', body: formData });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || '提取失败');
    document.getElementById('sourceText').value = result.text;
    document.getElementById('uploadStatus').textContent = `已提取：${result.filename}`;
  });

  document.getElementById('generateBtn').addEventListener('click', async () => {
    const text = document.getElementById('sourceText').value.trim();
    if (!text) return;
    setSummary('正在调用模型生成图谱...');
    try {
      const data = await generateGraph(text);
      state.data = data;
      updateStats(data);
      renderNetwork(data);
      setSummary(data.summary || '图谱已生成');
      updateDetails(data.nodes[0]);
    } catch (error) {
      setSummary(error.message);
    }
  });
}

window.addEventListener('DOMContentLoaded', () => {
  bindEvents();
  updateSavedCount();
  state.data = defaultData;
  updateStats(defaultData);
  renderNetwork(defaultData);
  setSummary(defaultData.summary);
  updateDetails(defaultData.nodes[0]);
});

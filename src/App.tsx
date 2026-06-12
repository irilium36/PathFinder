import { useMemo, useState } from 'react';

type Mode = 'map' | 'path';

type NodeStatus = 'mastered' | 'recommended' | 'locked' | 'normal';

type NodeItem = {
  id: string;
  label: string;
  note: string;
  x: number;
  y: number;
  status: NodeStatus;
};

const nodes: NodeItem[] = [
  { id: '1', label: '软件需求分析', note: '考试总目标', x: 48, y: 50, status: 'recommended' },
  { id: '2', label: '需求获取', note: '访谈 / 问卷 / 观察', x: 26, y: 30, status: 'normal' },
  { id: '3', label: '需求建模', note: '用例图 / 场景图', x: 72, y: 28, status: 'normal' },
  { id: '4', label: '需求规格说明书', note: '结构化文档', x: 18, y: 68, status: 'mastered' },
  { id: '5', label: '需求验证', note: '评审 / 原型 / 测试', x: 50, y: 72, status: 'recommended' },
  { id: '6', label: '需求变更控制', note: '版本与追踪', x: 82, y: 66, status: 'locked' },
  { id: '7', label: '验收标准', note: '可以拿分的关键点', x: 36, y: 46, status: 'recommended' },
];

const links = [
  ['1', '2'],
  ['1', '3'],
  ['2', '4'],
  ['3', '5'],
  ['5', '6'],
  ['7', '5'],
] as const;

const palette = {
  bg: '#0F172A',
  panel: 'rgba(15, 23, 42, 0.68)',
  accent: '#6366F1',
  cyan: '#22D3EE',
  amber: '#F59E0B',
  mastered: '#10B981',
  locked: '#475569',
};

export default function App() {
  const [mode, setMode] = useState<Mode>('path');
  const [query, setQuery] = useState('需求验证');
  const [selected, setSelected] = useState(nodes[4]);
  const [dark, setDark] = useState(true);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return nodes;
    return nodes.filter((n) => n.label.toLowerCase().includes(q) || n.note.toLowerCase().includes(q));
  }, [query]);

  return (
    <div className={dark ? 'app dark' : 'app light'} style={{ '--bg': palette.bg } as React.CSSProperties}>
      <div className="grid-overlay" />
      <header className="topbar">
        <div>
          <div className="brand">AI Knowledge Tree</div>
          <div className="subtitle">把零散知识变成可点击、可学习、可通关的技能树</div>
        </div>
        <div className="toolbar">
          <button className={mode === 'map' ? 'active' : ''} onClick={() => setMode('map')}>知识图谱浏览</button>
          <button className={mode === 'path' ? 'active' : ''} onClick={() => setMode('path')}>学习路径推荐</button>
          <button onClick={() => setDark((v) => !v)}>{dark ? '亮色' : '暗色'}模式</button>
        </div>
      </header>

      <main className="layout">
        <aside className="panel left">
          <section className="card upload">
            <h3>输入知识源</h3>
            <p>拖拽 PDF、粘贴课堂笔记，或输入“软件需求分析”这样的宽泛主题。</p>
            <div className="dropzone">拖拽文件 / 粘贴文本 / 输入主题</div>
          </section>
          <section className="card stats">
            <div><strong>124</strong><span>知识点</span></div>
            <div><strong>32</strong><span>推荐路径</span></div>
            <div><strong>8</strong><span>已掌握</span></div>
          </section>
          <section className="card legend">
            <h3>状态图例</h3>
            <ul>
              <li><span className="dot mastered" />已掌握</li>
              <li><span className="dot recommended" />当前推荐</li>
              <li><span className="dot locked" />前置锁定</li>
            </ul>
          </section>
        </aside>

        <section className="canvas-shell">
          <div className="canvas-header">
            <div>
              <h2>{mode === 'map' ? '知识图谱画布' : '学习路径高亮图'}</h2>
              <p>可拖拽缩放、节点展开、搜索高亮、导出 PNG / SVG 的全屏画布原型。</p>
            </div>
            <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="搜索知识点" />
          </div>

          <div className="graph-stage">
            <svg viewBox="0 0 100 100" className="graph-svg" aria-label="knowledge graph">
              <defs>
                <linearGradient id="pathGrad" x1="0%" x2="100%" y1="0%" y2="0%">
                  <stop offset="0%" stopColor={palette.cyan} />
                  <stop offset="100%" stopColor={palette.accent} />
                </linearGradient>
                <filter id="glow">
                  <feGaussianBlur stdDeviation="1.5" result="coloredBlur" />
                  <feMerge>
                    <feMergeNode in="coloredBlur" />
                    <feMergeNode in="SourceGraphic" />
                  </feMerge>
                </filter>
              </defs>

              {links.map(([a, b]) => {
                const from = nodes.find((n) => n.id === a)!;
                const to = nodes.find((n) => n.id === b)!;
                const active = mode === 'path' && (from.status === 'recommended' || to.status === 'recommended');
                return (
                  <line
                    key={`${a}-${b}`}
                    x1={from.x}
                    y1={from.y}
                    x2={to.x}
                    y2={to.y}
                    className={active ? 'link active' : 'link'}
                  />
                );
              })}

              {filtered.map((node) => {
                const isSelected = selected.id === node.id;
                return (
                  <g key={node.id} onClick={() => setSelected(node)} className="node-group">
                    <circle
                      cx={node.x}
                      cy={node.y}
                      r={isSelected ? 4.5 : 3.4}
                      className={`node ${node.status} ${isSelected ? 'selected' : ''}`}
                      filter={node.status === 'recommended' ? 'url(#glow)' : undefined}
                    />
                    <text x={node.x} y={node.y + 7} textAnchor="middle" className="node-label">{node.label}</text>
                  </g>
                );
              })}
            </svg>

            <div className="floating-badge">学习路径会在这里以流光动画串联技能点</div>
          </div>
        </section>

        <aside className="panel right">
          <section className="card detail">
            <h3>节点详情</h3>
            <div className="detail-name">{selected.label}</div>
            <p>{selected.note}</p>
            <div className="chip-row">
              <span>推荐理由</span>
              <span>考试高频</span>
              <span>前置关键</span>
            </div>
            <button className="primary">标记已学会</button>
          </section>
          <section className="card pathlist">
            <h3>下一步建议</h3>
            {nodes.slice(0, 4).map((n, i) => (
              <div key={n.id} className={`path-item ${n.status}`}>
                <span className="index">0{i + 1}</span>
                <div>
                  <strong>{n.label}</strong>
                  <p>{n.note}</p>
                </div>
              </div>
            ))}
          </section>
        </aside>
      </main>
    </div>
  );
}
import { useEffect, useMemo, useState } from 'react';
import * as XLSX from 'xlsx';

const SHEET_ICONS = {
  '📑 Índice': '📑',
  '⚙️ Parâmetros': '⚙️',
  '📋 Catálogo': '📋',
  '🎨 Filamento': '🎨',
  '🧾 Romaneio': '🧾',
  '📦 Pedidos': '📦',
  '🖨️ Produção': '🖨️',
  '📦 Est. Peças': '📦',
  '🔧 Manutenção': '🔧',
  '🏪 Consignados': '🏪',
  '📊 Relatório': '📊',
  '💳 Lançamentos': '💳',
  '📅 Proj. Mensal': '📅',
  '📊 Resumo Parcelas': '📊',
};

const DASHBOARD_SHEETS = ['📋 Catálogo', '📦 Est. Peças', '💳 Lançamentos', '📊 Relatório'];

function trimSheet(rows) {
  if (!rows?.length) return [];
  let last = rows.length - 1;
  while (last >= 0 && rows[last].every((c) => c === '' || c == null)) last--;
  if (last < 0) return [];
  let maxCol = 0;
  for (let r = 0; r <= last; r++) {
    for (let c = rows[r].length - 1; c >= 0; c--) {
      if (rows[r][c] !== '' && rows[r][c] != null) {
        maxCol = Math.max(maxCol, c);
        break;
      }
    }
  }
  return rows.slice(0, last + 1).map((row) => {
    const out = row.slice(0, maxCol + 1);
    while (out.length <= maxCol) out.push('');
    return out;
  });
}

function formatCell(value) {
  if (value == null || value === '') return '';
  if (value instanceof Date) {
    return value.toLocaleDateString('pt-BR');
  }
  if (typeof value === 'number') {
    if (Number.isInteger(value)) return String(value);
    return value.toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
  }
  return String(value);
}

function findHeaderRow(rows) {
  let best = 0;
  let bestScore = 0;
  for (let i = 0; i < Math.min(rows.length, 12); i++) {
    const score = rows[i].filter((c) => c !== '' && c != null && !String(c).startsWith('=')).length;
    if (score > bestScore) {
      bestScore = score;
      best = i;
    }
  }
  return bestScore >= 3 ? best : -1;
}

function buildStats(sheets) {
  const cat = sheets['📋 Catálogo'] || [];
  const est = sheets['📦 Est. Peças'] || [];
  const lanc = sheets['💳 Lançamentos'] || [];

  const produtos = cat.filter((r) => r[1] && r[1] !== 'Nome do Produto').length;
  const estoqueTotal = est.reduce((sum, r) => {
    const q = Number(r[3]);
    return sum + (Number.isFinite(q) ? q : 0);
  }, 0);
  const lancamentos = lanc.filter((r) => r[3] && r[3] !== 'Descrição').length;

  return { produtos, estoqueTotal, lancamentos };
}

export default function App() {
  const [workbook, setWorkbook] = useState(null);
  const [sheetNames, setSheetNames] = useState([]);
  const [active, setActive] = useState('📑 Índice');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [view, setView] = useState('dashboard');

  useEffect(() => {
    fetch(`${import.meta.env.BASE_URL}taldo_gestao_v7.3.xlsx`)
      .then((r) => {
        if (!r.ok) throw new Error('Planilha não encontrada');
        return r.arrayBuffer();
      })
      .then((buf) => {
        const wb = XLSX.read(buf, { type: 'array', cellDates: true });
        setWorkbook(wb);
        setSheetNames(wb.SheetNames);
        setActive(wb.SheetNames.includes('📑 Índice') ? '📑 Índice' : wb.SheetNames[0]);
        setLoading(false);
      })
      .catch((e) => {
        setError(e.message);
        setLoading(false);
      });
  }, []);

  const sheets = useMemo(() => {
    if (!workbook) return {};
    const out = {};
    for (const name of workbook.SheetNames) {
      const raw = XLSX.utils.sheet_to_json(workbook.Sheets[name], { header: 1, defval: '' });
      out[name] = trimSheet(raw);
    }
    return out;
  }, [workbook]);

  const stats = useMemo(() => buildStats(sheets), [sheets]);

  const rows = sheets[active] || [];
  const headerIdx = findHeaderRow(rows);
  const headers = headerIdx >= 0 ? rows[headerIdx].map(formatCell) : [];
  const dataRows = headerIdx >= 0 ? rows.slice(headerIdx + 1) : rows;

  const filtered = useMemo(() => {
    if (!search.trim()) return dataRows;
    const q = search.toLowerCase();
    return dataRows.filter((row) => row.some((c) => formatCell(c).toLowerCase().includes(q)));
  }, [dataRows, search]);

  if (loading) {
    return (
      <div className="loading">
        <div className="spinner" />
        <p>Carregando planilha…</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="loading">
        <p className="error">Erro: {error}</p>
      </div>
    );
  }

  return (
    <div className="app">
      <aside className="sidebar">
        <div className="brand">
          <span className="brand-icon">🖨️</span>
          <div>
            <strong>Taldo Studio 3D</strong>
            <small>Gestão v7.3</small>
          </div>
        </div>

        <button
          className={`nav-item ${view === 'dashboard' ? 'active' : ''}`}
          onClick={() => setView('dashboard')}
        >
          🏠 Painel
        </button>

        <p className="nav-label">Abas da planilha</p>
        {sheetNames.map((name) => (
          <button
            key={name}
            className={`nav-item ${view === 'sheet' && active === name ? 'active' : ''}`}
            onClick={() => { setActive(name); setView('sheet'); setSearch(''); }}
          >
            {SHEET_ICONS[name] || '📄'} {name.replace(/^[^\s]+\s/, '')}
          </button>
        ))}
      </aside>

      <main className="main">
        <header className="topbar">
          <div>
            <h1>{view === 'dashboard' ? 'Painel' : active}</h1>
            <p>Visualização da planilha — somente leitura</p>
          </div>
          {view === 'sheet' && (
            <input
              className="search"
              placeholder="Buscar nesta aba…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          )}
        </header>

        {view === 'dashboard' ? (
          <div className="dashboard">
            <div className="cards">
              <div className="card">
                <span className="card-num">{stats.produtos}</span>
                <span className="card-label">Produtos no catálogo</span>
              </div>
              <div className="card">
                <span className="card-num">{stats.estoqueTotal}</span>
                <span className="card-label">Peças em estoque</span>
              </div>
              <div className="card">
                <span className="card-num">{stats.lancamentos}</span>
                <span className="card-label">Lançamentos financeiros</span>
              </div>
              <div className="card">
                <span className="card-num">{sheetNames.length}</span>
                <span className="card-label">Abas na planilha</span>
              </div>
            </div>

            <section className="panel">
              <h2>📦 Estoque de Peças</h2>
              <div className="mini-table-wrap">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Produto</th>
                      <th>Categoria</th>
                      <th>Qtd</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(sheets['📦 Est. Peças'] || [])
                      .filter((r) => r[1] && r[1] !== 'Produto')
                      .slice(0, 15)
                      .map((r, i) => (
                        <tr key={i}>
                          <td>{formatCell(r[1])}</td>
                          <td>{formatCell(r[2])}</td>
                          <td className="num">{formatCell(r[3])}</td>
                        </tr>
                      ))}
                  </tbody>
                </table>
                {(sheets['📦 Est. Peças'] || []).filter((r) => r[1] && r[1] !== 'Produto').length > 15 && (
                  <p className="more">+ {(sheets['📦 Est. Peças'] || []).filter((r) => r[1]).length - 15} produtos — veja aba Est. Peças</p>
                )}
              </div>
            </section>

            <section className="panel">
              <h2>📋 Catálogo (últimos cadastros)</h2>
              <div className="mini-table-wrap">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Produto</th>
                      <th>Categoria</th>
                      <th>Cor</th>
                      <th>Horas</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(sheets['📋 Catálogo'] || [])
                      .filter((r) => r[1] && r[1] !== 'Nome do Produto')
                      .slice(-10)
                      .reverse()
                      .map((r, i) => (
                        <tr key={i}>
                          <td>{formatCell(r[1])}</td>
                          <td>{formatCell(r[2])}</td>
                          <td>{formatCell(r[3])}</td>
                          <td className="num">{formatCell(r[10])}</td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            </section>

            <section className="panel index-panel">
              <h2>📑 Índice — Regras</h2>
              <ul>
                {(sheets['📑 Índice'] || [])
                  .flat()
                  .filter((c) => c && String(c).includes('💡') || String(c).includes('💳') || String(c).includes('🧾'))
                  .map((c, i) => <li key={i}>{formatCell(c)}</li>)}
              </ul>
            </section>
          </div>
        ) : (
          <div className="sheet-view">
            <div className="sheet-meta">
              <span>{filtered.length} linhas</span>
              {search && <span> · filtrado de {dataRows.length}</span>}
            </div>
            <div className="table-wrap">
              <table className="data-table sheet-table">
                {headers.length > 0 && (
                  <thead>
                    <tr>
                      {headers.map((h, i) => (
                        <th key={i}>{h || `Col ${i + 1}`}</th>
                      ))}
                    </tr>
                  </thead>
                )}
                <tbody>
                  {filtered.length === 0 ? (
                    <tr><td colSpan={Math.max(headers.length, 1)} className="empty">Nenhum dado encontrado</td></tr>
                  ) : (
                    filtered.map((row, ri) => (
                      <tr key={ri}>
                        {(headers.length ? headers : row).map((_, ci) => (
                          <td key={ci} className={typeof row[ci] === 'number' ? 'num' : ''}>
                            {formatCell(row[ci])}
                          </td>
                        ))}
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

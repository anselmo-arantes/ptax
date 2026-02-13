const form = document.querySelector('#ptax-form');
const dateInput = document.querySelector('#date');
const resultBox = document.querySelector('#result');
const submitBtn = document.querySelector('#submit-btn');

const API_BASE = 'https://olinda.bcb.gov.br/olinda/servico/PTAX/versao/v1/odata';
const MAX_LOOKBACK_DAYS = 7;

dateInput.value = new Date().toISOString().slice(0, 10);

function formatBcbDate(isoDate) {
  const [year, month, day] = isoDate.split('-');
  return `${month}-${day}-${year}`;
}

function subtractDays(isoDate, days) {
  const d = new Date(`${isoDate}T12:00:00.000Z`);
  d.setUTCDate(d.getUTCDate() - days);
  return d.toISOString().slice(0, 10);
}

function buildUrl(isoDate) {
  const bcbDate = formatBcbDate(isoDate);
  return `${API_BASE}/CotacaoDolarDia(dataCotacao='${bcbDate}')?$format=json`;
}

async function fetchPtaxFromBcb(requestedDate) {
  const attempts = [];

  for (let i = 0; i <= MAX_LOOKBACK_DAYS; i += 1) {
    const dateToTry = subtractDays(requestedDate, i);
    const url = buildUrl(dateToTry);

    const response = await fetch(url, {
      method: 'GET',
      headers: { Accept: 'application/json' }
    });

    if (!response.ok) {
      attempts.push({ date: dateToTry, kind: 'http_error', status: response.status });
      return {
        ok: false,
        source: 'fallback',
        requestedDate,
        attempts,
        message: 'API do BCB indisponível no momento.',
        upstreamStatus: response.status,
        ptax: null
      };
    }

    const payload = await response.json();
    const rows = payload?.value ?? [];
    const last = rows.at(-1) ?? null;

    if (last) {
      attempts.push({ date: dateToTry, kind: 'success', status: response.status });
      return {
        ok: true,
        source: 'bcb',
        requestedDate,
        usedDate: dateToTry,
        attempts,
        upstreamStatus: response.status,
        ptax: last
      };
    }

    attempts.push({ date: dateToTry, kind: 'empty', status: response.status });
  }

  return {
    ok: false,
    source: 'fallback',
    requestedDate,
    attempts,
    message: 'Sem cotação disponível no período consultado.',
    ptax: null
  };
}

function fmtCurrency(value) {
  if (typeof value !== 'number') return '-';
  return value.toLocaleString('pt-BR', { minimumFractionDigits: 4, maximumFractionDigits: 4 });
}

function renderSuccess(data) {
  const compra = fmtCurrency(data.ptax?.cotacaoCompra);
  const venda = fmtCurrency(data.ptax?.cotacaoVenda);
  const horario = data.ptax?.dataHoraCotacao ?? '-';

  resultBox.innerHTML = `
    <h2>Resultado da PTAX</h2>
    <div class="result-grid">
      <article class="kpi"><div class="label">Data solicitada</div><div class="value">${data.requestedDate}</div></article>
      <article class="kpi"><div class="label">Data utilizada</div><div class="value">${data.usedDate}</div></article>
      <article class="kpi"><div class="label">Cotação compra</div><div class="value">R$ ${compra}</div></article>
      <article class="kpi"><div class="label">Cotação venda</div><div class="value">R$ ${venda}</div></article>
      <article class="kpi"><div class="label">Última atualização</div><div class="value">${horario}</div></article>
    </div>
  `;
}

function renderFallback(data) {
  resultBox.innerHTML = `
    <h2>Não foi possível obter a cotação</h2>
    <p class="fallback-note">${data.message ?? 'Erro inesperado ao consultar PTAX.'}</p>
    <pre>${JSON.stringify(data, null, 2)}</pre>
  `;
}

function renderResult(data) {
  resultBox.classList.remove('hidden');
  resultBox.classList.toggle('error', !data.ok);
  if (data.ok) renderSuccess(data);
  else renderFallback(data);
}

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  submitBtn.disabled = true;
  submitBtn.textContent = 'Consultando...';
  resultBox.classList.remove('hidden');
  resultBox.classList.remove('error');
  resultBox.innerHTML = '<p>Buscando dados na API PTAX do BCB...</p>';

  try {
    const data = await fetchPtaxFromBcb(dateInput.value);
    renderResult(data);
  } catch (error) {
    renderFallback({ ok: false, message: `Falha de rede/CORS: ${error.message}` });
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = 'Buscar PTAX';
  }
});

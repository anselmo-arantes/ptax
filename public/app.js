const form = document.querySelector('#ptax-form');
const dateInput = document.querySelector('#date');
const brlValueInput = document.querySelector('#brl-value');
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

async function fetchQuoteForOrBefore(targetDate) {
  const attempts = [];

  for (let i = 0; i <= MAX_LOOKBACK_DAYS; i += 1) {
    const dateToTry = subtractDays(targetDate, i);
    const response = await fetch(buildUrl(dateToTry), {
      method: 'GET',
      headers: { Accept: 'application/json' }
    });

    if (!response.ok) {
      attempts.push({ date: dateToTry, kind: 'http_error', status: response.status });
      return {
        ok: false,
        attempts,
        message: 'API do BCB indisponível no momento.',
        upstreamStatus: response.status,
        quote: null
      };
    }

    const payload = await response.json();
    const rows = payload?.value ?? [];
    const quote = rows.at(-1) ?? null;

    if (quote) {
      attempts.push({ date: dateToTry, kind: 'success', status: response.status });
      return {
        ok: true,
        attempts,
        quoteDate: dateToTry,
        upstreamStatus: response.status,
        quote
      };
    }

    attempts.push({ date: dateToTry, kind: 'empty', status: response.status });
  }

  return {
    ok: false,
    attempts,
    message: 'Sem cotação disponível no período consultado.',
    quote: null
  };
}

function fmtNumber(value, digits = 4) {
  if (typeof value !== 'number' || Number.isNaN(value)) return '-';
  return value.toLocaleString('pt-BR', {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits
  });
}

function fmtMoney(value) {
  if (typeof value !== 'number' || Number.isNaN(value)) return '-';
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function fmtDate(isoDate) {
  if (!isoDate || typeof isoDate !== 'string') return '-';
  const parts = isoDate.split('-');
  if (parts.length !== 3) return isoDate;
  const [year, month, day] = parts;
  return `${day}-${month}-${year}`;
}

function renderFallback(data) {
  resultBox.innerHTML = `
    <h2>Não foi possível obter a cotação</h2>
    <p class="fallback-note">${data.message ?? 'Erro inesperado ao consultar PTAX.'}</p>
    <pre>${JSON.stringify(data, null, 2)}</pre>
  `;
}

function renderSuccess(data) {
  resultBox.innerHTML = `
    <h2>Resultado da PTAX + spread</h2>
    <div class="result-grid">
      <article class="kpi"><div class="label">Valor informado</div><div class="value">${fmtMoney(data.valorEmReais)}</div></article>
      <article class="kpi"><div class="label">Data solicitada</div><div class="value">${fmtDate(data.requestedDate)}</div></article>
      <article class="kpi"><div class="label">Data base usada</div><div class="value">${fmtDate(data.baseDate)}</div></article>
      <article class="kpi"><div class="label">Regra aplicada</div><div class="value">${data.ruleLabel}</div></article>
      <article class="kpi"><div class="label">PTAX base (venda)</div><div class="value">R$ ${fmtNumber(data.basePtax)}</div></article>
      <article class="kpi"><div class="label">Spread</div><div class="value">${fmtNumber(data.spreadPct * 100, 2)}%</div></article>
      <article class="kpi"><div class="label">Cotação final com spread</div><div class="value">R$ ${fmtNumber(data.finalRate)}</div></article>
      <article class="kpi"><div class="label">USD estimado (opcional)</div><div class="value">US$ ${fmtNumber(data.estimatedUsd, 2)}</div></article>
    </div>
  `;
}

async function calculateSpreadFlow(requestedDate, valorEmReais) {
  const todayQuote = await fetchQuoteForOrBefore(requestedDate);
  if (!todayQuote.ok) {
    return {
      ok: false,
      message: 'Falha ao buscar a PTAX do dia selecionado.',
      details: todayQuote
    };
  }

  const previousStartDate = subtractDays(requestedDate, 1);
  const previousQuote = await fetchQuoteForOrBefore(previousStartDate);
  if (!previousQuote.ok) {
    return {
      ok: false,
      message: 'Falha ao buscar a PTAX do dia anterior.',
      details: previousQuote
    };
  }

  let base;
  let spreadPct;
  let ruleLabel;

  if (valorEmReais < 90) {
    base = previousQuote;
    spreadPct = 0.07;
    ruleLabel = 'Valor < R$90,00: dia anterior + 7%';
  } else if (valorEmReais > 90) {
    base = previousQuote;
    spreadPct = 0.06;
    ruleLabel = 'Valor > R$90,00: dia anterior + 6%';
  } else {
    base = todayQuote;
    spreadPct = 0.06;
    ruleLabel = 'Valor = R$90,00: dia selecionado + 6%';
  }

  const basePtax = Number(base.quote?.cotacaoVenda);

  if (!Number.isFinite(basePtax) || basePtax <= 0) {
    return {
      ok: false,
      message: 'Cotação PTAX inválida retornada pela API.',
      details: { todayQuote, previousQuote }
    };
  }

  const finalRate = basePtax * (1 + spreadPct);
  const estimatedUsd = valorEmReais / finalRate;

  return {
    ok: true,
    valorEmReais,
    requestedDate,
    baseDate: base.quoteDate,
    basePtax,
    spreadPct,
    finalRate,
    estimatedUsd,
    ruleLabel,
    audit: {
      todayAttempts: todayQuote.attempts,
      previousAttempts: previousQuote.attempts
    }
  };
}

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  const valorEmReais = Number(brlValueInput.value);

  if (!Number.isFinite(valorEmReais) || valorEmReais < 0.01) {
    resultBox.classList.remove('hidden');
    resultBox.classList.add('error');
    renderFallback({
      message: 'Informe um valor em reais válido (mínimo R$ 0,01).'
    });
    return;
  }

  submitBtn.disabled = true;
  submitBtn.textContent = 'Calculando...';
  resultBox.classList.remove('hidden');
  resultBox.classList.remove('error');
  resultBox.innerHTML = '<p>Buscando PTAX do dia e do dia anterior...</p>';

  try {
    const data = await calculateSpreadFlow(dateInput.value, valorEmReais);
    resultBox.classList.toggle('error', !data.ok);
    if (data.ok) renderSuccess(data);
    else renderFallback(data);
  } catch (error) {
    resultBox.classList.add('error');
    renderFallback({ ok: false, message: `Falha de rede/CORS: ${error.message}` });
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = 'Calcular PTAX + spread';
  }
});

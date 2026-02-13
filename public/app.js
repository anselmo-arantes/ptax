const form = document.querySelector('#ptax-form');
const dateInput = document.querySelector('#date');
const resultBox = document.querySelector('#result');
const submitBtn = document.querySelector('#submit-btn');

dateInput.value = new Date().toISOString().slice(0, 10);

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
      <article class="kpi">
        <div class="label">Data solicitada</div>
        <div class="value">${data.requestedDate}</div>
      </article>
      <article class="kpi">
        <div class="label">Data utilizada</div>
        <div class="value">${data.usedDate}</div>
      </article>
      <article class="kpi">
        <div class="label">Cotação compra</div>
        <div class="value">R$ ${compra}</div>
      </article>
      <article class="kpi">
        <div class="label">Cotação venda</div>
        <div class="value">R$ ${venda}</div>
      </article>
      <article class="kpi">
        <div class="label">Última atualização</div>
        <div class="value">${horario}</div>
      </article>
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

  if (data.ok) {
    renderSuccess(data);
    return;
  }

  renderFallback(data);
}

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  submitBtn.disabled = true;
  submitBtn.textContent = 'Consultando...';
  resultBox.classList.remove('hidden');
  resultBox.classList.remove('error');
  resultBox.innerHTML = '<p>Buscando dados no endpoint local...</p>';

  try {
    const response = await fetch(`/api/ptax?date=${dateInput.value}`);
    const data = await response.json();
    renderResult(data);
  } catch (error) {
    renderFallback({ ok: false, message: `Erro no frontend: ${error.message}` });
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = 'Buscar PTAX';
  }
});

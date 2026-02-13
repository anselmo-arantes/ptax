const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('http');

const {
  fetchPtax,
  buildBcbUrl,
  normalizeDate,
  subtractDays
} = require('../ptax-service');

test('buildBcbUrl converte YYYY-MM-DD em MM-DD-YYYY', () => {
  assert.equal(
    buildBcbUrl('2026-02-13', { apiBase: 'https://example.test/odata' }),
    "https://example.test/odata/CotacaoDolarDia(dataCotacao='02-13-2026')?$format=json"
  );
});

test('normalizeDate mantém data ISO válida', () => {
  assert.equal(normalizeDate('2026-02-13'), '2026-02-13');
});

test('subtractDays remove dias da data de referência', () => {
  assert.equal(subtractDays('2026-02-13', 1), '2026-02-12');
});

test('fetchPtax retorna 200 com source=bcb quando upstream responde 2xx e tem valor', async () => {
  const fakeFetch = async () => ({
    ok: true,
    status: 200,
    json: async () => ({ value: [{ cotacaoCompra: 5.2, cotacaoVenda: 5.3 }] })
  });

  const result = await fetchPtax('2026-02-13', fakeFetch);

  assert.equal(result.httpStatus, 200);
  assert.equal(result.body.ok, true);
  assert.equal(result.body.source, 'bcb');
  assert.equal(result.body.usedDate, '2026-02-13');
});

test('fetchPtax tenta dia anterior quando o dia está vazio', async () => {
  const calls = [];
  const fakeFetch = async (url) => {
    calls.push(url);

    if (calls.length === 1) {
      return { ok: true, status: 200, json: async () => ({ value: [] }) };
    }

    return {
      ok: true,
      status: 200,
      json: async () => ({ value: [{ cotacaoCompra: 5.1, cotacaoVenda: 5.2 }] })
    };
  };

  const result = await fetchPtax('2026-02-13', fakeFetch);

  assert.equal(result.httpStatus, 200);
  assert.equal(result.body.ok, true);
  assert.equal(result.body.usedDate, '2026-02-12');
  assert.equal(result.body.attempts.length, 2);
});

test('fetchPtax retorna fallback 200 quando upstream responde erro HTTP', async () => {
  const fakeFetch = async () => ({ ok: false, status: 503 });
  const result = await fetchPtax('2026-02-13', fakeFetch);

  assert.equal(result.httpStatus, 200);
  assert.equal(result.body.ok, false);
  assert.equal(result.body.source, 'fallback');
  assert.equal(result.body.upstreamStatus, 503);
});

test('fetchPtax retorna fallback 200 quando há exceção de rede', async () => {
  const fakeFetch = async () => {
    throw new Error('network down');
  };

  const result = await fetchPtax('2026-02-13', fakeFetch);

  assert.equal(result.httpStatus, 200);
  assert.equal(result.body.ok, false);
  assert.equal(result.body.source, 'fallback');
  assert.match(result.body.details, /network down/);
});

test('fetchPtax sucesso em integração com servidor HTTP mockado', async () => {
  const server = http.createServer((req, res) => {
    if (req.url.includes("CotacaoDolarDia(dataCotacao='02-13-2026')")) {
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end(
        JSON.stringify({
          value: [
            {
              cotacaoCompra: 5.16,
              cotacaoVenda: 5.17,
              dataHoraCotacao: '2026-02-13 13:00:00.000'
            }
          ]
        })
      );
      return;
    }

    res.writeHead(404, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ value: [] }));
  });

  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address();

  try {
    const result = await fetchPtax('2026-02-13', fetch, {
      apiBase: `http://127.0.0.1:${port}/olinda/servico/PTAX/versao/v1/odata`
    });

    assert.equal(result.httpStatus, 200);
    assert.equal(result.body.ok, true);
    assert.equal(result.body.source, 'bcb');
    assert.equal(result.body.upstreamStatus, 200);
    assert.equal(result.body.ptax.cotacaoVenda, 5.17);
  } finally {
    server.close();
  }
});

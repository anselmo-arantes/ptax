const DEFAULT_API_BASE = 'https://olinda.bcb.gov.br/olinda/servico/PTAX/versao/v1/odata';
const MAX_LOOKBACK_DAYS = 7;

function formatAsIsoDate(date) {
  return date.toISOString().slice(0, 10);
}

function normalizeDate(dateLike = new Date()) {
  if (typeof dateLike === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(dateLike)) {
    return dateLike;
  }

  const parsed = new Date(dateLike);
  if (Number.isNaN(parsed.getTime())) {
    return formatAsIsoDate(new Date());
  }

  return formatAsIsoDate(parsed);
}

function subtractDays(isoDate, days) {
  const d = new Date(`${isoDate}T12:00:00.000Z`);
  d.setUTCDate(d.getUTCDate() - days);
  return formatAsIsoDate(d);
}

function getApiBase(options = {}) {
  return options.apiBase || process.env.PTAX_API_BASE || DEFAULT_API_BASE;
}

function buildBcbUrl(isoDate, options = {}) {
  const [year, month, day] = isoDate.split('-');
  const bcbDate = `${month}-${day}-${year}`;
  return `${getApiBase(options)}/CotacaoDolarDia(dataCotacao='${bcbDate}')?$format=json`;
}

async function fetchFromBcb(isoDate, fetchImpl = fetch, options = {}) {
  const url = buildBcbUrl(isoDate, options);
  const upstream = await fetchImpl(url, {
    method: 'GET',
    headers: { Accept: 'application/json' }
  });

  if (!upstream.ok) {
    return { ok: false, kind: 'http_error', status: upstream.status, isoDate };
  }

  const payload = await upstream.json();
  const rows = payload?.value ?? [];
  const last = rows.at(-1) ?? null;

  if (!last) {
    return { ok: false, kind: 'empty', status: upstream.status, isoDate };
  }

  return { ok: true, kind: 'success', status: upstream.status, isoDate, ptax: last };
}

async function fetchPtax(inputDate, fetchImpl = fetch, options = {}) {
  const requestedDate = normalizeDate(inputDate);
  const attempts = [];

  for (let step = 0; step <= MAX_LOOKBACK_DAYS; step += 1) {
    const dateToTry = subtractDays(requestedDate, step);
    try {
      const result = await fetchFromBcb(dateToTry, fetchImpl, options);
      attempts.push({ date: dateToTry, kind: result.kind, status: result.status });

      if (result.ok) {
        return {
          httpStatus: 200,
          body: {
            ok: true,
            source: 'bcb',
            requestedDate,
            usedDate: dateToTry,
            attempts,
            upstreamStatus: result.status,
            ptax: result.ptax
          }
        };
      }

      if (result.kind === 'http_error') {
        break;
      }
    } catch (error) {
      return {
        httpStatus: 200,
        body: {
          ok: false,
          source: 'fallback',
          requestedDate,
          attempts,
          message: 'Falha de rede ao consultar a API do BCB.',
          details: error instanceof Error ? error.message : String(error),
          ptax: null
        }
      };
    }
  }

  const httpErrorAttempt = attempts.find((a) => a.kind === 'http_error');
  const isOnlyEmpty = attempts.length > 0 && attempts.every((a) => a.kind === 'empty');

  return {
    httpStatus: 200,
    body: {
      ok: false,
      source: 'fallback',
      requestedDate,
      attempts,
      message: isOnlyEmpty
        ? 'Sem cotação disponível no período consultado.'
        : 'API do BCB indisponível no momento.',
      upstreamStatus: httpErrorAttempt?.status,
      ptax: null
    }
  };
}

module.exports = {
  fetchPtax,
  fetchFromBcb,
  normalizeDate,
  buildBcbUrl,
  subtractDays,
  getApiBase
};

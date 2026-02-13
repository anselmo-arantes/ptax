# ptax
Calcular ptax do dia.

## Frontend + backend local

A aplicação tem uma UI simples e um backend Node para consultar a PTAX do Banco Central.

- Frontend: `GET /`
- API local: `GET /api/ptax?date=YYYY-MM-DD`

## Contrato do endpoint `/api/ptax`

O endpoint sempre retorna **2XX (HTTP 200)** para o frontend:

- sucesso BCB: `{ ok: true, source: "bcb", requestedDate, usedDate, ptax }`
- fallback (erro HTTP/rede/sem dados): `{ ok: false, source: "fallback", ... }`

Além disso, em caso de data sem cotação, o serviço tenta automaticamente dias anteriores (lookback de até 7 dias).

## Configuração de upstream

Por padrão, a aplicação usa o endpoint oficial:

- `https://olinda.bcb.gov.br/olinda/servico/PTAX/versao/v1/odata`

Para testes/integração local, é possível sobrescrever via variável de ambiente:

- `PTAX_API_BASE=http://localhost:9999/olinda/servico/PTAX/versao/v1/odata`

## Rodando localmente

```bash
npm start
```

Abra no navegador: `http://localhost:3000`

## Testes

```bash
npm test
```

Inclui teste de sucesso com servidor HTTP mockado simulando a API PTAX.

# ptax
Calcular PTAX do dia em um site estático.

## Deploy 100% estático

Este projeto funciona sem backend em produção.
O frontend (`public/`) consulta diretamente a API PTAX do Banco Central do Brasil.

## Regra de negócio (valor em reais)

O formulário possui um campo `valorEmReais` (min `0.01`, step `0.01`) e aplica:

- valor **< R$90,00**: usa PTAX do dia anterior (ou último útil anterior) + **7%** de spread.
- valor **>= R$90,00**: usa PTAX do dia selecionado + **6%** de spread.

A tela exibe:

- valor informado em reais;
- PTAX base usada;
- percentual de spread aplicado;
- cotação final com spread;
- valor estimado em USD (opcional).

## Formato de datas na interface

As datas exibidas para o usuário seguem o padrão:

- `DD-MM-AAAA`

Esse formato é aplicado para os campos de resultado como **Data solicitada** e **Data base usada**.

## Fonte de dados (API PTAX)

Endpoint utilizado no frontend:

- `https://olinda.bcb.gov.br/olinda/servico/PTAX/versao/v1/odata/CotacaoDolarDia(...)`

A consulta usa busca retroativa (lookback) para encontrar cotação válida quando não há dado na data exata.

## Como publicar

Publique os arquivos abaixo em qualquer hosting estático (Vercel static, Netlify, S3+CloudFront, GitHub Pages, etc):

- `public/index.html`
- `public/styles.css`
- `public/app.js`

Para Render, use `render.yaml` com `staticPublishPath: public`.

## Desenvolvimento local

```bash
python3 -m http.server 4173 -d public
```

Acesse: `http://localhost:4173`.

## Observações e limitações

- A aplicação depende de disponibilidade/CORS da API PTAX do BCB no navegador.
- Se houver bloqueio de rede/CORS no ambiente do usuário, a tela exibirá fallback de erro.
- O valor exibido em USD é apenas estimativo com base na cotação final com spread.

# ptax
Calcular PTAX do dia em um site estático.

## Deploy 100% estático

Este projeto agora funciona sem backend para produção estática.
O frontend (`public/`) consulta diretamente a API PTAX do Banco Central.

## Como publicar

Publique os arquivos abaixo em qualquer hosting estático (Vercel static, Netlify, S3+CloudFront, GitHub Pages, etc):

- `public/index.html`
- `public/styles.css`
- `public/app.js`

## Desenvolvimento local

Você pode abrir `public/index.html` direto no navegador ou usar um servidor simples:

```bash
python3 -m http.server 4173 -d public
```

Acesse: `http://localhost:4173`.

## Observação

A aplicação depende de disponibilidade/CORS da API PTAX do BCB no navegador.
Se houver bloqueio de rede/cors no ambiente do usuário, a tela exibirá fallback de erro.


## Estrutura enxuta

Para manter o projeto 100% estático, arquivos de backend/testes Node foram removidos.

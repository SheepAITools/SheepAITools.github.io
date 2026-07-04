# SheepToolBackend

SheepAI does not expose browser CORS headers, so this backend accepts browser requests and forwards them to SheepAI APIs.

## Requirements

- Node.js 20+

## Run

```bash
cp .env.example .env
npm start
```

Default server URL:

```text
http://localhost:3000
```

## Environment

| Name | Default | Description |
| --- | --- | --- |
| `PORT` | `3000` | Local server port. |
| `SHEEPAI_BASE_URL` | `https://www.sheepai.top` | SheepAI upstream API base URL. |
| `CORS_ORIGIN` | `*` | Browser origin allowed to call this backend. |

## Browser API

Pass the SheepAI system token with the `Authorization` header. For SheepAI system APIs, the SheepAI user ID is also required in the `new-api-user` header.

### Health check

```bash
curl http://localhost:3000/health
```

### Get account info

```bash
curl http://localhost:3000/api/sheep/user/self \
  -H "Authorization: YOUR_SHEEPAI_SYSTEM_TOKEN" \
  -H "new-api-user: YOUR_SHEEPAI_USER_ID"
```

### Get token list

```bash
curl "http://localhost:3000/api/sheep/tokens?p=0&size=10" \
  -H "Authorization: YOUR_SHEEPAI_SYSTEM_TOKEN" \
  -H "new-api-user: YOUR_SHEEPAI_USER_ID"
```

### Get token supported models

```bash
curl http://localhost:3000/api/sheep/models \
  -H "Authorization: YOUR_SHEEPAI_API_KEY"
```

### Search token

```bash
curl "http://localhost:3000/api/sheep/tokens/search?keyword=&token=sk-xxxxxxxxxxx" \
  -H "Authorization: YOUR_SHEEPAI_SYSTEM_TOKEN" \
  -H "new-api-user: YOUR_SHEEPAI_USER_ID"
```

### Get token usage

```bash
curl http://localhost:3000/api/sheep/usage/token \
  -H "Authorization: Bearer YOUR_TOKEN"
```

## Frontend example

```js
const response = await fetch("http://localhost:3000/api/sheep/user/self", {
  headers: {
    Authorization: "YOUR_SHEEPAI_SYSTEM_TOKEN",
    "new-api-user": "YOUR_SHEEPAI_USER_ID"
  }
});

const data = await response.json();
console.log(data);
```

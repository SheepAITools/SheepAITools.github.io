import http from "node:http"
import https from "node:https"
import { URL } from "node:url"

const DEFAULT_PORT = 8787
const TARGET_ORIGIN = "https://www.sheepai.top"
const PROXY_PREFIX = "/sheepai"
const ALLOWED_ORIGINS = new Set(["http://localhost:5173", "http://127.0.0.1:5173"])
const ALLOWED_EXACT_PATHS = new Set([
  "/api/user/self",
  "/v1/models",
  "/v1/chat/completions",
  "/v1/messages",
])
const ALLOWED_DIRECTORY_PATHS = ["/api/token/", "/api/usage/token/"]
const FORWARDED_REQUEST_HEADERS = ["authorization", "new-api-user", "content-type"]
const FORWARDED_RESPONSE_HEADERS = ["content-type", "cache-control"]
const CORS_ALLOWED_HEADERS = "Authorization, New-Api-User, Content-Type"
const MAX_BODY_BYTES = 10 * 1024 * 1024

/**
 * Trims a path to the fixed SheepAI proxy prefix.
 *
 * @param {string} requestPath Incoming request pathname.
 * @returns {string} Target SheepAI pathname.
 */
function stripProxyPrefix(requestPath) {
  if (requestPath === PROXY_PREFIX) {
    return "/"
  }
  return requestPath.slice(PROXY_PREFIX.length) || "/"
}

/**
 * Checks whether a target path is in the SheepAI whitelist.
 *
 * @param {string} targetPath SheepAI target pathname.
 * @returns {boolean} True when the path is allowed.
 */
function isAllowedTargetPath(targetPath) {
  if (ALLOWED_EXACT_PATHS.has(targetPath)) {
    return true
  }

  return ALLOWED_DIRECTORY_PATHS.some((directoryPath) => targetPath === directoryPath || targetPath.startsWith(directoryPath))
}

/**
 * Adds CORS headers for trusted local development origins.
 *
 * @param {http.IncomingMessage} request Client request.
 * @param {http.ServerResponse} response Client response.
 */
function setCorsHeaders(request, response) {
  const origin = request.headers.origin ?? ""
  if (ALLOWED_ORIGINS.has(origin)) {
    response.setHeader("Access-Control-Allow-Origin", origin)
    response.setHeader("Vary", "Origin")
  }
  response.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
  response.setHeader("Access-Control-Allow-Headers", CORS_ALLOWED_HEADERS)
  response.setHeader("Access-Control-Max-Age", "86400")
}

/**
 * Writes a JSON response.
 *
 * @param {http.IncomingMessage} request Client request.
 * @param {http.ServerResponse} response Client response.
 * @param {number} statusCode HTTP status code.
 * @param {Record<string, unknown>} body JSON serializable response body.
 */
function writeJson(request, response, statusCode, body) {
  setCorsHeaders(request, response)
  response.writeHead(statusCode, { "Content-Type": "application/json; charset=utf-8" })
  response.end(JSON.stringify(body))
}

/**
 * Copies only explicitly permitted request headers to SheepAI.
 *
 * @param {http.IncomingHttpHeaders} headers Incoming request headers.
 * @returns {Record<string, string>} Safe target request headers.
 */
function buildTargetHeaders(headers) {
  const targetHeaders = {}
  for (const headerName of FORWARDED_REQUEST_HEADERS) {
    const headerValue = headers[headerName]
    if (Array.isArray(headerValue)) {
      targetHeaders[headerName] = headerValue.join(", ")
    } else if (typeof headerValue === "string" && headerValue.length > 0) {
      targetHeaders[headerName] = headerValue
    }
  }
  return targetHeaders
}

/**
 * Copies safe response headers from SheepAI to the browser.
 *
 * @param {http.IncomingMessage} upstreamResponse SheepAI response.
 * @param {http.ServerResponse} response Client response.
 */
function setProxyResponseHeaders(upstreamResponse, response) {
  for (const headerName of FORWARDED_RESPONSE_HEADERS) {
    const headerValue = upstreamResponse.headers[headerName]
    if (headerValue !== undefined) {
      response.setHeader(headerName, headerValue)
    }
  }
}

/**
 * Logs sanitized request metadata without credentials or bodies.
 *
 * @param {string} method HTTP method.
 * @param {string} path Request path.
 * @param {number} statusCode Response status code.
 * @param {number} startedAt Request start timestamp.
 */
function logRequest(method, path, statusCode, startedAt) {
  const durationMs = Date.now() - startedAt
  console.info(`${method} ${path} ${statusCode} ${durationMs}ms`)
}

/**
 * Proxies a whitelisted /sheepai/* request to https://www.sheepai.top/*.
 *
 * @param {http.IncomingMessage} request Client request.
 * @param {http.ServerResponse} response Client response.
 * @param {URL} requestUrl Parsed local request URL.
 * @param {number} startedAt Request start timestamp.
 */
function proxySheepAiRequest(request, response, requestUrl, startedAt) {
  const targetPath = stripProxyPrefix(requestUrl.pathname)
  if (!isAllowedTargetPath(targetPath)) {
    writeJson(request, response, 403, { error: "Forbidden SheepAI path" })
    logRequest(request.method ?? "GET", requestUrl.pathname, 403, startedAt)
    return
  }

  const targetUrl = new URL(`${targetPath}${requestUrl.search}`, TARGET_ORIGIN)

  // Re-validate after URL normalization to prevent path traversal bypass
  if (!isAllowedTargetPath(targetUrl.pathname)) {
    writeJson(request, response, 403, { error: "Forbidden SheepAI path" })
    logRequest(request.method ?? "GET", requestUrl.pathname, 403, startedAt)
    return
  }

  const proxyRequest = https.request(
    targetUrl,
    {
      method: request.method,
      headers: buildTargetHeaders(request.headers),
    },
    (upstreamResponse) => {
      setCorsHeaders(request, response)
      setProxyResponseHeaders(upstreamResponse, response)
      response.writeHead(upstreamResponse.statusCode ?? 502)
      upstreamResponse.pipe(response)
      upstreamResponse.on("end", () => {
        logRequest(request.method ?? "GET", requestUrl.pathname, upstreamResponse.statusCode ?? 502, startedAt)
      })
    },
  )

  proxyRequest.setTimeout(60_000, () => {
    proxyRequest.destroy(new Error("Upstream request timed out"))
  })

  proxyRequest.on("error", () => {
    if (!response.headersSent) {
      writeJson(request, response, 502, { error: "SheepAI upstream request failed" })
    } else {
      response.destroy()
    }
    logRequest(request.method ?? "GET", requestUrl.pathname, 502, startedAt)
  })

  let receivedBytes = 0
  request.on("data", (chunk) => {
    receivedBytes += chunk.length
    if (receivedBytes > MAX_BODY_BYTES) {
      proxyRequest.destroy(new Error("Request body too large"))
      if (!response.headersSent) {
        writeJson(request, response, 413, { error: "Request body too large" })
      }
      return
    }
    proxyRequest.write(chunk)
  })
  request.on("end", () => {
    proxyRequest.end()
  })
  request.on("error", () => {
    proxyRequest.destroy()
  })
}

/**
 * Handles local HTTP requests.
 *
 * @param {http.IncomingMessage} request Client request.
 * @param {http.ServerResponse} response Client response.
 */
function handleRequest(request, response) {
  const startedAt = Date.now()
  const method = request.method ?? "GET"
  const requestUrl = new URL(request.url ?? "/", `http://${request.headers.host ?? "localhost"}`)

  if (requestUrl.pathname === "/health" && method === "GET") {
    writeJson(request, response, 200, { ok: true })
    logRequest(method, requestUrl.pathname, 200, startedAt)
    return
  }

  if (method === "OPTIONS") {
    setCorsHeaders(request, response)
    response.writeHead(204)
    response.end()
    logRequest(method, requestUrl.pathname, 204, startedAt)
    return
  }

  if (!requestUrl.pathname.startsWith(`${PROXY_PREFIX}/`)) {
    writeJson(request, response, 404, { error: "Not found" })
    logRequest(method, requestUrl.pathname, 404, startedAt)
    return
  }

  if (!["GET", "POST"].includes(method)) {
    writeJson(request, response, 405, { error: "Method not allowed" })
    logRequest(method, requestUrl.pathname, 405, startedAt)
    return
  }

  proxySheepAiRequest(request, response, requestUrl, startedAt)
}

const port = Number.parseInt(process.env.PORT ?? String(DEFAULT_PORT), 10)
const server = http.createServer(handleRequest)

server.listen(Number.isFinite(port) ? port : DEFAULT_PORT, () => {
  const activePort = Number.isFinite(port) ? port : DEFAULT_PORT
  console.info(`SheepAI local proxy listening on http://localhost:${activePort}`)
})

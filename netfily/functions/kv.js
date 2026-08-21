// Función serverless de Netlify. Guarda y lee datos en Upstash Redis
// (base de datos gratuita) para que todos los dispositivos vean la
// misma información. Necesita las variables de entorno:
//   UPSTASH_REDIS_REST_URL
//   UPSTASH_REDIS_REST_TOKEN
// (se configuran en Netlify → Site configuration → Environment variables)

const ALLOWED_KEYS = ["entries", "menu", "extras", "leches", "usuarios", "pin", "config"];

async function upstash(command) {
  const { UPSTASH_REDIS_REST_URL, UPSTASH_REDIS_REST_TOKEN } = process.env;
  const res = await fetch(UPSTASH_REDIS_REST_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${UPSTASH_REDIS_REST_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(command),
  });
  if (!res.ok) throw new Error("Upstash error");
  return res.json();
}

exports.handler = async (event) => {
  const { UPSTASH_REDIS_REST_URL, UPSTASH_REDIS_REST_TOKEN } = process.env;
  if (!UPSTASH_REDIS_REST_URL || !UPSTASH_REDIS_REST_TOKEN) {
    return {
      statusCode: 500,
      body: JSON.stringify({
        error: "Faltan las variables de entorno UPSTASH_REDIS_REST_URL / UPSTASH_REDIS_REST_TOKEN en Netlify.",
      }),
    };
  }

  try {
    if (event.httpMethod === "GET") {
      const key = event.queryStringParameters && event.queryStringParameters.key;
      if (!ALLOWED_KEYS.includes(key)) {
        return { statusCode: 400, body: JSON.stringify({ error: "Clave no permitida" }) };
      }
      const data = await upstash(["GET", `casa-elina:${key}`]);
      return {
        statusCode: 200,
        body: JSON.stringify({ value: data.result ? JSON.parse(data.result) : null }),
      };
    }

    if (event.httpMethod === "POST") {
      const { key, value } = JSON.parse(event.body || "{}");
      if (!ALLOWED_KEYS.includes(key)) {
        return { statusCode: 400, body: JSON.stringify({ error: "Clave no permitida" }) };
      }
      await upstash(["SET", `casa-elina:${key}`, JSON.stringify(value)]);
      return { statusCode: 200, body: JSON.stringify({ ok: true }) };
    }

    return { statusCode: 405, body: JSON.stringify({ error: "Método no permitido" }) };
  } catch (err) {
    return { statusCode: 500, body: JSON.stringify({ error: "Error de conexión con la base de datos" }) };
  }
};


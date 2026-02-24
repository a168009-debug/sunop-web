const https = require('https');

exports.handler = async (event, context) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  try {
    const { message, context: ctx, history } = JSON.parse(event.body);
    const apiKey = process.env.OPENAI_API_KEY;

    if (!apiKey) {
      return { statusCode: 400, body: JSON.stringify({ error: '請在 Netlify 設定 OPENAI_API_KEY 環境變數' }) };
    }

    const systemPrompt = getContextPrompt(ctx);
    const messages = [
      { role: 'system', content: systemPrompt },
      ...(history || []).slice(-6),
      { role: 'user', content: message }
    ];

    const response = await callOpenAI(apiKey, messages);
    
    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reply: response })
    };
  } catch (error) {
    return { statusCode: 500, body: JSON.stringify({ error: error.message }) };
  }
};

function getContextPrompt(ctx) {
  const prompts = {
    '命理分析': '你是命理分析 AI 助理。用繁體中文回答，溫和專業。',
    '姓名分析': '你是姓名分析 AI 助理。用繁體中文回答。',
    '情緒曲線': '你是情緒分析 AI 助理。用繁體中文回答。',
    'AI畫像': '你是 AI 畫像解讀 AI 助理。用繁體中文回答。',
    '智慧卡': '你是智慧卡解讀 AI 助理。用繁體中文回答。',
    '測字': '你是測字解讀 AI 助理。用繁體中文回答。'
  };
  return prompts[ctx] || prompts['命理分析'];
}

function callOpenAI(apiKey, messages) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify({
      model: 'gpt-3.5-turbo',
      messages,
      temperature: 0.7,
      max_tokens: 500
    });

    const options = {
      hostname: 'api.openai.com',
      path: '/v1/chat/completions',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
        'Content-Length': Buffer.byteLength(data)
      },
      timeout: 25000
    };

    const req = https.request(options, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        try {
          const json = JSON.parse(body);
          if (json.error) reject(new Error(json.error.message));
          else resolve(json.choices[0].message.content);
        } catch (e) {
          reject(new Error('API 回應解析失敗: ' + e.message));
        }
      });
    });

    req.on('error', reject);
    req.on('timeout', () => req.destroy());
    req.setTimeout(25000, () => {
      req.destroy();
      reject(new Error('請求超時'));
    });
    req.write(data);
    req.end();
  });
}

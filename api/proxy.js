export default async function handler(req, res) {
    // CORS 헤더 설정
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    // OPTIONS 요청 처리
    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    const GOOGLE_URL = process.env.GOOGLE_SCRIPT_URL;

    if (!GOOGLE_URL) {
        console.error('Environment variable GOOGLE_SCRIPT_URL is not set');
        return res.status(500).json({ error: 'Server configuration error' });
    }

    try {
        let body = '';

        if (req.method === 'POST') {
            // req.body가 이미 파싱되어 있는 경우
            if (req.body) {
                body = JSON.stringify(req.body);
            } else {
                // 수동으로 body 읽기
                body = JSON.stringify(await new Promise((resolve) => {
                    let data = '';
                    req.on('data', chunk => {
                        data += chunk.toString();
                    });
                    req.on('end', () => {
                        try {
                            resolve(JSON.parse(data));
                        } catch {
                            resolve(data);
                        }
                    });
                }));
            }
        }

        const options = {
            method: req.method,
            headers: {
                'Content-Type': 'application/json',
            },
        };

        if (req.method === 'POST' && body) {
            options.body = body;
        }

        console.log('Forwarding request to Google Apps Script:', GOOGLE_URL);
        const response = await fetch(GOOGLE_URL, options);
        const data = await response.json();

        console.log('Response from Google:', data);
        res.status(200).json(data);
    } catch (error) {
        console.error('Proxy Error:', error);
        res.status(500).json({ error: 'Failed to fetch from Google', details: error.message });
    }
}

export default async function handler(req, res) {
    // CORS 헤더
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    const GOOGLE_URL = process.env.GOOGLE_SCRIPT_URL;

    // 환경 변수 확인
    if (!GOOGLE_URL) {
        console.error('❌ GOOGLE_SCRIPT_URL environment variable is missing');
        return res.status(500).json({
            error: 'Server configuration error',
            message: 'GOOGLE_SCRIPT_URL not set'
        });
    }

    console.log('✅ Google URL found:', GOOGLE_URL.substring(0, 50) + '...');

    try {
        const options = {
            method: req.method,
            headers: {
                'Content-Type': 'text/plain;charset=utf-8',
            },
        };

        // POST 요청일 때만 body 추가
        if (req.method === 'POST' && req.body) {
            options.body = JSON.stringify(req.body);
            console.log('📤 Sending to Google:', options.body);
        }

        console.log('🚀 Calling Google Apps Script...');
        const response = await fetch(GOOGLE_URL, options);

        console.log('📥 Response status:', response.status);
        const text = await response.text();
        console.log('📥 Response text:', text.substring(0, 200));

        try {
            const data = JSON.parse(text);
            return res.status(200).json(data);
        } catch {
            // JSON이 아니면 텍스트 그대로 반환
            return res.status(200).send(text);
        }

    } catch (error) {
        console.error('❌ Proxy Error:', error.message);
        console.error('Stack:', error.stack);
        return res.status(500).json({
            error: 'Failed to communicate with Google Sheets',
            details: error.message
        });
    }
}

export default async function handler(req, res) {
    const GOOGLE_URL = process.env.GOOGLE_SCRIPT_URL;

    if (!GOOGLE_URL) {
        return res.status(500).json({ error: 'Environment variable GOOGLE_SCRIPT_URL is not set' });
    }

    try {
        const options = {
            method: req.method,
            headers: {
                'Content-Type': 'application/json',
            },
        };

        if (req.method === 'POST') {
            options.body = JSON.stringify(req.body);
        }

        const response = await fetch(GOOGLE_URL, options);
        const data = await response.json();

        res.status(200).json(data);
    } catch (error) {
        console.error('Proxy Error:', error);
        res.status(500).json({ error: 'Failed to fetch from Google' });
    }
}

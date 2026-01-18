const express = require('express');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// 구글 Apps Script 웹 앱 URL (환경 변수에서 가져옴)
const GOOGLE_SCRIPT_URL = process.env.GOOGLE_SCRIPT_URL;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(__dirname));

// API 라우트 - GET: 구글 스프레드시트에서 스케줄 조회
app.get('/api/proxy', async (req, res) => {
    try {
        if (!GOOGLE_SCRIPT_URL) {
            console.error('❌ GOOGLE_SCRIPT_URL 환경 변수가 설정되지 않았습니다.');
            return res.status(500).json({ 
                error: '서버 설정 오류', 
                message: '.env 파일에 GOOGLE_SCRIPT_URL을 설정해주세요.' 
            });
        }

        console.log('📤 구글 스프레드시트에서 데이터 조회 중...');
        const response = await fetch(GOOGLE_SCRIPT_URL);
        
        if (!response.ok) {
            throw new Error(`Google Apps Script 응답 오류: ${response.status}`);
        }

        const data = await response.json();
        console.log('📥 스케줄 조회 성공:', data.length, '개');
        res.json(data);
    } catch (error) {
        console.error('❌ 스케줄 조회 오류:', error.message);
        res.status(500).json({ 
            error: '스케줄을 불러오는데 실패했습니다.', 
            details: error.message 
        });
    }
});

// API 라우트 - POST: 구글 스프레드시트에 스케줄 추가/수정/삭제
app.post('/api/proxy', async (req, res) => {
    try {
        if (!GOOGLE_SCRIPT_URL) {
            console.error('❌ GOOGLE_SCRIPT_URL 환경 변수가 설정되지 않았습니다.');
            return res.status(500).json({ 
                error: '서버 설정 오류', 
                message: '.env 파일에 GOOGLE_SCRIPT_URL을 설정해주세요.' 
            });
        }

        const scheduleData = req.body;
        
        // 삭제 요청
        if (scheduleData.action === 'delete') {
            console.log('🗑️ 스케줄 삭제 요청:', scheduleData.id);
        } 
        // 추가/수정 요청
        else {
            console.log('💾 스케줄 저장 요청:', scheduleData.id);
        }

        console.log('📤 구글 스프레드시트에 데이터 전송 중...');
        const response = await fetch(GOOGLE_SCRIPT_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'text/plain;charset=utf-8',
            },
            body: JSON.stringify(scheduleData)
        });

        if (!response.ok) {
            throw new Error(`Google Apps Script 응답 오류: ${response.status}`);
        }

        const result = await response.json();
        console.log('✅ 저장 성공:', result);
        res.json({ success: true, result });
    } catch (error) {
        console.error('❌ 스케줄 저장 오류:', error.message);
        res.status(500).json({ 
            error: '스케줄을 저장하는데 실패했습니다.', 
            details: error.message 
        });
    }
});

// 기본 라우트
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// 서버 시작
app.listen(PORT, () => {
    console.log('');
    console.log('🚀 ========================================');
    console.log('🎯 상담 스케줄 관리 시스템 서버 시작!');
    console.log('🌐 서버 주소: http://localhost:' + PORT);
    console.log('📊 데이터 저장: 구글 스프레드시트');
    if (GOOGLE_SCRIPT_URL) {
        console.log('✅ 구글 스크립트 URL: ' + GOOGLE_SCRIPT_URL.substring(0, 50) + '...');
    } else {
        console.log('⚠️  경고: GOOGLE_SCRIPT_URL이 설정되지 않았습니다!');
        console.log('   .env 파일에 GOOGLE_SCRIPT_URL을 설정해주세요.');
    }
    console.log('🚀 ========================================');
    console.log('');
    console.log('💡 브라우저에서 http://localhost:' + PORT + ' 로 접속하세요!');
    console.log('💡 종료하려면 Ctrl + C 를 누르세요.');
    console.log('');
});

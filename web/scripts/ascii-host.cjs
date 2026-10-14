// Vercel CLI 가 한글 PC 이름을 HTTP 헤더에 넣다가 실패하는 문제 우회
const os = require('os')
os.hostname = () => 'ourcal-pc'

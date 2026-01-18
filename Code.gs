// Google Apps Script Backend for Counseling Schedule
// 이 코드를 구글 스프레드시트의 '확장 프로그램 > Apps Script'에 복사하여 붙여넣으세요.

// 스프레드시트 ID (새 스프레드시트로 변경됨)
const SPREADSHEET_ID = "1J-eHP9z8dCBW1u3mcXeeufNVbP_RByXMo3juY8y365g";

// 자동 감지 방식 (다른 스프레드시트를 사용하려면 위 줄을 주석 처리하고 아래 줄을 사용하세요)
// const SPREADSHEET_ID = SpreadsheetApp.getActiveSpreadsheet().getId();
const SHEET_NAME = "Sheet1"; // 스프레드시트 하단의 시트 이름이 "Sheet1"인지 확인하세요.

// 헤더 정의 (필드 순서와 이름)
const HEADERS = ['id', 'counselor', 'date', 'startTime', 'endTime', 'clientName', 'sessionNumber'];

/**
 * 시트를 초기화합니다 (헤더가 없으면 생성)
 */
function initializeSheet() {
  const spreadsheet = SpreadsheetApp.openById(SPREADSHEET_ID);
  let sheet = spreadsheet.getSheetByName(SHEET_NAME);
  
  // 시트가 없으면 생성
  if (!sheet) {
    sheet = spreadsheet.insertSheet(SHEET_NAME);
  }
  
  // 헤더 확인 및 생성
  const data = sheet.getDataRange().getValues();
  if (data.length === 0 || data[0].length === 0 || data[0][0] !== HEADERS[0]) {
    sheet.clear();
    sheet.appendRow(HEADERS);
  }
  
  return sheet;
}

/**
 * 전송된 데이터를 스프레드시트에서 읽어와서 JSON 형태로 반환합니다. (조회용)
 */
function doGet(e) {
  try {
    const sheet = initializeSheet();
    const data = sheet.getDataRange().getValues();
    
    // 헤더만 있고 데이터가 없는 경우
    if (data.length <= 1) {
      return ContentService.createTextOutput(JSON.stringify([]))
        .setMimeType(ContentService.MimeType.JSON);
    }
    
    const headers = data[0];
    const jsonRows = data.slice(1)
      .filter(row => row[0] !== null && row[0] !== '') // 빈 행 제거
      .map(row => {
        let obj = {};
        headers.forEach((header, i) => {
          let value = row[i];
          
          // null이나 undefined 처리
          if (value === null || value === undefined) {
            obj[header] = '';
            return;
          }
          
          // 날짜 필드 처리 (date)
          if (header === 'date' && value instanceof Date) {
            const year = value.getFullYear();
            const month = String(value.getMonth() + 1).padStart(2, '0');
            const day = String(value.getDate()).padStart(2, '0');
            obj[header] = `${year}-${month}-${day}`;
            return;
          }
          
          // 시간 필드 처리 (startTime, endTime)
          if ((header === 'startTime' || header === 'endTime') && value instanceof Date) {
            const hours = String(value.getHours()).padStart(2, '0');
            const minutes = String(value.getMinutes()).padStart(2, '0');
            obj[header] = `${hours}:${minutes}`;
            return;
          }
          
          // 숫자 필드 처리 (sessionNumber)
          if (header === 'sessionNumber' && typeof value === 'number') {
            obj[header] = value;
            return;
          }
          
          // 그 외는 문자열로 변환
          obj[header] = String(value);
        });
        return obj;
      });
    
    return ContentService.createTextOutput(JSON.stringify(jsonRows))
      .setMimeType(ContentService.MimeType.JSON);
      
  } catch (error) {
    Logger.log('doGet Error: ' + error.toString());
    return ContentService.createTextOutput(JSON.stringify({ 
      error: '데이터를 불러오는데 실패했습니다.', 
      message: error.toString() 
    }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

/**
 * 데이터를 추가, 수정 또는 삭제합니다. (저장/삭제용)
 */
function doPost(e) {
  const lock = LockService.getScriptLock();
  
  // Lock 획득 시도 (10초 타임아웃)
  if (!lock.tryLock(10000)) {
    return ContentService.createTextOutput(JSON.stringify({ 
      result: "error", 
      message: "다른 사용자가 데이터를 수정 중입니다. 잠시 후 다시 시도해주세요." 
    }))
      .setMimeType(ContentService.MimeType.JSON);
  }
  
  try {
    const sheet = initializeSheet();
    
    // 요청 본문 파싱
    if (!e.postData || !e.postData.contents) {
      throw new Error('요청 데이터가 없습니다.');
    }
    
    const body = JSON.parse(e.postData.contents);
    const data = sheet.getDataRange().getValues();
    
    // 삭제 요청 처리
    if (body.action === 'delete') {
      if (!body.id) {
        throw new Error('삭제할 ID가 제공되지 않았습니다.');
      }
      
      let deleted = false;
      // 역순으로 검색하여 삭제 (인덱스 문제 방지)
      for (let i = data.length - 1; i >= 1; i--) {
        if (data[i][0] && data[i][0].toString() === body.id.toString()) {
          sheet.deleteRow(i + 1);
          deleted = true;
          Logger.log('Deleted row: ' + (i + 1) + ', ID: ' + body.id);
          break;
        }
      }
      
      if (!deleted) {
        Logger.log('Warning: ID not found for deletion: ' + body.id);
      }
      
      return ContentService.createTextOutput(JSON.stringify({ 
        result: "success", 
        action: "delete",
        id: body.id
      }))
        .setMimeType(ContentService.MimeType.JSON);
    }
    
    // 추가/수정 요청 처리
    // 필수 필드 검증
    if (!body.id) {
      throw new Error('ID가 필요합니다.');
    }
    if (!body.counselor || body.counselor.trim() === '') {
      throw new Error('상담사 이름이 필요합니다.');
    }
    if (!body.date || body.date.trim() === '') {
      throw new Error('날짜가 필요합니다.');
    }
    if (!body.startTime || body.startTime.trim() === '') {
      throw new Error('시작 시간이 필요합니다.');
    }
    if (!body.endTime || body.endTime.trim() === '') {
      throw new Error('종료 시간이 필요합니다.');
    }
    if (!body.clientName || body.clientName.trim() === '') {
      throw new Error('내담자 이름이 필요합니다.');
    }
    if (!body.sessionNumber || isNaN(body.sessionNumber)) {
      throw new Error('유효한 회기 번호가 필요합니다.');
    }
    
    // 기존 데이터에서 ID 찾기
    let rowIndex = -1;
    for (let i = 1; i < data.length; i++) {
      if (data[i][0] && data[i][0].toString() === body.id.toString()) {
        rowIndex = i + 1;
        break;
      }
    }
    
    // 행 데이터 준비 (헤더 순서대로)
    const rowData = [
      body.id.toString(),
      body.counselor.toString().trim(),
      body.date.toString().trim(),
      body.startTime.toString().trim(),
      body.endTime.toString().trim(),
      body.clientName.toString().trim(),
      parseInt(body.sessionNumber)
    ];
    
    if (rowIndex !== -1) {
      // 기존 데이터 수정
      sheet.getRange(rowIndex, 1, 1, rowData.length).setValues([rowData]);
      Logger.log('Updated row: ' + rowIndex + ', ID: ' + body.id);
    } else {
      // 새로운 데이터 추가
      sheet.appendRow(rowData);
      Logger.log('Added new row, ID: ' + body.id);
    }
    
    return ContentService.createTextOutput(JSON.stringify({ 
      result: "success", 
      action: rowIndex !== -1 ? "update" : "create",
      id: body.id
    }))
      .setMimeType(ContentService.MimeType.JSON);
      
  } catch (error) {
    Logger.log('doPost Error: ' + error.toString());
    Logger.log('Stack: ' + error.stack);
    
    return ContentService.createTextOutput(JSON.stringify({ 
      result: "error", 
      message: error.toString() 
    }))
      .setMimeType(ContentService.MimeType.JSON);
  } finally {
    lock.releaseLock();
  }
}

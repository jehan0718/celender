// Google Apps Script Backend for Counseling Schedule
// 이 코드를 구글 스프레드시트의 '확장 프로그램 > Apps Script'에 복사하여 붙여넣으세요.

const SPREADSHEET_ID = SpreadsheetApp.getActiveSpreadsheet().getId();
const SHEET_NAME = "Sheet1"; // 스프레드시트 하단의 시트 이름이 "Sheet1"인지 확인하세요.

/**
 * 전송된 데이터를 스프레드시트에서 읽어와서 JSON 형태로 반환합니다. (조회용)
 */
function doGet(e) {
  const sheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(SHEET_NAME);
  const data = sheet.getDataRange().getValues();
  const headers = data[0];
  const jsonRows = data.slice(1).map(row => {
    let obj = {};
    headers.forEach((header, i) => {
      obj[header] = row[i];
    });
    return obj;
  });
  
  return ContentService.createTextOutput(JSON.stringify(jsonRows))
    .setMimeType(ContentService.MimeType.JSON);
}

/**
 * 데이터를 추가, 수정 또는 삭제합니다. (저장/삭제용)
 */
function doPost(e) {
  const lock = LockService.getScriptLock();
  lock.tryLock(10000); // 10초 동안 동시 접속 제어 (데이터 덮어쓰기 방지)
  
  try {
    const sheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(SHEET_NAME);
    const body = JSON.parse(e.postData.contents);
    const data = sheet.getDataRange().getValues();
    
    if (body.action === 'delete') {
      // --- 삭제 로직 ---
      for (let i = 1; i < data.length; i++) {
        if (data[i][0].toString() === body.id.toString()) {
          sheet.deleteRow(i + 1);
          break;
        }
      }
    } else {
      // --- 수정 또는 추가 로직 ---
      let rowIndex = -1;
      // 기존 ID가 있는지 확인하여 있으면 수정, 없으면 추가
      for (let i = 1; i < data.length; i++) {
        if (data[i][0].toString() === body.id.toString()) {
          rowIndex = i + 1;
          break;
        }
      }
      
      const rowData = [
        body.id,
        body.counselor,
        body.date,
        body.startTime,
        body.endTime,
        body.clientName,
        body.sessionNumber
      ];
      
      if (rowIndex !== -1) {
        // 기존 데이터 수정
        sheet.getRange(rowIndex, 1, 1, rowData.length).setValues([rowData]);
      } else {
        // 새로운 데이터 추가
        sheet.appendRow(rowData);
      }
    }
    
    return ContentService.createTextOutput(JSON.stringify({ result: "success" }))
      .setMimeType(ContentService.MimeType.JSON);
      
  } catch (error) {
    return ContentService.createTextOutput(JSON.stringify({ result: "error", message: error.toString() }))
      .setMimeType(ContentService.MimeType.JSON);
  } finally {
    lock.releaseLock();
  }
}

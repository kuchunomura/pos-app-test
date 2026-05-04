// ===== POS レジ GAS スクリプト (test用) =====
const SS_ID = '1mVw1DN78bVr5SiWCUDZ2HlVhalgwH4bzi3UnlS1uTFY';

// 列構成 A(1)〜P(16):
// A:日時, B:売上合計, C:商品名, D:カテゴリ, E:数量, F:単価, G:小計,
// H:人数, I:割引, J:支払方法, K:年齢層, L:国籍, M:天気, N:メモ, O:売上ID, P:端末名
var HEADERS = ['日時','売上合計','商品名','カテゴリ','数量','単価','小計','人数','割引','支払方法','年齢層','国籍','天気','メモ','売上ID','端末名'];

// 集計列 (データ16列 + スペーサーQ(17) の後)
const SUMMARY_COL = 18; // R列: 商品別
const AGE_COL     = 23; // W列: 年齢層別
const NAT_COL     = 27; // AA列: 国籍別

// ==================== エントリーポイント ====================

function doGet(e) {
  try {
    var d = (e && e.parameter && e.parameter.d) ? JSON.parse(decodeURIComponent(e.parameter.d)) : null;
    if (!d) return ok();
    if (d.type === 'test') return ok();
    handleRequest(d);
    return ok();
  } catch(err) {
    return ContentService.createTextOutput(JSON.stringify({status:'error', message:err.message}))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

function doPost(e) {
  try {
    var d = (e && e.postData) ? JSON.parse(e.postData.contents) : null;
    if (!d) return ok();
    if (d.type === 'test') return ok();
    handleRequest(d);
    return ok();
  } catch(err) {
    return ContentService.createTextOutput(JSON.stringify({status:'error', message:err.message}))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

function ok() {
  return ContentService.createTextOutput(JSON.stringify({status:'ok'}))
    .setMimeType(ContentService.MimeType.JSON);
}

function handleRequest(data) {
  var type = data.type;
  if      (type === 'add_rows')     addRows(data.rows);
  else if (type === 'delete_rows')  deleteRows(data.sale_id);
  else if (type === 'replace_rows') replaceRows(data.sale_id, data.rows);
  else if (type === 'clear_sheets') clearSheets();
}

// ==================== シート名 ====================

function sheetNameFromRows(rows) {
  var dtStr = String(rows[0][0] || '');
  var slash = dtStr.indexOf('/');
  var space = dtStr.indexOf(' ');
  if (slash > 0 && space > slash) {
    return dtStr.substring(0, space) + '売上';
  }
  var now = new Date();
  return (now.getMonth()+1) + '/' + now.getDate() + '売上';
}

// ==================== ヘッダー設定 ====================

function getOrCreateSheet(ss, name) {
  return ss.getSheetByName(name) || ss.insertSheet(name);
}

function ensureHeaders(sheet) {
  // Row1・Row2は常に更新（B2入力値は触らない）
  setTotalsFormulas(sheet);
  setupCashInputRow(sheet);
  // Row3ヘッダーと固定行は初回のみ
  if (sheet.getFrozenRows() < 3) {
    var hRange = sheet.getRange(3, 1, 1, HEADERS.length);
    hRange.setValues([HEADERS]);
    hRange.setFontWeight('bold').setBackground('#f5f5f5').setHorizontalAlignment('center');
    sheet.setFrozenRows(3);
  }
}

// Row1: 集計計算式
function setTotalsFormulas(sheet) {
  sheet.getRange(1, 1, 1, 17).clearContent().clearFormat();

  // 総件数・総売上・総人数: 背景なし
  sheet.getRange(1, 1).setValue('総件数');
  sheet.getRange(1, 2).setFormula('=COUNTA(B4:B)');
  sheet.getRange(1, 3).setValue('総売上');
  sheet.getRange(1, 4).setFormula('=SUM(B4:B)');
  sheet.getRange(1, 4).setNumberFormat('#,##0');
  sheet.getRange(1, 5).setValue('総人数');
  sheet.getRange(1, 6).setFormula('=SUM(H4:H)');
  sheet.getRange(1, 1, 1, 6).setFontWeight('bold').setHorizontalAlignment('center');

  // クレジット: クレジット色
  sheet.getRange(1, 7).setValue('クレジット');
  sheet.getRange(1, 8).setFormula('=SUMIF(J4:J,"クレジットカード",B4:B)');
  sheet.getRange(1, 8).setNumberFormat('#,##0');
  sheet.getRange(1, 7, 1, 2).setFontWeight('bold').setBackground('#f0f8ff').setHorizontalAlignment('center');

  // 電子決済: 電子決済色
  sheet.getRange(1, 9).setValue('電子決済');
  sheet.getRange(1, 10).setFormula('=SUMIF(J4:J,"電子決済",B4:B)');
  sheet.getRange(1, 10).setNumberFormat('#,##0');
  sheet.getRange(1, 9, 1, 2).setFontWeight('bold').setBackground('#fdf5ff').setHorizontalAlignment('center');

  // 現金: 背景なし（白）
  sheet.getRange(1, 11).setValue('現金');
  sheet.getRange(1, 12).setFormula('=SUMIF(J4:J,"現金",B4:B)');
  sheet.getRange(1, 12).setNumberFormat('#,##0');
  sheet.getRange(1, 11, 1, 2).setFontWeight('bold').setHorizontalAlignment('center');
}

// Row2: レジ現金入力行
function setupCashInputRow(sheet) {
  sheet.getRange(2, 1, 1, 5).setHorizontalAlignment('center');
  sheet.getRange(2, 1).setValue('全レジ現金-売上現金（手入力）').setFontWeight('bold');
  sheet.getRange(2, 2).setBackground('#fff9c4').setFontWeight('bold');
  // C2: 全レジ現金 − 現金売上 = 差額
  sheet.getRange(2, 3).setFormula('=IF(B2="","",B2-SUMIF(J4:J,"現金",B4:B))');
  sheet.getRange(2, 3).setNumberFormat('+#,##0;-#,##0;');
  // D2: ラベル, E2: 対10万差額（ゼロ=0、常に赤太字）
  sheet.getRange(2, 4).setValue('対10万差額').setFontWeight('bold');
  sheet.getRange(2, 5).setFormula('=IF(B2="","",B2-100000)');
  sheet.getRange(2, 5).setNumberFormat('+#,##0;-#,##0;0').setFontColor('#B22222').setFontWeight('bold');
}

// ==================== 行操作 ====================

function addRows(rows) {
  if (!rows || !rows.length) return;
  var ss = SpreadsheetApp.openById(SS_ID);
  var sheetName = sheetNameFromRows(rows);
  var sheet = getOrCreateSheet(ss, sheetName);
  ensureHeaders(sheet);

  var lastRow = sheet.getLastRow();
  var startRow = Math.max(lastRow + 1, 4);
  var colCount = rows[0].length;

  sheet.getRange(startRow, 1, rows.length, colCount).setValues(rows);
  sheet.getRange(startRow, 1, rows.length, colCount).setHorizontalAlignment('center');

  for (var i = 0; i < rows.length; i++) {
    applyPaymentColors(sheet, startRow + i, rows[i][9]); // J列(index9): 支払方法
  }

  applyGroupBorders(sheet, startRow, rows.length, colCount);
  SpreadsheetApp.flush();
  setDataColumnWidths(sheet);
  updateSummary(sheet);
}

function replaceRows(saleId, rows) {
  if (!saleId) return;
  var ss = SpreadsheetApp.openById(SS_ID);
  var sheets = ss.getSheets();
  for (var i = 0; i < sheets.length; i++) {
    deleteRowsFromSheet(sheets[i], saleId);
  }
  if (rows && rows.length) addRows(rows);
}

function deleteRows(saleId) {
  if (!saleId) return;
  var ss = SpreadsheetApp.openById(SS_ID);
  var sheets = ss.getSheets();
  for (var i = 0; i < sheets.length; i++) {
    deleteRowsFromSheet(sheets[i], saleId);
  }
}

function deleteRowsFromSheet(sheet, saleId) {
  var lastRow = sheet.getLastRow();
  if (lastRow < 4) return false;
  var idCol = 15; // O列: 売上ID
  var vals = sheet.getRange(4, idCol, lastRow - 3, 1).getValues();
  var toDelete = [];
  for (var i = 0; i < vals.length; i++) {
    if (String(vals[i][0]) === String(saleId)) toDelete.push(4 + i);
  }
  for (var j = toDelete.length - 1; j >= 0; j--) {
    sheet.deleteRow(toDelete[j]);
  }
  if (toDelete.length > 0) updateSummary(sheet);
  return toDelete.length > 0;
}

function clearSheets() {
  var ss = SpreadsheetApp.openById(SS_ID);
  var sheets = ss.getSheets();
  for (var s = 0; s < sheets.length; s++) {
    var sheet = sheets[s];
    var lastRow = sheet.getLastRow();
    if (lastRow >= 4) sheet.deleteRows(4, lastRow - 3);
    sheet.setFrozenRows(0);
    setTotalsFormulas(sheet);
    setupCashInputRow(sheet);
    var hRange = sheet.getRange(3, 1, 1, HEADERS.length);
    hRange.setValues([HEADERS]).setFontWeight('bold').setBackground('#f5f5f5').setHorizontalAlignment('center');
    sheet.setFrozenRows(3);
    setDataColumnWidths(sheet);
    updateSummary(sheet);
  }
}

// ==================== 書式 ====================

function setDataColumnWidths(sheet) {
  sheet.setColumnWidth(1,  240);  // A: 日時 + Row2ラベル
  sheet.setColumnWidth(2,   85);  // B: 売上合計
  sheet.setColumnWidth(3,  150);  // C: 商品名
  sheet.setColumnWidth(4,  100);  // D: カテゴリ
  sheet.setColumnWidth(5,   65);  // E: 数量
  sheet.setColumnWidth(6,   70);  // F: 単価
  sheet.setColumnWidth(7,   85);  // G: 小計
  sheet.setColumnWidth(8,   55);  // H: 人数
  sheet.setColumnWidth(9,  100);  // I: 割引
  sheet.setColumnWidth(10, 130);  // J: 支払方法
  sheet.setColumnWidth(11, 125);  // K: 年齢層
  sheet.setColumnWidth(12,  85);  // L: 国籍
  sheet.setColumnWidth(13,  60);  // M: 天気
  sheet.setColumnWidth(14, 120);  // N: メモ
  sheet.setColumnWidth(15, 155);  // O: 売上ID
  sheet.setColumnWidth(16,  80);  // P: 端末名
  sheet.setColumnWidth(17,  20);  // Q: スペーサー
}

function setSummaryColumnWidths(sheet) {
  sheet.setColumnWidth(18, 150);  // R: 商品名
  sheet.setColumnWidth(19, 100);  // S: カテゴリ
  sheet.setColumnWidth(20,  60);  // T: 数量
  sheet.setColumnWidth(21,  90);  // U: 金額合計
  sheet.setColumnWidth(22,  20);  // V: スペーサー
  sheet.setColumnWidth(23,  80);  // W: 年齢層
  sheet.setColumnWidth(24,  90);  // X: 件数（組）
  sheet.setColumnWidth(25,  60);  // Y: 人数
  sheet.setColumnWidth(26,  20);  // Z: スペーサー
  sheet.setColumnWidth(27,  80);  // AA: 国籍
  sheet.setColumnWidth(28,  90);  // AB: 件数（組）
  sheet.setColumnWidth(29,  60);  // AC: 人数
}

function applyGroupBorders(sheet, startRow, rowCount, colCount) {
  var range = sheet.getRange(startRow, 1, rowCount, colCount);
  range.setBorder(true, true, true, true, false, null, '#999999', SpreadsheetApp.BorderStyle.SOLID);
  range.setBorder(true, true, true, true, null,  null, '#333333', SpreadsheetApp.BorderStyle.SOLID_MEDIUM);
}

function applyPaymentColors(sheet, row, payment) {
  if (payment === 'クレジットカード') {
    sheet.getRange(row, 1, 1, 16).setBackground('#f0f8ff');
  } else if (payment === '電子決済') {
    sheet.getRange(row, 1, 1, 16).setBackground('#fdf5ff');
  }
}

// ==================== 集計テーブル ====================

function updateSummary(sheet) {
  var lastDataRow = sheet.getLastRow();
  var clearRows = Math.max(lastDataRow, 10);
  sheet.getRange(1, SUMMARY_COL, clearRows, 12).clearContent().clearFormat();

  if (lastDataRow < 4) {
    SpreadsheetApp.flush();
    setSummaryColumnWidths(sheet);
    return;
  }

  var data = sheet.getRange(4, 1, lastDataRow - 3, 16).getValues();

  var itemMap = {};
  var ageMap  = {};
  var natMap  = {};
  var txSeen  = {};

  for (var i = 0; i < data.length; i++) {
    var r        = data[i];
    var itemName = r[2];   // C: 商品名
    var qty      = r[4];   // E: 数量
    var unitPrice= r[5];   // F: 単価
    var cat      = r[3];   // D: カテゴリ
    var jinzu    = r[7];   // H: 人数
    var ageStr   = r[10];  // K: 年齢層
    var natStr   = r[11];  // L: 国籍
    var txId     = r[14];  // O: 売上ID

    if (itemName) {
      var mKey = itemName + '\t' + cat;
      if (!itemMap[mKey]) itemMap[mKey] = {name: itemName, cat: cat, qty: 0, total: 0};
      itemMap[mKey].qty   += (Number(qty)       || 0);
      itemMap[mKey].total += (Number(unitPrice)  || 0) * (Number(qty) || 0);
    }

    if (txId && !txSeen[txId]) {
      txSeen[txId] = true;
      var people = Number(jinzu) || 0;

      if (ageStr) {
        var ages = String(ageStr).split('・');
        for (var a = 0; a < ages.length; a++) {
          var age = ages[a].trim();
          if (!age) continue;
          if (!ageMap[age]) ageMap[age] = {groups: 0, people: 0};
          ageMap[age].groups++;
          ageMap[age].people += people;
        }
      }

      if (natStr) {
        var nats = String(natStr).split('・');
        for (var n = 0; n < nats.length; n++) {
          var nat = nats[n].trim();
          if (!nat) continue;
          if (!natMap[nat]) natMap[nat] = {groups: 0, people: 0};
          natMap[nat].groups++;
          natMap[nat].people += people;
        }
      }
    }
  }

  var hBg = '#e8f5e9';

  // --- 商品別 (R列=18) ---
  var row = 1;
  sheet.getRange(row, SUMMARY_COL, 1, 4)
    .setValues([['商品名','カテゴリ','数量','金額合計']])
    .setBackground(hBg).setFontWeight('bold').setHorizontalAlignment('center');
  row++;
  var iKeys = Object.keys(itemMap);
  for (var k = 0; k < iKeys.length; k++) {
    var v = itemMap[iKeys[k]];
    sheet.getRange(row, SUMMARY_COL, 1, 4)
      .setValues([[v.name, v.cat, v.qty, v.total]])
      .setHorizontalAlignment('center');
    row++;
  }

  // --- 年齢層別 (W列=23) ---
  var aRow = 1;
  sheet.getRange(aRow, AGE_COL, 1, 3)
    .setValues([['年齢層','件数（組）','人数']])
    .setBackground(hBg).setFontWeight('bold').setHorizontalAlignment('center');
  aRow++;
  var aKeys = Object.keys(ageMap);
  for (var k = 0; k < aKeys.length; k++) {
    var v = ageMap[aKeys[k]];
    sheet.getRange(aRow, AGE_COL, 1, 3)
      .setValues([[aKeys[k], v.groups, v.people]])
      .setHorizontalAlignment('center');
    aRow++;
  }

  // --- 国籍別 (AA列=27) ---
  var nRow = 1;
  sheet.getRange(nRow, NAT_COL, 1, 3)
    .setValues([['国籍','件数（組）','人数']])
    .setBackground(hBg).setFontWeight('bold').setHorizontalAlignment('center');
  nRow++;
  var nKeys = Object.keys(natMap);
  for (var k = 0; k < nKeys.length; k++) {
    var v = natMap[nKeys[k]];
    sheet.getRange(nRow, NAT_COL, 1, 3)
      .setValues([[nKeys[k], v.groups, v.people]])
      .setHorizontalAlignment('center');
    nRow++;
  }

  SpreadsheetApp.flush();
  setSummaryColumnWidths(sheet);
}

const fs = require('fs');
const path = require('path');

function updateJson(filePath, updater) {
  const fullPath = path.join(__dirname, filePath);
  let obj = JSON.parse(fs.readFileSync(fullPath, 'utf8'));
  updater(obj);
  fs.writeFileSync(fullPath, JSON.stringify(obj, null, 2) + '\n');
}

function updateLocales() {
  const locales = ['en.json', 'id.json', 'zh.json'];
  locales.forEach(loc => {
    updateJson(`apps/web/messages/${loc}`, (obj) => {
      // Disciplinary
      if (obj.hr && obj.hr.disciplinary) {
        if (!obj.hr.disciplinary.statusIssued) {
          if (loc === 'id.json') obj.hr.disciplinary.statusIssued = 'Diterbitkan';
          else if (loc === 'zh.json') obj.hr.disciplinary.statusIssued = '已发布';
          else obj.hr.disciplinary.statusIssued = 'Issued';
        }
        if (!obj.hr.disciplinary.statusAcknowledged) {
          if (loc === 'id.json') obj.hr.disciplinary.statusAcknowledged = 'Ditekankan';
          else if (loc === 'zh.json') obj.hr.disciplinary.statusAcknowledged = '已确认';
          else obj.hr.disciplinary.statusAcknowledged = 'Acknowledged';
        }
        if (!obj.hr.disciplinary.statusEscalated) {
          if (loc === 'id.json') obj.hr.disciplinary.statusEscalated = 'Dieselakan';
          else if (loc === 'zh.json') obj.hr.disciplinary.statusEscalated = '已升级';
          else obj.hr.disciplinary.statusEscalated = 'Escalated';
        }
      } else if (obj.disciplinary) {
        if (!obj.disciplinary.statusIssued) {
          if (loc === 'id.json') obj.disciplinary.statusIssued = 'Diterbitkan';
          else if (loc === 'zh.json') obj.disciplinary.statusIssued = '已发布';
          else obj.disciplinary.statusIssued = 'Issued';
        }
        if (!obj.disciplinary.statusAcknowledged) {
          if (loc === 'id.json') obj.disciplinary.statusAcknowledged = 'Ditekankan';
          else if (loc === 'zh.json') obj.disciplinary.statusAcknowledged = '已确认';
          else obj.disciplinary.statusAcknowledged = 'Acknowledged';
        }
        if (!obj.disciplinary.statusEscalated) {
          if (loc === 'id.json') obj.disciplinary.statusEscalated = 'Dieselakan';
          else if (loc === 'zh.json') obj.disciplinary.statusEscalated = '已升级';
          else obj.disciplinary.statusEscalated = 'Escalated';
        }
      }
      
      // Purchasing GRN Report
      if (!obj.purchasing) obj.purchasing = {};
      if (!obj.purchasing.grnReport) obj.purchasing.grnReport = {};
      if (!obj.purchasing.grnReport.allLocations) {
        if (loc === 'id.json') obj.purchasing.grnReport.allLocations = 'Semua Lokasi';
        else if (loc === 'zh.json') obj.purchasing.grnReport.allLocations = '所有地点';
        else obj.purchasing.grnReport.allLocations = 'All Locations';
      }

      // PO filter table
      if (!obj.purchasing.poList) obj.purchasing.poList = {};
      if (!obj.purchasing.poList.statusDraft) obj.purchasing.poList.statusDraft = 'Draft';
      if (!obj.purchasing.poList.statusSubmitted) {
        if (loc === 'id.json') obj.purchasing.poList.statusSubmitted = 'Diajukan';
        else if (loc === 'zh.json') obj.purchasing.poList.statusSubmitted = '已提交';
        else obj.purchasing.poList.statusSubmitted = 'Submitted';
      }
      if (!obj.purchasing.poList.statusApproved) {
        if (loc === 'id.json') obj.purchasing.poList.statusApproved = 'Disetujui';
        else if (loc === 'zh.json') obj.purchasing.poList.statusApproved = '已批准';
        else obj.purchasing.poList.statusApproved = 'Approved';
      }
      if (!obj.purchasing.poList.statusPartial) {
        if (loc === 'id.json') obj.purchasing.poList.statusPartial = 'Parsial';
        else if (loc === 'zh.json') obj.purchasing.poList.statusPartial = '部分';
        else obj.purchasing.poList.statusPartial = 'Partial';
      }
      if (!obj.purchasing.poList.statusReceived) {
        if (loc === 'id.json') obj.purchasing.poList.statusReceived = 'Diterima';
        else if (loc === 'zh.json') obj.purchasing.poList.statusReceived = '已接收';
        else obj.purchasing.poList.statusReceived = 'Received';
      }
      if (!obj.purchasing.poList.statusClosed) {
        if (loc === 'id.json') obj.purchasing.poList.statusClosed = 'Ditutup';
        else if (loc === 'zh.json') obj.purchasing.poList.statusClosed = '已关闭';
        else obj.purchasing.poList.statusClosed = 'Closed';
      }
      if (!obj.purchasing.poList.statusCancelled) {
        if (loc === 'id.json') obj.purchasing.poList.statusCancelled = 'Dibatalkan';
        else if (loc === 'zh.json') obj.purchasing.poList.statusCancelled = '已取消';
        else obj.purchasing.poList.statusCancelled = 'Cancelled';
      }
    });
  });
}

function updateReactFiles() {
  // 1. disciplinary-client.tsx
  let discPath = path.join(__dirname, 'apps/web/app/(dash)/hr/disciplinary/disciplinary-client.tsx');
  let discContent = fs.readFileSync(discPath, 'utf8');
  discContent = discContent.replace('<option value="issued">Diterbitkan</option>', '<option value="issued">{t(\'statusIssued\')}</option>');
  discContent = discContent.replace('<option value="acknowledged">Ditekankan</option>', '<option value="acknowledged">{t(\'statusAcknowledged\')}</option>');
  discContent = discContent.replace('<option value="escalated">Dieselakan</option>', '<option value="escalated">{t(\'statusEscalated\')}</option>');
  fs.writeFileSync(discPath, discContent);

  // 2. grn-report/page.tsx
  let grnPath = path.join(__dirname, 'apps/web/app/(dash)/purchasing/grn-report/page.tsx');
  let grnContent = fs.readFileSync(grnPath, 'utf8');
  grnContent = grnContent.replace('<option value="">Semua Lokasi</option>', '<option value="">{t(\'allLocations\')}</option>');
  fs.writeFileSync(grnPath, grnContent);

  // 3. po-filter-table.tsx
  let poPath = path.join(__dirname, 'apps/web/app/(dash)/purchasing/po-filter-table.tsx');
  let poContent = fs.readFileSync(poPath, 'utf8');
  poContent = poContent.replace('<option value="draft">Draft</option>', '<option value="draft">{t(\'statusDraft\')}</option>');
  poContent = poContent.replace('<option value="submitted">Submitted</option>', '<option value="submitted">{t(\'statusSubmitted\')}</option>');
  poContent = poContent.replace('<option value="approved">Approved</option>', '<option value="approved">{t(\'statusApproved\')}</option>');
  poContent = poContent.replace('<option value="partial">Partial</option>', '<option value="partial">{t(\'statusPartial\')}</option>');
  poContent = poContent.replace('<option value="received">Received</option>', '<option value="received">{t(\'statusReceived\')}</option>');
  poContent = poContent.replace('<option value="closed">Closed</option>', '<option value="closed">{t(\'statusClosed\')}</option>');
  poContent = poContent.replace('<option value="cancelled">Cancelled</option>', '<option value="cancelled">{t(\'statusCancelled\')}</option>');
  fs.writeFileSync(poPath, poContent);
}

try {
  updateLocales();
  updateReactFiles();
  console.log('i18n updated successfully');
} catch (e) {
  console.error(e);
}

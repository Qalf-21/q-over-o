'use strict';

const { asyncHandler } = require('../utils/errorHandler');
const { generateReport } = require('../services/reportService');
const { ROUTE_TO_REPORT_TYPE } = require('../services/reportQueryBuilder');

const handleReport = (routeKey) => asyncHandler(async (req, res) => {
  const type = ROUTE_TO_REPORT_TYPE[routeKey];
  const data = await generateReport(type, req.query, req.user);
  res.json({ success: true, data });
});

module.exports = {
  getTuteeSessionHistory: handleReport('tutee/sessions'),
  getTuteeWalletSpending: handleReport('tutee/wallet'),
  getTutorEarnings: handleReport('tutor/earnings'),
  getTutorPerformance: handleReport('tutor/performance'),
  getAdminRevenue: handleReport('admin/revenue'),
  getAdminWallet: handleReport('admin/wallet'),
  getAdminSessions: handleReport('admin/sessions'),
  getAdminUsers: handleReport('admin/users'),
  getAdminExceptions: handleReport('admin/exceptions'),
  getAdminSubjects: handleReport('admin/subjects'),
  getAdminReviews: handleReport('admin/reviews'),
  getAdminQualifications: handleReport('admin/qualifications'),
};

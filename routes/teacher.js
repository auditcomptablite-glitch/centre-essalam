<%
  var presentCount = 0;
  var absentCount = 0;
  var lateCount = 0;

  // Calcul des compteurs avec nettoyage des espaces (trim) pour éviter les décalages
  if (attendanceList && attendanceList.length > 0) {
    for (var i = 0; i < attendanceList.length; i++) {
      var status = attendanceList[i].status ? attendanceList[i].status.trim() : '';
      if (status === 'حاضر') presentCount++;
      else if (status === 'غائب') absentCount++;
      else if (status === 'متأخر') lateCount++;
    }
  }
%>
<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title><%= title %> | مركز دروس الدعم</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link href="https://fonts.googleapis.com/css2?family=Cairo:wght@300;400;500;600;700;800&family=Tajawal:wght@300;400;500;700&display=swap" rel="stylesheet">
  <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.0/css/all.min.css">
  <link rel="stylesheet" href="/css/main.css">
</head>
<body>

<% if (user) { %>
<nav class="navbar">
  <div class="nav-brand">
    <div class="brand-icon">🎓</div>
    <span>مركز دروس الدعم</span>
  </div>
  <div class="nav-links">
    <a href="/teacher/dashboard" class="nav-link"><i class="fas fa-home"></i> الرئيسية</a>
    <a href="/teacher/attendance-history" class="nav-link"><i class="fas fa-history"></i> سجل الحصص</a>
    <a href="/register" class="nav-link" target="_blank"><i class="fas fa-user-plus"></i> استمارة التسجيل</a>
  </div>
  <div class="nav-user">
    <span class="user-badge"><i class="fas fa-user-circle"></i> <%= user.name %></span>
    <a href="/auth/logout" class="btn-logout"><i class="fas fa-sign-out-alt"></i> خروج</a>
  </div>
</nav>
<% } %>

<main class="main-content <%= user ? 'with-nav' : '' %>">
  <% if (typeof error !== 'undefined' && error && error.length > 0) { %>
    <div class="alert alert-error">
      <i class="fas fa-exclamation-circle"></i>
      <%= Array.isArray(error) ? error[0] : error %>
    </div>
  <% } %>
  
  <% if (typeof success !== 'undefined' && success && success.length > 0) { %>
    <div class="alert alert-success">
      <i class="fas fa-check-circle"></i>
      <%= Array.isArray(success) ? success[0] : success %>
    </div>
  <% } %>

  <div class="page-header">
    <div>
      <div class="page-title"><i class="fas fa-clipboard-check" style="color: var(--primary-light)"></i> تفاصيل الحصة</div>
      <div class="page-subtitle"><%= session.subject_name %> - <%= session.level_name %></div>
    </div>
    <a href="/teacher/attendance-history" class="btn btn-outline">
      <i class="fas fa-arrow-right"></i> رجوع
    </a>
  </div>

  <div class="card" style="margin-bottom: 20px;">
    <div class="form-grid form-grid-3">
      <div>
        <div class="text-muted" style="font-size:12px;">المادة</div>
        <div class="fw-bold"><%= session.subject_name %></div>
      </div>
      <div>
        <div class="text-muted" style="font-size:12px;">المستوى</div>
        <div class="fw-bold"><%= session.level_name %></div>
      </div>
      <div>
        <div class="text-muted" style="font-size:12px;">التاريخ</div>
        <div class="fw-bold"><%= new Date(session.session_date).toLocaleDateString('ar-MA') %></div>
      </div>
    </div>
    <% if (session.notes) { %>
      <div style="margin-top:16px; padding-top:16px; border-top: 1px solid var(--border);">
        <span class="text-muted">ملاحظات: </span><%= session.notes %>
      </div>
    <% } %>
  </div>

  <div class="card">
    <div class="card-header">
      <div class="card-title"><i class="fas fa-users"></i> سجل الحضور (<%= attendanceList.length %> تلميذ)</div>
    </div>

    <div class="d-flex gap-2" style="margin-bottom: 16px; flex-wrap: wrap;">
      <span class="badge badge-present">✅ حاضر: <%= presentCount %></span>
      <span class="badge badge-absent">❌ غائب: <%= absentCount %></span>
      <span class="badge badge-late">⏰ متأخر: <%= lateCount %></span>
    </div>

    <% if (attendanceList.length === 0) { %>
      <div class="empty-state">
        <div class="empty-icon">📋</div>
        <div class="empty-title">لا يوجد سجل حضور لهذه الحصة</div>
        <p>لم يتم تسجيل أي تلميذ في هذه الحصة</p>
      </div>
    <% } else { %>
      <div class="table-wrapper">
        <table>
          <thead>
            <tr><th>اسم التلميذ</th><th>الهاتف</th><th>الحالة</th></tr>
          </thead>
          <tbody>
            <% attendanceList.forEach(function(a) { 
               var status = a.status ? a.status.trim() : '';
            %>
              <tr>
                <td><i class="fas fa-user-graduate"></i> <%= a.full_name %></td>
                <td><%= a.phone || '-' %></td>
                <td>
                  <% if (status === 'حاضر') { %>
                    <span class="badge badge-present">✅ حاضر</span>
                  <% } else if (status === 'غائب') { %>
                    <span class="badge badge-absent">❌ غائب</span>
                  <% } else if (status === 'متأخر') { %>
                    <span class="badge badge-late">⏰ متأخر</span>
                  <% } else { %>
                    <span class="badge"><%= status %></span>
                  <% } %>
                </td>
              </tr>
            <% }); %>
          </tbody>
        </table>
      </div>
    <% } %>
  </div>
</main>

<script src="/js/main.js"></script>
</body>
</html>
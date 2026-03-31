// ============================================
// مركز دروس الدعم - JavaScript الرئيسي
// ============================================

// إغلاق التنبيهات تلقائياً
document.addEventListener('DOMContentLoaded', () => {
  const alerts = document.querySelectorAll('.alert');
  alerts.forEach(alert => {
    setTimeout(() => {
      alert.style.transition = 'opacity 0.5s, transform 0.5s';
      alert.style.opacity = '0';
      alert.style.transform = 'translateY(-10px)';
      setTimeout(() => alert.remove(), 500);
    }, 4000);
  });

  // تفعيل رابط Nav النشط
  const currentPath = window.location.pathname;
  document.querySelectorAll('.nav-link').forEach(link => {
    if (link.getAttribute('href') === currentPath) {
      link.classList.add('active');
    }
  });
});

// ============ أزرار الحضور ============
function initAttendanceBtns() {
  document.querySelectorAll('.attendance-options').forEach(optGroup => {
    const btns = optGroup.querySelectorAll('.att-btn');
    btns.forEach(btn => {
      btn.addEventListener('click', () => {
        btns.forEach(b => b.classList.remove('selected'));
        btn.classList.add('selected');
        const hiddenInput = optGroup.nextElementSibling;
        if (hiddenInput) hiddenInput.value = btn.dataset.status;
      });
    });
    // اختيار "حاضر" افتراضياً
    const presentBtn = optGroup.querySelector('[data-status="حاضر"]');
    if (presentBtn) presentBtn.click();
  });
}

// ============ تحميل التلاميذ ديناميكياً ============
async function loadStudents(subjectId, levelId, containerId) {
  const container = document.getElementById(containerId);
  if (!container) return;

  if (!subjectId || !levelId) {
    container.innerHTML = '<p class="text-muted text-center mt-4"><i class="fas fa-info-circle"></i> اختر المادة والمستوى لعرض قائمة التلاميذ</p>';
    return;
  }

  container.innerHTML = '<p class="text-center mt-4"><i class="fas fa-spinner fa-spin"></i> جار التحميل...</p>';

  try {
    const res = await fetch(`/teacher/students?subject_id=${subjectId}&level_id=${levelId}`);
    const data = await res.json();

    if (!data.students || data.students.length === 0) {
      container.innerHTML = `
        <div class="empty-state">
          <div class="empty-icon">📋</div>
          <div class="empty-title">لا يوجد تلاميذ مسجلون</div>
          <p>لم يسجل أي تلميذ في هذه المادة والمستوى المحدد</p>
        </div>`;
      return;
    }

    let html = `<div class="attendance-list">`;
    data.students.forEach(student => {
      html += `
        <div class="attendance-row">
          <div>
            <div class="student-name"><i class="fas fa-user-graduate"></i> ${student.full_name}</div>
            ${student.phone ? `<div class="student-phone"><i class="fas fa-phone"></i> ${student.phone}</div>` : ''}
          </div>
          <div class="attendance-options">
            <button type="button" class="att-btn" data-status="حاضر">✅ حاضر</button>
            <button type="button" class="att-btn" data-status="غائب">❌ غائب</button>
            <button type="button" class="att-btn" data-status="متأخر">⏰ متأخر</button>
          </div>
          <input type="hidden" name="attendance[${student.id}]" value="حاضر">
        </div>`;
    });
    html += `</div>`;
    container.innerHTML = html;
    initAttendanceBtns();
  } catch (err) {
    container.innerHTML = '<p class="text-danger text-center">حدث خطأ في تحميل البيانات</p>';
  }
}

// ============ Modal ============
function openModal(id) {
  document.getElementById(id)?.classList.add('active');
}
function closeModal(id) {
  document.getElementById(id)?.classList.remove('active');
}
document.addEventListener('click', (e) => {
  if (e.target.classList.contains('modal-overlay')) {
    e.target.classList.remove('active');
  }
});

// ============ تأكيد الحذف ============
function confirmDelete(formId, name) {
  if (confirm(`هل أنت متأكد من حذف "${name}"؟ لا يمكن التراجع عن هذا الإجراء.`)) {
    document.getElementById(formId)?.submit();
  }
}

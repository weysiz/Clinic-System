/* CarePoint Clinic CCRMS - front-end demonstration only. */
(() => {
  'use strict';

  const STORAGE_KEY = 'carepoint-ccrms-demo-v1';
  const PAGE_SIZE = 8;
  const ROLES = ['Administrator', 'Doctor', 'Nurse', 'Receptionist'];
  const ROLE_PAGES = {
    Administrator: ['dashboard', 'patients', 'consultations', 'appointments', 'reports'],
    Doctor: ['dashboard', 'patients', 'consultations', 'appointments', 'reports'],
    Nurse: ['dashboard', 'patients', 'consultations', 'appointments'],
    Receptionist: ['dashboard', 'patients', 'appointments', 'reports']
  };
  const state = {
    data: { patients: [], consultations: [], appointments: [] },
    role: 'Administrator',
    page: 'dashboard',
    recordPatientId: null,
    recordTab: 'overview',
    appointmentView: 'all',
    pageNumbers: { patients: 1, consultations: 1, appointments: 1 },
    reportFrom: '',
    reportTo: ''
  };
  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => Array.from(root.querySelectorAll(selector));
  const el = (id) => document.getElementById(id);

  function localDateTimeValue(date = new Date()) {
    return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
  }
  function escapeHtml(value) {
    return String(value == null ? '' : value).replace(/[&<>"']/g, (character) => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    })[character]);
  }
  function dateKey(date) {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  }
  function today() { return dateKey(new Date()); }
  function formatDate(value, options = { year: 'numeric', month: 'short', day: 'numeric' }) {
    if (!value) return '—';
    const date = new Date(`${value.slice(0, 10)}T00:00:00`);
    return Number.isNaN(date.getTime()) ? '—' : date.toLocaleDateString(undefined, options);
  }
  function formatDateTime(value) {
    if (!value) return '—';
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? '—' : date.toLocaleString(undefined, { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' });
  }
  function initials(name) {
    return String(name || '?').trim().split(/\s+/).slice(0, 2).map((part) => part[0] || '').join('').toUpperCase();
  }
  function calculateAge(dateOfBirth) {
    if (!dateOfBirth) return '';
    const birth = new Date(`${dateOfBirth}T00:00:00`);
    if (Number.isNaN(birth.getTime())) return '';
    const now = new Date();
    let age = now.getFullYear() - birth.getFullYear();
    if (now.getMonth() < birth.getMonth() || (now.getMonth() === birth.getMonth() && now.getDate() < birth.getDate())) age -= 1;
    return age >= 0 ? age : '';
  }
  function bmi(height, weight) {
    const heightMeters = Number(height) / 100;
    const weightKg = Number(weight);
    return heightMeters > 0 && weightKg > 0 ? (weightKg / (heightMeters * heightMeters)).toFixed(1) : '';
  }
  function showToast(message, type = 'success') {
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.setAttribute('role', type === 'error' ? 'alert' : 'status');
    toast.textContent = message;
    el('toastRegion').append(toast);
    window.setTimeout(() => toast.remove(), 3800);
  }
  function safeSave() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state.data));
      return true;
    } catch (error) {
      console.error('Unable to save CarePoint demonstration data.', error);
      return false;
    }
  }
  function validData(value) {
    return value && typeof value === 'object' &&
      Array.isArray(value.patients) && Array.isArray(value.consultations) &&
      Array.isArray(value.appointments) &&
      value.patients.every((item) => item && typeof item.id === 'string' && typeof item.name === 'string') &&
      value.consultations.every((item) => item && typeof item.id === 'string' && typeof item.patientId === 'string' && typeof item.dateTime === 'string') &&
      value.appointments.every((item) => item && typeof item.id === 'string' && typeof item.patientId === 'string' && typeof item.dateTime === 'string');
  }
  function loadData() {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (!saved) return;
      const parsed = JSON.parse(saved);
      if (!validData(parsed)) {
        console.warn('Stored CarePoint data has an invalid shape and was ignored.');
        showToast('Saved demo data was invalid and has been safely ignored.', 'error');
        return;
      }
      state.data = parsed;
    } catch (error) {
      console.error('Unable to read CarePoint demonstration data.', error);
      showToast('Saved demo data could not be read. You can continue with an empty workspace.', 'error');
    }
  }
  function makeId(prefix, collection) {
    let id;
    do {
      id = `${prefix}-${String(Date.now()).slice(-6)}${Math.floor(Math.random() * 90 + 10)}`;
    } while (collection.some((item) => item.id === id));
    return id;
  }
  function patientById(id) { return state.data.patients.find((patient) => patient.id === id); }
  function consultationsFor(patientId) {
    return state.data.consultations.filter((item) => item.patientId === patientId)
      .sort((a, b) => String(b.dateTime).localeCompare(String(a.dateTime)));
  }
  function canWriteClinical() { return state.role === 'Administrator' || state.role === 'Doctor'; }
  function canManagePatients() { return ['Administrator', 'Receptionist', 'Nurse'].includes(state.role); }
  function canManageAppointments() { return ['Administrator', 'Receptionist', 'Nurse'].includes(state.role); }
  function canManageData() { return state.role === 'Administrator'; }
  function openModal(title, content, options = {}) {
    const modal = el('modalDialog');
    modal.classList.toggle('modal-wide', Boolean(options.wide));
    el('modalTitle').textContent = title;
    el('modalEyebrow').textContent = options.eyebrow || 'CAREPOINT CLINIC';
    el('modalBody').innerHTML = content;
    el('modalBackdrop').hidden = false;
    document.body.classList.add('modal-open');
    modal.focus();
    const first = $('input,select,textarea,button', el('modalBody'));
    if (first) first.focus();
  }
  function closeModal() {
    el('modalBackdrop').hidden = true;
    document.body.classList.remove('modal-open');
    el('modalBody').innerHTML = '';
  }
  function confirmation(title, message, confirmLabel, onConfirm, danger = false) {
    openModal(title, `<p class="confirm-copy">${escapeHtml(message)}</p>
      <div class="modal-actions"><button class="button button-secondary" type="button" data-modal-cancel>Keep</button>
      <button class="button ${danger ? 'button-danger' : 'button-primary'}" type="button" id="confirmAction">${escapeHtml(confirmLabel)}</button></div>`);
    $('#confirmAction').addEventListener('click', () => { closeModal(); onConfirm(); });
  }
  function field(label, name, value = '', type = 'text', options = {}) {
    const required = options.required ? ' required' : '';
    const requiredMark = options.required ? ' <span class="required" aria-hidden="true">*</span>' : '';
    let input;
    if (options.select) {
      input = `<select id="${escapeHtml(name)}" name="${escapeHtml(name)}"${required}>${options.select.map((choice) =>
        `<option value="${escapeHtml(choice.value)}"${String(value) === String(choice.value) ? ' selected' : ''}>${escapeHtml(choice.label)}</option>`).join('')}</select>`;
    } else if (options.textarea) {
      input = `<textarea id="${escapeHtml(name)}" name="${escapeHtml(name)}" rows="${options.rows || 3}"${required}>${escapeHtml(value)}</textarea>`;
    } else {
      input = `<input id="${escapeHtml(name)}" name="${escapeHtml(name)}" type="${type}" value="${escapeHtml(value)}"${options.readonly ? ' readonly' : ''}${options.min != null ? ` min="${options.min}"` : ''}${options.max != null ? ` max="${options.max}"` : ''}${options.step ? ` step="${options.step}"` : ''}${required}>`;
    }
    return `<div class="form-field${options.full ? ' full' : ''}"><label for="${escapeHtml(name)}">${escapeHtml(label)}${requiredMark}</label>${input}${options.hint ? `<small class="field-hint">${escapeHtml(options.hint)}</small>` : ''}</div>`;
  }
  function sectionTitle(text) { return `<div class="form-section-title">${escapeHtml(text)}</div>`; }
  function patientChoices(selected = '') {
    return state.data.patients.map((patient) => ({ value: patient.id, label: `${patient.id} · ${patient.name}` }));
  }
  function clinicianChoices(selected = '') {
    const names = [state.role === 'Doctor' ? 'Dr. Demo Clinician' : 'Dr. Demo Clinician', 'Nurse Demo User'];
    const choices = names.map((name) => ({ value: name, label: name }));
    if (selected && !choices.some((choice) => choice.value === selected)) choices.unshift({ value: selected, label: selected });
    return choices;
  }
  function refresh() {
    renderRole();
    renderDashboard();
    renderPatients();
    renderConsultations();
    renderAppointments();
    if (state.recordPatientId) renderRecord();
    renderReports();
  }

  function renderRole() {
    const pages = ROLE_PAGES[state.role] || ROLE_PAGES.Administrator;
    $$('.primary-nav [data-page]').forEach((button) => {
      button.hidden = !pages.includes(button.dataset.page);
      button.classList.toggle('active', state.page === button.dataset.page);
    });
    $$('[data-navigate="consultations"]').forEach((button) => {
      button.hidden = !pages.includes('consultations');
    });
    $$('.clinician-action').forEach((button) => { button.hidden = !canWriteClinical(); });
    $$('.reception-action').forEach((button) => { button.hidden = !canManagePatients(); });
    $$('.admin-only').forEach((button) => { button.hidden = !canManageData(); });
    el('profileName').textContent = state.role === 'Administrator' ? 'Demo Administrator' : `Demo ${state.role}`;
    el('profileRole').textContent = state.role;
    el('profileAvatar').textContent = initials(state.role);
    el('greetingName').textContent = state.role;
  }
  function navigate(page) {
    const allowed = ROLE_PAGES[state.role] || ROLE_PAGES.Administrator;
    if (!allowed.includes(page) && page !== 'record') {
      showToast('This role does not have access to that section.', 'error');
      return;
    }
    state.page = page;
    $$('.page-section').forEach((section) => {
      const active = section.id === `page-${page}`;
      section.classList.toggle('active', active);
      section.hidden = !active;
    });
    renderRole();
    el('mainContent').focus({ preventScroll: true });
    window.scrollTo({ top: 0, behavior: 'smooth' });
    closeMobileMenu();
    if (page === 'record') renderRecord();
  }
  function renderDashboard() {
    const patients = state.data.patients;
    const consultations = state.data.consultations;
    const todayAppointments = state.data.appointments.filter((item) => item.dateTime.startsWith(today()) && item.status !== 'Cancelled');
    const awaiting = todayAppointments.filter((item) => item.status === 'Scheduled').length;
    const statData = [
      ['Total patients', patients.length, 'Registered patient profiles', '♙'],
      ['Total consultations', consultations.length, 'Clinical visits recorded', '▤'],
      ["Today's visits", todayAppointments.length, 'Appointments on today’s schedule', '▣'],
      ['Awaiting consultation', awaiting, 'Scheduled visits not yet completed', '◷']
    ];
    el('dashboardStats').innerHTML = statData.map(([label, count, note, icon]) =>
      `<article class="stat-card"><span class="stat-icon" aria-hidden="true">${icon}</span><div class="stat-label">${label}</div><div class="stat-number">${count}</div><div class="stat-note">${note}</div></article>`).join('');
    const newestPatients = [...patients].sort((a, b) => String(b.registeredAt).localeCompare(String(a.registeredAt))).slice(0, 5);
    el('recentPatients').innerHTML = miniList(newestPatients.map((patient) => ({
      name: patient.name, description: `${patient.id} · Demonstration Data · ${patient.sex || 'Sex not recorded'}`,
      date: formatDate(patient.registeredAt), initials: initials(patient.name),
      action: `data-open-record="${escapeHtml(patient.id)}"`
    })), 'No patients yet', 'Register a patient to get started.');
    const newestConsultations = [...consultations].sort((a, b) => String(b.dateTime).localeCompare(String(a.dateTime))).slice(0, 5);
    el('recentConsultations').innerHTML = miniList(newestConsultations.map((item) => ({
      name: patientById(item.patientId)?.name || 'Unknown patient',
      description: `${item.id} · Demonstration Data · ${item.diagnosis || item.complaint || 'Consultation'}`,
      date: formatDate(item.dateTime), initials: initials(patientById(item.patientId)?.name)
    })), 'No consultations yet', 'Clinical visits will appear here.');
    const schedule = todayAppointments.sort((a, b) => a.dateTime.localeCompare(b.dateTime)).slice(0, 5);
    el('dashboardSchedule').innerHTML = miniList(schedule.map((item) => ({
      name: patientById(item.patientId)?.name || 'Unknown patient',
      description: `${item.time || ''} · Demonstration Data · ${item.reason || 'Appointment'} · ${item.clinician || 'Unassigned'}`,
      date: statusBadge(item.status), initials: initials(patientById(item.patientId)?.name)
    })), 'No appointments today', 'New appointments for today will appear here.');
  }
  function miniList(items, emptyTitle, emptyText) {
    if (!items.length) return empty(emptyTitle, emptyText);
    return `<div class="mini-list">${items.map((item) => `<div class="mini-row"${item.action ? ` role="button" tabindex="0" ${item.action} aria-label="Open chart for ${escapeHtml(item.name)}"` : ''}><span class="mini-avatar" aria-hidden="true">${escapeHtml(item.initials)}</span><div class="mini-main"><strong>${escapeHtml(item.name)}</strong><small>${escapeHtml(item.description)}</small></div><span class="mini-date">${item.date}</span></div>`).join('')}</div>`;
  }
  function empty(title, text, action = '') {
    return `<div class="empty-state"><div class="empty-icon" aria-hidden="true">▱</div><strong>${escapeHtml(title)}</strong><p>${escapeHtml(text)}</p>${action}</div>`;
  }
  function statusBadge(status) {
    const className = String(status || 'neutral').toLowerCase().replace(/[^a-z-]/g, '-');
    return `<span class="badge ${className}">${escapeHtml(status || '—')}</span>`;
  }
  function paged(items, type) {
    const page = state.pageNumbers[type] || 1;
    const pages = Math.max(1, Math.ceil(items.length / PAGE_SIZE));
    state.pageNumbers[type] = Math.min(page, pages);
    return { items: items.slice((state.pageNumbers[type] - 1) * PAGE_SIZE, state.pageNumbers[type] * PAGE_SIZE), pages, page: state.pageNumbers[type] };
  }
  function renderPagination(containerId, type, pages, page) {
    if (pages <= 1) { el(containerId).innerHTML = ''; return; }
    el(containerId).innerHTML = `<button class="page-button" data-page-number="${page - 1}" data-page-type="${type}" ${page === 1 ? 'disabled' : ''}>←</button>${Array.from({ length: pages }, (_, index) => `<button class="page-button${page === index + 1 ? ' active' : ''}" data-page-number="${index + 1}" data-page-type="${type}" aria-label="Page ${index + 1}" ${page === index + 1 ? 'aria-current="page"' : ''}>${index + 1}</button>`).join('')}<button class="page-button" data-page-number="${page + 1}" data-page-type="${type}" ${page === pages ? 'disabled' : ''}>→</button>`;
  }
  function renderPatients() {
    if (!el('patientsTable')) return;
    const query = (el('patientSearch')?.value || '').trim().toLowerCase();
    const sex = el('patientSexFilter')?.value || '';
    const sort = el('patientSort')?.value || 'newest';
    let patients = state.data.patients.filter((patient) =>
      (!query || `${patient.id} ${patient.name}`.toLowerCase().includes(query)) && (!sex || patient.sex === sex));
    if (sort === 'name') patients.sort((a, b) => a.name.localeCompare(b.name));
    else if (sort === 'oldest') patients.sort((a, b) => String(a.registeredAt).localeCompare(String(b.registeredAt)));
    else patients.sort((a, b) => String(b.registeredAt).localeCompare(String(a.registeredAt)));
    el('patientCount').textContent = `${patients.length} patient${patients.length === 1 ? '' : 's'}`;
    const result = paged(patients, 'patients');
    el('patientsTable').innerHTML = result.items.length ? `<div class="table-wrap"><table><thead><tr><th>Patient</th><th>Age / Sex</th><th>Contact</th><th>Registered</th><th>Actions</th></tr></thead><tbody>${result.items.map((patient) =>
      `<tr><td><span class="table-primary">${escapeHtml(patient.name)}</span><span class="table-sub">${escapeHtml(patient.id)} · Demonstration Data</span></td><td>${escapeHtml(patient.age || calculateAge(patient.dob) || '—')} / ${escapeHtml(patient.sex || '—')}</td><td>${escapeHtml(patient.contact || '—')}</td><td>${formatDate(patient.registeredAt)}</td><td><div class="row-actions"><button class="link-button" data-open-record="${escapeHtml(patient.id)}">View chart</button>${canManagePatients() ? `<button class="link-button" data-edit-patient="${escapeHtml(patient.id)}">Edit</button>` : ''}${canManageData() ? `<button class="link-button danger" data-delete-patient="${escapeHtml(patient.id)}">Delete</button>` : ''}</div></td></tr>`).join('')}</tbody></table></div>` : empty(query ? 'No matching patients' : 'No patients registered', query ? 'Try another name or patient ID.' : 'Register a patient or load fictional sample data.');
    renderPagination('patientsPagination', 'patients', result.pages, result.page);
  }
  function renderConsultations() {
    if (!el('consultationsTable')) return;
    const query = (el('consultationSearch')?.value || '').trim().toLowerCase();
    const date = el('consultationDateFilter')?.value || '';
    let items = state.data.consultations.filter((item) => {
      const patient = patientById(item.patientId);
      return (!query || `${item.id} ${patient?.name || ''} ${patient?.id || ''} ${item.diagnosis || ''} ${item.complaint || ''}`.toLowerCase().includes(query)) &&
        (!date || item.dateTime.startsWith(date));
    }).sort((a, b) => String(b.dateTime).localeCompare(String(a.dateTime)));
    el('consultationCount').textContent = `${items.length} consultation${items.length === 1 ? '' : 's'}`;
    const result = paged(items, 'consultations');
    el('consultationsTable').innerHTML = result.items.length ? `<div class="table-wrap"><table><thead><tr><th>Consultation</th><th>Patient</th><th>Date & time</th><th>Complaint</th><th>Clinician</th><th>Actions</th></tr></thead><tbody>${result.items.map((item) => {
      const patient = patientById(item.patientId);
      return `<tr><td><span class="table-primary">${escapeHtml(item.id)}</span><span class="table-sub">Demonstration Data</span></td><td><span class="table-primary">${escapeHtml(patient?.name || 'Unknown')}</span><span class="table-sub">${escapeHtml(item.patientId)}</span></td><td>${formatDateTime(item.dateTime)}</td><td>${escapeHtml(item.complaint || '—')}</td><td>${escapeHtml(item.clinician || '—')}</td><td><div class="row-actions"><button class="link-button" data-open-record="${escapeHtml(item.patientId)}">Chart</button>${canWriteClinical() ? `<button class="link-button" data-edit-consultation="${escapeHtml(item.id)}">Edit</button>` : ''}</div></td></tr>`;
    }).join('')}</tbody></table></div>` : empty('No consultations found', 'Visits that match your search will appear here.');
    renderPagination('consultationsPagination', 'consultations', result.pages, result.page);
  }
  function renderAppointments() {
    if (!el('appointmentsTable')) return;
    const query = (el('appointmentSearch')?.value || '').trim().toLowerCase();
    const status = el('appointmentStatusFilter')?.value || '';
    let items = state.data.appointments.filter((item) => {
      const patient = patientById(item.patientId);
      const matchDate = state.appointmentView !== 'today' || item.dateTime.startsWith(today());
      return matchDate && (!query || `${item.id} ${patient?.name || ''} ${item.reason || ''} ${item.clinician || ''}`.toLowerCase().includes(query)) &&
        (!status || item.status === status);
    }).sort((a, b) => a.dateTime.localeCompare(b.dateTime));
    const result = paged(items, 'appointments');
    el('appointmentsTable').innerHTML = result.items.length ? `<div class="table-wrap"><table><thead><tr><th>Appointment</th><th>Patient</th><th>Date & time</th><th>Reason</th><th>Clinician</th><th>Status</th><th>Actions</th></tr></thead><tbody>${result.items.map((item) => {
      const patient = patientById(item.patientId);
      return `<tr><td><span class="table-primary">${escapeHtml(item.id)}</span><span class="table-sub">Demonstration Data</span></td><td><button class="link-button" data-open-record="${escapeHtml(item.patientId)}">${escapeHtml(patient?.name || 'Unknown')}</button><span class="table-sub">${escapeHtml(item.patientId)}</span></td><td>${formatDateTime(item.dateTime)}</td><td>${escapeHtml(item.reason || '—')}</td><td>${escapeHtml(item.clinician || '—')}</td><td>${statusBadge(item.status)}</td><td><div class="row-actions">${canManageAppointments() ? `<button class="link-button" data-edit-appointment="${escapeHtml(item.id)}">Edit</button>${item.status !== 'Cancelled' ? `<button class="link-button danger" data-cancel-appointment="${escapeHtml(item.id)}">Cancel</button>` : ''}` : '—'}</div></td></tr>`;
    }).join('')}</tbody></table></div>` : empty(state.appointmentView === 'today' ? 'No appointments today' : 'No appointments found', 'Schedule a visit or adjust your filters.');
    renderPagination('appointmentsPagination', 'appointments', result.pages, result.page);
  }
  function openPatientForm(patientId = '') {
    if (!canManagePatients()) return showToast('Your role cannot manage patient profiles.', 'error');
    const existing = patientById(patientId);
    const p = existing || {};
    const body = `<form id="patientForm" novalidate><div class="form-grid">
      ${sectionTitle('Patient details')}
      ${field('Full name', 'name', p.name, 'text', { required: true })}
      ${field('Date of birth', 'dob', p.dob, 'date', { required: true, max: today() })}
      ${field('Age (years)', 'age', p.age || calculateAge(p.dob), 'number', { readonly: true, min: 0 })}
      ${field('Sex', 'sex', p.sex || '', 'text', { required: true, select: [{ value: '', label: 'Select sex' }, ...['Female', 'Male', 'Other', 'Prefer not to say'].map((value) => ({ value, label: value }))] })}
      ${field('Address', 'address', p.address, 'text', { full: true })}
      ${field('Contact number', 'contact', p.contact, 'tel')}
      ${field('Emergency contact', 'emergencyContact', p.emergencyContact, 'tel')}
      ${field('Blood type', 'bloodType', p.bloodType || '', 'text', { select: [{ value: '', label: 'Not recorded' }, ...['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'].map((value) => ({ value, label: value }))] })}
      ${field('Known allergies', 'allergies', p.allergies, 'textarea')}
      ${field('Medical history', 'medicalHistory', p.medicalHistory, 'textarea', { full: true })}
      ${sectionTitle('Demonstration record')}
      ${field('Patient ID', 'patientId', p.id || 'Generated when saved', 'text', { readonly: true })}
      ${field('Date registered', 'registeredAt', p.registeredAt || today(), 'date', { readonly: true })}
      <div class="form-field full"><small class="field-hint">Demonstration Data · Do not enter real patient information.</small></div>
      </div><div class="modal-actions"><button class="button button-secondary" type="button" data-modal-cancel>Cancel</button><button class="button button-primary" type="submit">${existing ? 'Save changes' : 'Register patient'}</button></div></form>`;
    openModal(existing ? 'Edit patient' : 'Register patient', body, { wide: true });
    const form = el('patientForm');
    $('#dob', form).addEventListener('change', () => { $('#age', form).value = calculateAge($('#dob', form).value); });
    form.addEventListener('submit', (event) => {
      event.preventDefault();
      if (!form.reportValidity()) return;
      const formData = new FormData(form);
      const name = String(formData.get('name')).trim();
      if (!name) return showToast('Enter the patient’s full name.', 'error');
      const record = {
        ...(existing || {}), id: existing?.id || makeId('CP', state.data.patients), name,
        dob: formData.get('dob'), age: calculateAge(formData.get('dob')), sex: formData.get('sex'),
        address: String(formData.get('address')).trim(), contact: String(formData.get('contact')).trim(),
        emergencyContact: String(formData.get('emergencyContact')).trim(), bloodType: formData.get('bloodType'),
        allergies: String(formData.get('allergies')).trim(), medicalHistory: String(formData.get('medicalHistory')).trim(),
        registeredAt: existing?.registeredAt || today(), demo: true
      };
      if (existing) state.data.patients[state.data.patients.findIndex((item) => item.id === existing.id)] = record;
      else state.data.patients.push(record);
      const saved = safeSave(); closeModal(); refresh();
      showToast(saved ? (existing ? 'Patient profile updated.' : 'Patient registered successfully.') : 'Patient changes are only available in this tab; browser storage could not save them.', saved ? 'success' : 'error');
    });
  }
  function openConsultationForm(consultationId = '', preselectedPatient = '') {
    if (!canWriteClinical()) return showToast('Only doctors and administrators can write clinical notes.', 'error');
    if (!state.data.patients.length) return showToast('Register a patient before creating a consultation.', 'error');
    const existing = state.data.consultations.find((item) => item.id === consultationId);
    const c = existing || {};
    const selectedPatient = existing?.patientId || preselectedPatient;
    const nowValue = localDateTimeValue();
    const patientOptions = [{ value: '', label: 'Select patient' }, ...patientChoices()];
    const body = `<form id="consultationForm" novalidate><div class="form-grid">
      ${sectionTitle('Visit information')}
      ${field('Patient', 'patientId', selectedPatient, 'text', { required: true, select: patientOptions })}
      ${field('Date and time', 'dateTime', c.dateTime || nowValue, 'datetime-local', { required: true })}
      ${field('Chief complaint', 'complaint', c.complaint, 'text', { required: true, full: true })}
      ${field('Attending clinician', 'clinician', c.clinician || '', 'text', { select: [{ value: '', label: 'Select clinician' }, ...clinicianChoices(c.clinician)] })}
      ${field('Follow-up date', 'followUp', c.followUp, 'date')}
      ${sectionTitle('Clinical history')}
      ${field('History of present illness', 'hpi', c.hpi, 'textarea', { full: true })}
      ${field('Past medical history', 'pastHistory', c.pastHistory, 'textarea')}
      ${field('Current medications', 'currentMedications', c.currentMedications, 'textarea')}
      ${field('Known allergies', 'allergies', c.allergies, 'textarea')}
      ${sectionTitle('Vitals and measurements')}
      ${field('Blood pressure (mmHg)', 'bloodPressure', c.vitals?.bloodPressure, 'text', { hint: 'For example, 120/80' })}
      ${field('Heart rate (bpm)', 'heartRate', c.vitals?.heartRate, 'number', { min: 0, max: 300 })}
      ${field('Respiratory rate (/min)', 'respiratoryRate', c.vitals?.respiratoryRate, 'number', { min: 0, max: 100 })}
      ${field('Temperature (°C)', 'temperature', c.vitals?.temperature, 'number', { min: 25, max: 45, step: '.1' })}
      ${field('Oxygen saturation (%)', 'oxygenSaturation', c.vitals?.oxygenSaturation, 'number', { min: 0, max: 100 })}
      ${field('Height (cm)', 'height', c.height, 'number', { min: .1, step: '.1' })}
      ${field('Weight (kg)', 'weight', c.weight, 'number', { min: .1, step: '.1' })}
      ${field('BMI (kg/m²)', 'bmi', c.bmi || bmi(c.height, c.weight), 'text', { readonly: true })}
      ${sectionTitle('Clinician-entered assessment and plan')}
      ${field('Physical exam findings', 'exam', c.exam, 'textarea', { full: true })}
      ${field('Clinical assessment / diagnosis', 'diagnosis', c.diagnosis, 'textarea', { full: true })}
      ${field('Treatment plan', 'treatmentPlan', c.treatmentPlan, 'textarea', { full: true })}
      ${field('Prescribed medications', 'prescribedMedications', c.prescribedMedications, 'textarea', { full: true })}
      ${field('Laboratory requests / results', 'labs', c.labs, 'textarea', { full: true })}
      ${field('Additional notes', 'notes', c.notes, 'textarea', { full: true })}
      <div class="form-field full"><div class="notice">Clinical content is entered by the clinician. This app never generates diagnoses or treatment recommendations. Demonstration Data only.</div></div>
      </div><div class="modal-actions"><button class="button button-secondary" type="button" data-modal-cancel>Cancel</button><button class="button button-primary" type="submit">${existing ? 'Save consultation' : 'Save consultation'}</button></div></form>`;
    openModal(existing ? 'Edit consultation' : 'New consultation', body, { wide: true });
    const form = el('consultationForm');
    const updateBmi = () => { $('#bmi', form).value = bmi($('#height', form).value, $('#weight', form).value); };
    $('#height', form).addEventListener('input', updateBmi);
    $('#weight', form).addEventListener('input', updateBmi);
    form.addEventListener('submit', (event) => {
      event.preventDefault();
      if (!form.reportValidity()) return;
      const values = Object.fromEntries(new FormData(form).entries());
      if (!patientById(values.patientId)) return showToast('Choose a valid patient record.', 'error');
      const record = {
        ...(existing || {}), id: existing?.id || makeId('CC', state.data.consultations),
        patientId: values.patientId, dateTime: values.dateTime, complaint: values.complaint.trim(),
        hpi: values.hpi.trim(), pastHistory: values.pastHistory.trim(), currentMedications: values.currentMedications.trim(),
        allergies: values.allergies.trim(), vitals: {
          bloodPressure: values.bloodPressure, heartRate: values.heartRate, respiratoryRate: values.respiratoryRate,
          temperature: values.temperature, oxygenSaturation: values.oxygenSaturation
        },
        height: values.height, weight: values.weight, bmi: bmi(values.height, values.weight),
        exam: values.exam.trim(), diagnosis: values.diagnosis.trim(), treatmentPlan: values.treatmentPlan.trim(),
        prescribedMedications: values.prescribedMedications.trim(), labs: values.labs.trim(),
        followUp: values.followUp, clinician: values.clinician, notes: values.notes.trim(), demo: true
      };
      if (existing) state.data.consultations[state.data.consultations.findIndex((item) => item.id === existing.id)] = record;
      else state.data.consultations.push(record);
      const saved = safeSave(); closeModal(); refresh();
      showToast(saved ? 'Consultation saved successfully.' : 'Consultation is only available in this tab; browser storage could not save it.', saved ? 'success' : 'error');
    });
  }
  function openAppointmentForm(appointmentId = '') {
    if (!canManageAppointments()) return showToast('Your role cannot manage appointments.', 'error');
    if (!state.data.patients.length) return showToast('Register a patient before scheduling an appointment.', 'error');
    const existing = state.data.appointments.find((item) => item.id === appointmentId);
    const item = existing || {};
    const body = `<form id="appointmentForm" novalidate><div class="form-grid">
      ${sectionTitle('Appointment details')}
      ${field('Patient', 'patientId', item.patientId || '', 'text', { required: true, select: [{ value: '', label: 'Select patient' }, ...patientChoices()] })}
      ${field('Date and time', 'dateTime', item.dateTime || localDateTimeValue(new Date(Date.now() + 3600000)), 'datetime-local', { required: true })}
      ${field('Reason for visit', 'reason', item.reason, 'text', { required: true, full: true })}
      ${field('Assigned clinician', 'clinician', item.clinician || '', 'text', { select: [{ value: '', label: 'Select clinician' }, ...clinicianChoices(item.clinician)] })}
      ${field('Status', 'status', item.status || 'Scheduled', 'text', { select: ['Scheduled', 'Completed', 'Cancelled', 'No-show'].map((value) => ({ value, label: value })) })}
      </div><div class="modal-actions"><button class="button button-secondary" type="button" data-modal-cancel>Cancel</button><button class="button button-primary" type="submit">${existing ? 'Save changes' : 'Schedule appointment'}</button></div></form>`;
    openModal(existing ? 'Edit appointment' : 'Schedule appointment', body);
    el('appointmentForm').addEventListener('submit', (event) => {
      event.preventDefault();
      const form = event.currentTarget;
      if (!form.reportValidity()) return;
      const values = Object.fromEntries(new FormData(form).entries());
      if (!patientById(values.patientId)) return showToast('Choose a valid patient record.', 'error');
      const record = { ...(existing || {}), id: existing?.id || makeId('CA', state.data.appointments), ...values, reason: values.reason.trim(), time: values.dateTime.slice(11, 16), demo: true };
      if (existing) state.data.appointments[state.data.appointments.findIndex((appointment) => appointment.id === existing.id)] = record;
      else state.data.appointments.push(record);
      const saved = safeSave(); closeModal(); refresh();
      showToast(saved ? (existing ? 'Appointment updated.' : 'Appointment scheduled.') : 'Appointment is only available in this tab; browser storage could not save it.', saved ? 'success' : 'error');
    });
  }
  function openRecord(patientId, tab = 'overview') {
    if (!patientById(patientId)) return showToast('Patient record could not be found.', 'error');
    state.recordPatientId = patientId;
    state.recordTab = tab;
    navigate('record');
  }
  function renderRecord() {
    const patient = patientById(state.recordPatientId);
    if (!patient) return;
    const consultations = consultationsFor(patient.id);
    const allMeds = consultations.flatMap((item) => item.prescribedMedications ? [{ value: item.prescribedMedications, date: item.dateTime, clinician: item.clinician }] : []);
    el('recordTitle').textContent = patient.name;
    el('recordSubtitle').textContent = `${patient.id} · Demonstration Data`;
    el('recordSummary').innerHTML = `<article class="card record-banner"><span class="avatar" aria-hidden="true">${escapeHtml(initials(patient.name))}</span><div><h2>${escapeHtml(patient.name)}</h2><div class="record-meta"><span><strong>Patient ID</strong> ${escapeHtml(patient.id)}</span><span><strong>Age</strong> ${escapeHtml(patient.age || calculateAge(patient.dob) || '—')}</span><span><strong>Sex</strong> ${escapeHtml(patient.sex || '—')}</span><span><strong>Blood type</strong> ${escapeHtml(patient.bloodType || '—')}</span><span><strong>Registered</strong> ${formatDate(patient.registeredAt)}</span></div></div><div class="heading-actions">${canManagePatients() ? `<button class="button button-secondary" data-edit-patient="${escapeHtml(patient.id)}">Edit profile</button>` : ''}</div></article>`;
    $$('#recordTabs [data-record-tab]').forEach((tab) => {
      const active = tab.dataset.recordTab === state.recordTab;
      tab.classList.toggle('active', active);
      tab.setAttribute('aria-selected', String(active));
      tab.tabIndex = active ? 0 : -1;
    });
    const tabs = $$('#recordTabs [data-record-tab]');
    const activeTab = tabs.find((tab) => tab.dataset.recordTab === state.recordTab);
    if (activeTab) el('recordPanel').setAttribute('aria-labelledby', activeTab.id || 'recordTabs');
    const latestVitals = consultations[0];
    let content = '';
    if (state.recordTab === 'overview') {
      content = `<div class="record-grid"><article class="card"><h3>Demographics</h3><dl class="detail-list"><dt>Date of birth</dt><dd>${formatDate(patient.dob)}</dd><dt>Address</dt><dd>${escapeHtml(patient.address || '—')}</dd><dt>Contact</dt><dd>${escapeHtml(patient.contact || '—')}</dd><dt>Emergency contact</dt><dd>${escapeHtml(patient.emergencyContact || '—')}</dd></dl></article><article class="card"><h3>Allergies & history</h3><dl class="detail-list"><dt>Known allergies</dt><dd>${escapeHtml(patient.allergies || 'None recorded')}</dd><dt>Medical history</dt><dd>${escapeHtml(patient.medicalHistory || 'None recorded')}</dd></dl></article><article class="card"><h3>Latest visit vitals</h3>${latestVitals ? `<div class="vitals-grid">${vitalChips(latestVitals)}</div>` : empty('No vitals recorded', 'Vitals will appear after a consultation.')}</article></div><article class="card" style="margin-top:14px"><div class="card-heading"><div><h2>Recent clinical visits</h2><p class="muted">${consultations.length} consultation${consultations.length === 1 ? '' : 's'} on record</p></div></div>${consultations.slice(0, 3).map((item) => `<div class="history-block"><h3>${escapeHtml(item.diagnosis || item.complaint || 'Consultation')}</h3><p>${formatDateTime(item.dateTime)} · ${escapeHtml(item.clinician || 'Clinician not recorded')}</p><p>${escapeHtml(item.treatmentPlan || 'No treatment plan recorded')}</p></div>`).join('') || empty('No consultations yet', 'Clinical visit information will appear here.')}</article>`;
    } else if (state.recordTab === 'history') {
      content = `<article class="card"><h2>Medical history</h2><div class="history-block"><h3>Patient history</h3><p>${escapeHtml(patient.medicalHistory || 'No medical history recorded.')}</p><p><strong>Allergies:</strong> ${escapeHtml(patient.allergies || 'None recorded')}</p></div>${consultations.map((item) => `<div class="history-block"><h3>${escapeHtml(item.diagnosis || item.complaint || 'Visit')}</h3><p>${formatDateTime(item.dateTime)} · ${escapeHtml(item.clinician || '—')}</p><p>${escapeHtml(item.pastHistory || 'No visit history supplied.')}</p></div>`).join('')}</article>`;
    } else if (state.recordTab === 'consultations') {
      content = `<article class="card"><div class="card-heading"><div><h2>Consultation history</h2><p class="muted">Vitals, assessment and plan for each visit</p></div></div>${consultations.map((item) => `<div class="history-block"><h3>${escapeHtml(item.diagnosis || item.complaint || 'Consultation')}</h3><p>${formatDateTime(item.dateTime)} · ${escapeHtml(item.clinician || '—')}</p><p><strong>Chief complaint:</strong> ${escapeHtml(item.complaint || '—')}</p><p><strong>Assessment:</strong> ${escapeHtml(item.diagnosis || 'Not recorded')}</p><p><strong>Treatment plan:</strong> ${escapeHtml(item.treatmentPlan || 'Not recorded')}</p><p><strong>Follow-up:</strong> ${formatDate(item.followUp)}</p><div class="vitals-grid">${vitalChips(item)}</div></div>`).join('') || empty('No consultations yet', 'No visits are linked to this patient.')}</article>`;
    } else if (state.recordTab === 'medications') {
      content = `<article class="card"><h2>Prescribed medications</h2>${allMeds.map((item) => `<div class="history-block"><h3>${escapeHtml(item.value)}</h3><p>${formatDateTime(item.date)} · ${escapeHtml(item.clinician || 'Clinician not recorded')}</p></div>`).join('') || empty('No medications recorded', 'Prescriptions entered in consultations appear here.')}</article>`;
    } else {
      const labItems = consultations.filter((item) => item.labs);
      content = `<article class="card"><h2>Laboratory results & requests</h2>${labItems.map((item) => `<div class="history-block"><h3>${formatDateTime(item.dateTime)}</h3><p>${escapeHtml(item.labs)}</p></div>`).join('') || empty('No laboratory information', 'Laboratory requests or results entered in consultations appear here.')}</article>`;
    }
    el('recordPanel').innerHTML = content;
    el('recordPrintContent').innerHTML = `<article class="card record-summary-print"><h2>${escapeHtml(patient.name)} · ${escapeHtml(patient.id)} · Demonstration Data</h2><p>Date of birth: ${formatDate(patient.dob)} · Age: ${escapeHtml(patient.age || calculateAge(patient.dob) || '—')} · Sex: ${escapeHtml(patient.sex || '—')} · Blood type: ${escapeHtml(patient.bloodType || '—')}</p><p>Address: ${escapeHtml(patient.address || '—')} · Contact: ${escapeHtml(patient.contact || '—')} · Emergency contact: ${escapeHtml(patient.emergencyContact || '—')}</p><p>Allergies: ${escapeHtml(patient.allergies || 'None recorded')}</p><p>Medical history: ${escapeHtml(patient.medicalHistory || 'None recorded')}</p></article><article class="card"><h2>Complete consultation history</h2>${consultations.map((item) => `<div class="history-block"><h3>${escapeHtml(item.diagnosis || item.complaint || 'Consultation')} · ${formatDateTime(item.dateTime)}</h3><p><strong>Complaint:</strong> ${escapeHtml(item.complaint || '—')} · <strong>Clinician:</strong> ${escapeHtml(item.clinician || '—')}</p><p><strong>History:</strong> ${escapeHtml(item.hpi || '—')} · <strong>Past history:</strong> ${escapeHtml(item.pastHistory || '—')}</p><p><strong>Vitals:</strong> ${escapeHtml((item.vitals?.bloodPressure || '—') + ' mmHg; ' + (item.vitals?.heartRate || '—') + ' bpm; ' + (item.vitals?.respiratoryRate || '—') + '/min; ' + (item.vitals?.temperature || '—') + ' °C; ' + (item.vitals?.oxygenSaturation || '—') + '%; height ' + (item.height || '—') + ' cm; weight ' + (item.weight || '—') + ' kg; BMI ' + (item.bmi || '—'))}</p><p><strong>Assessment:</strong> ${escapeHtml(item.diagnosis || '—')}</p><p><strong>Treatment plan:</strong> ${escapeHtml(item.treatmentPlan || '—')}</p><p><strong>Medications:</strong> ${escapeHtml(item.prescribedMedications || '—')}</p><p><strong>Laboratory information:</strong> ${escapeHtml(item.labs || '—')} · <strong>Follow-up:</strong> ${formatDate(item.followUp)}</p><p><strong>Additional notes:</strong> ${escapeHtml(item.notes || '—')}</p></div>`).join('') || '<p>No consultations recorded.</p>'}</article>`;
  }
  function vitalChips(item) {
    const v = item.vitals || {};
    const values = [['Blood pressure', v.bloodPressure, 'mmHg'], ['Heart rate', v.heartRate, 'bpm'], ['Resp. rate', v.respiratoryRate, '/min'], ['Temperature', v.temperature, '°C'], ['Oxygen sat.', v.oxygenSaturation, '%'], ['Height', item.height, 'cm'], ['Weight', item.weight, 'kg'], ['BMI', item.bmi, 'kg/m²']];
    return values.map(([label, value, unit]) => `<div class="vital-chip"><small>${label}</small><strong>${escapeHtml(value ? `${value} ${unit}` : '—')}</strong></div>`).join('');
  }
  function filteredByDate(items, dateField) {
    return items.filter((item) => {
      const date = String(item[dateField] || '').slice(0, 10);
      return (!state.reportFrom || date >= state.reportFrom) && (!state.reportTo || date <= state.reportTo);
    });
  }
  function renderReports() {
    if (!el('reportSummary')) return;
    const consultations = filteredByDate(state.data.consultations, 'dateTime');
    const appointments = filteredByDate(state.data.appointments, 'dateTime');
    const registrations = filteredByDate(state.data.patients, 'registeredAt');
    const dailyVisits = new Set(consultations.map((item) => String(item.dateTime).slice(0, 10))).size;
    const stats = [['Total patients', state.data.patients.length], ['Consultations', consultations.length], ['Daily visit dates', dailyVisits], ['New registrations', registrations.length]];
    el('reportSummary').innerHTML = `<div class="report-stat-grid">${stats.map(([label, value]) => `<article class="stat-card"><div class="stat-label">${label}</div><div class="report-value">${value}</div></article>`).join('')}</div>`;
    const counts = {};
    consultations.forEach((item) => { const key = String(item.dateTime).slice(0, 10); counts[key] = (counts[key] || 0) + 1; });
    const dates = Object.keys(counts).sort().reverse();
    el('consultationReport').innerHTML = dates.length ? dates.map((date) => `<div class="report-line"><span>${formatDate(date)}</span><strong>${counts[date]} visit${counts[date] === 1 ? '' : 's'}</strong></div>`).join('') : empty('No consultations in this range', 'Try expanding the date range.');
    const statuses = {};
    appointments.forEach((item) => { statuses[item.status] = (statuses[item.status] || 0) + 1; });
    el('appointmentReport').innerHTML = Object.keys(statuses).length ? Object.entries(statuses).map(([name, count]) => `<div class="report-line"><span>${statusBadge(name)}</span><strong>${count}</strong></div>`).join('') : empty('No appointments in this range', 'Try expanding the date range.');
  }
  function csvEscape(value) {
    const text = String(value == null ? '' : value);
    return `"${text.replace(/"/g, '""')}"`;
  }
  function downloadCsv(filename, headers, rows) {
    const csv = [headers, ...rows].map((row) => row.map(csvEscape).join(',')).join('\r\n');
    const blob = new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url; link.download = filename; link.hidden = true;
    document.body.append(link); link.click(); link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  function exportPatients() {
    const rows = filteredByDate(state.data.patients, 'registeredAt').map((p) => [p.id, p.name, p.dob, p.age || calculateAge(p.dob), p.sex, p.contact, p.bloodType, p.registeredAt]);
    downloadCsv('carepoint-demo-patients.csv', ['Patient ID', 'Full name', 'Date of birth', 'Age', 'Sex', 'Contact number', 'Blood type', 'Date registered'], rows);
    showToast('Patient report exported as CSV.');
  }
  function exportConsultations() {
    const rows = filteredByDate(state.data.consultations, 'dateTime').map((c) => [c.id, c.patientId, patientById(c.patientId)?.name || '', c.dateTime, c.complaint, c.diagnosis, c.clinician, c.bmi, c.followUp]);
    downloadCsv('carepoint-demo-consultations.csv', ['Consultation ID', 'Patient ID', 'Patient name', 'Date and time', 'Chief complaint', 'Clinical assessment', 'Attending clinician', 'BMI', 'Follow-up date'], rows);
    showToast('Consultation report exported as CSV.');
  }
  function sampleData() {
    if (state.data.patients.length || state.data.consultations.length || state.data.appointments.length) {
      confirmation('Replace current demo data?', 'Loading sample data replaces the patient, consultation, and appointment records currently stored in this browser.', 'Replace with sample data', () => {
        state.data = { patients: [], consultations: [], appointments: [] };
        sampleData();
      }, true);
      return;
    }
    const patients = [
      { id: 'CP-100101', name: 'Fable Example', dob: '1992-03-14', sex: 'Female', address: '12 Demo Lane, Sampletown', contact: '555-0101', emergencyContact: '555-0191', bloodType: 'O+', allergies: 'None reported', medicalHistory: 'Fictional demo history: seasonal allergies.', registeredAt: today(), demo: true },
      { id: 'CP-100102', name: 'River Placeholder', dob: '1984-11-02', sex: 'Male', address: '8 Mockingbird Way, Sampletown', contact: '555-0102', emergencyContact: '555-0192', bloodType: 'A-', allergies: 'Fictional: pollen', medicalHistory: 'Demonstration record only.', registeredAt: today(), demo: true },
      { id: 'CP-100103', name: 'Sunny Sample', dob: '2001-06-22', sex: 'Other', address: '44 Example Street, Sampletown', contact: '555-0103', emergencyContact: '555-0193', bloodType: 'B+', allergies: 'None reported', medicalHistory: 'No history recorded in this fictional profile.', registeredAt: today(), demo: true },
      { id: 'CP-100104', name: 'Pat Demo', dob: '1976-01-09', sex: 'Prefer not to say', address: '3 Placeholder Place, Sampletown', contact: '555-0104', emergencyContact: '555-0194', bloodType: 'AB+', allergies: 'Fictional: adhesive tape', medicalHistory: 'Fictional demo entry; not a real patient.', registeredAt: today(), demo: true },
      { id: 'CP-100105', name: 'Alex Fiction', dob: '2010-09-30', sex: 'Female', address: '91 Practice Road, Sampletown', contact: '555-0105', emergencyContact: '555-0195', bloodType: 'O-', allergies: 'None recorded', medicalHistory: 'Demonstration record only.', registeredAt: today(), demo: true }
    ];
    patients.forEach((patient) => { patient.age = calculateAge(patient.dob); });
    const dt = (offset, time) => {
      const date = new Date();
      date.setDate(date.getDate() + offset);
      return `${dateKey(date)}T${time}`;
    };
    const consultations = [
      { id: 'CC-200101', patientId: 'CP-100101', dateTime: dt(0, '09:15'), complaint: 'Fictional seasonal sneezing', hpi: 'Example symptom history for UI testing.', pastHistory: 'Fictional demo history.', currentMedications: 'None listed', allergies: 'None reported', vitals: { bloodPressure: '118/76', heartRate: '72', respiratoryRate: '16', temperature: '36.7', oxygenSaturation: '99' }, height: '165', weight: '61', bmi: '22.4', exam: 'Fictional sample finding.', diagnosis: 'DEMO ONLY: sample assessment', treatmentPlan: 'DEMO ONLY: sample plan entered by fictional clinician.', prescribedMedications: 'DEMO ONLY: Sample medication entry', labs: 'DEMO ONLY: sample panel requested', followUp: dt(14, '00:00').slice(0, 10), clinician: 'Dr. Demo Clinician', notes: 'Demonstration Data', demo: true },
      { id: 'CC-200102', patientId: 'CP-100102', dateTime: dt(-1, '11:30'), complaint: 'Fictional routine wellness visit', hpi: 'Fictional history for student project.', pastHistory: 'None recorded in demo.', currentMedications: 'Demo supplement entry', allergies: 'Fictional pollen', vitals: { bloodPressure: '122/78', heartRate: '68', respiratoryRate: '15', temperature: '36.5', oxygenSaturation: '98' }, height: '178', weight: '76', bmi: '24.0', exam: 'Demo observation only.', diagnosis: 'DEMO ONLY: routine example', treatmentPlan: 'DEMO ONLY: sample follow-up note.', prescribedMedications: '', labs: '', followUp: '', clinician: 'Dr. Demo Clinician', notes: 'Fictional sample.', demo: true },
      { id: 'CC-200103', patientId: 'CP-100103', dateTime: dt(-3, '14:00'), complaint: 'Fictional visit for interface sample', hpi: 'This data is not medical advice.', pastHistory: 'Demonstration only.', currentMedications: '', allergies: 'None reported', vitals: { bloodPressure: '110/70', heartRate: '75', respiratoryRate: '17', temperature: '36.8', oxygenSaturation: '99' }, height: '170', weight: '64', bmi: '22.1', exam: '', diagnosis: 'DEMO ONLY: fictional note', treatmentPlan: 'DEMO ONLY: fictional plan.', prescribedMedications: 'DEMO ONLY: sample entry', labs: '', followUp: '', clinician: 'Dr. Demo Clinician', notes: '', demo: true }
    ];
    const appointments = [
      { id: 'CA-300101', patientId: 'CP-100101', dateTime: dt(0, '09:15'), time: '09:15', reason: 'Fictional check-in', clinician: 'Dr. Demo Clinician', status: 'Scheduled', demo: true },
      { id: 'CA-300102', patientId: 'CP-100104', dateTime: dt(0, '13:30'), time: '13:30', reason: 'Fictional follow-up', clinician: 'Nurse Demo User', status: 'Scheduled', demo: true },
      { id: 'CA-300103', patientId: 'CP-100105', dateTime: dt(1, '10:00'), time: '10:00', reason: 'Demonstration appointment', clinician: 'Dr. Demo Clinician', status: 'Scheduled', demo: true }
    ];
    state.data = { patients, consultations, appointments };
    const saved = safeSave(); refresh();
    showToast(saved ? 'Fictional sample data loaded. Every record is labeled Demonstration Data.' : 'Sample data is only available in this tab; browser storage could not save it.', saved ? 'success' : 'error');
  }
  function clearData() {
    if (!canManageData()) return showToast('Only an administrator can clear demo data.', 'error');
    confirmation('Clear all demo data?', 'This permanently removes all CarePoint records saved in this browser. This cannot be undone.', 'Clear all data', () => {
      state.data = { patients: [], consultations: [], appointments: [] };
      try { localStorage.removeItem(STORAGE_KEY); }
      catch (error) {
        console.error('Unable to clear CarePoint demonstration data.', error);
        state.recordPatientId = null; refresh(); navigate('dashboard');
        showToast('Records were cleared from this tab, but browser storage could not be cleared; saved data may return after refresh.', 'error');
        return;
      }
      state.recordPatientId = null; refresh(); navigate('dashboard'); showToast('All demo data cleared.');
    }, true);
  }
  function deletePatient(patientId) {
    const patient = patientById(patientId);
    if (!patient || !canManageData()) return;
    confirmation('Delete patient record?', `Delete ${patient.name} and all linked consultations and appointments? This cannot be undone.`, 'Delete patient', () => {
      state.data.patients = state.data.patients.filter((item) => item.id !== patientId);
      state.data.consultations = state.data.consultations.filter((item) => item.patientId !== patientId);
      state.data.appointments = state.data.appointments.filter((item) => item.patientId !== patientId);
      const saved = safeSave();
      if (state.recordPatientId === patientId) { state.recordPatientId = null; navigate('patients'); }
      refresh(); showToast(saved ? 'Patient and linked demonstration records deleted.' : 'Records were removed for this tab only; browser storage could not save the change.', saved ? 'success' : 'error');
    }, true);
  }
  function cancelAppointment(appointmentId) {
    const appointment = state.data.appointments.find((item) => item.id === appointmentId);
    if (!appointment) return;
    confirmation('Cancel appointment?', 'The appointment will remain in the record with Cancelled status.', 'Cancel appointment', () => {
      appointment.status = 'Cancelled';
      const saved = safeSave(); refresh();
      showToast(saved ? 'Appointment cancelled.' : 'Cancellation is only available in this tab; browser storage could not save it.', saved ? 'success' : 'error');
    });
  }
  function openLogin() {
    el('loginOverlay').hidden = false;
    el('loginOverlay').innerHTML = `<form class="login-card" id="loginForm"><a class="brand" href="#" aria-label="CarePoint Clinic"><span class="brand-mark" aria-hidden="true">✚</span><span><strong>CarePoint</strong><small>CLINIC</small></span></a><p class="eyebrow">DEMONSTRATION WORKSPACE</p><h1>Clinical Records Management System</h1><p>Choose a simulated role to enter the clinic demo. No account or password is used.</p><div class="notice" role="note">This front-end simulation cannot provide real authentication, authorization, or confidentiality. JavaScript and localStorage are not secure. Never store real passwords or real patient data.</div><div class="form-field"><label for="loginRole">Demo role</label><select id="loginRole">${ROLES.map((role) => `<option>${role}</option>`).join('')}</select></div><button class="button button-primary" type="submit">Enter demo workspace</button></form>`;
    $('#loginForm').addEventListener('submit', (event) => {
      event.preventDefault();
      state.role = $('#loginRole').value;
      el('loginOverlay').hidden = true;
      el('loginOverlay').innerHTML = '';
      renderRole(); navigate('dashboard'); showToast(`Signed in as simulated ${state.role}.`);
    });
  }
  function closeMobileMenu() {
    el('sidebar').classList.remove('open');
    el('menuToggle').setAttribute('aria-expanded', 'false');
    el('menuToggle').setAttribute('aria-label', 'Open navigation menu');
  }
  function handleGlobalSearch() {
    const input = el('globalSearch');
    const query = input.value.trim().toLowerCase();
    if (!query) return;
    const patient = state.data.patients.find((item) => item.id.toLowerCase() === query) ||
      state.data.patients.find((item) => item.name.toLowerCase().includes(query));
    if (patient) { input.value = ''; openRecord(patient.id); }
    else showToast('No patient matched that name or ID.', 'error');
  }

  document.addEventListener('click', (event) => {
    const target = event.target.closest('button,a[data-page],[data-open-record]');
    if (!target) return;
    if (target.dataset.page) {
      if (target.tagName === 'A') event.preventDefault();
      return navigate(target.dataset.page);
    }
    if (target.dataset.navigate) return navigate(target.dataset.navigate);
    if (target.dataset.action === 'new-patient') return openPatientForm();
    if (target.dataset.action === 'new-consultation') return openConsultationForm('', state.recordPatientId || '');
    if (target.dataset.action === 'new-appointment') return openAppointmentForm();
    if (target.dataset.openRecord) return openRecord(target.dataset.openRecord);
    if (target.dataset.editPatient) return openPatientForm(target.dataset.editPatient);
    if (target.dataset.deletePatient) return deletePatient(target.dataset.deletePatient);
    if (target.dataset.editConsultation) return openConsultationForm(target.dataset.editConsultation);
    if (target.dataset.editAppointment) return openAppointmentForm(target.dataset.editAppointment);
    if (target.dataset.cancelAppointment) return cancelAppointment(target.dataset.cancelAppointment);
    if (target.dataset.pageType) {
      state.pageNumbers[target.dataset.pageType] = Number(target.dataset.pageNumber);
      if (target.dataset.pageType === 'patients') renderPatients();
      if (target.dataset.pageType === 'consultations') renderConsultations();
      if (target.dataset.pageType === 'appointments') renderAppointments();
      return;
    }
    if (target.dataset.recordTab) {
      state.recordTab = target.dataset.recordTab;
      renderRecord();
      target.focus();
      return;
    }
    if (target.dataset.appointmentView) {
      state.appointmentView = target.dataset.appointmentView;
      $$('[data-appointment-view]').forEach((button) => {
        const active = button.dataset.appointmentView === state.appointmentView;
        button.classList.toggle('active', active); button.setAttribute('aria-selected', String(active));
      });
      state.pageNumbers.appointments = 1; renderAppointments();
      return;
    }
    if (target.id === 'menuToggle') {
      const open = el('sidebar').classList.toggle('open');
      target.setAttribute('aria-expanded', String(open));
      target.setAttribute('aria-label', open ? 'Close navigation menu' : 'Open navigation menu');
      return;
    }
    if (target.id === 'modalClose' || target.hasAttribute('data-modal-cancel')) return closeModal();
    if (target.id === 'loadSampleButton') return sampleData();
    if (target.id === 'clearDataButton') return clearData();
    if (target.id === 'logoutButton') return openLogin();
    if (target.id === 'printRecordButton' || target.id === 'printReportButton') { window.print(); return; }
    if (target.id === 'applyReportButton') {
      state.reportFrom = el('reportFrom').value; state.reportTo = el('reportTo').value;
      if (state.reportFrom && state.reportTo && state.reportFrom > state.reportTo) return showToast('The start date must be on or before the end date.', 'error');
      renderReports(); return;
    }
    if (target.id === 'exportPatientsButton') return exportPatients();
    if (target.id === 'exportConsultationsButton') return exportConsultations();
  });
  document.addEventListener('input', (event) => {
    if (['patientSearch', 'consultationSearch', 'appointmentSearch'].includes(event.target.id)) {
      const type = event.target.id === 'patientSearch' ? 'patients' : event.target.id === 'consultationSearch' ? 'consultations' : 'appointments';
      state.pageNumbers[type] = 1;
      if (type === 'patients') renderPatients();
      if (type === 'consultations') renderConsultations();
      if (type === 'appointments') renderAppointments();
    }
  });
  document.addEventListener('change', (event) => {
    if (event.target.id === 'patientSexFilter' || event.target.id === 'patientSort') { state.pageNumbers.patients = 1; renderPatients(); }
    if (event.target.id === 'consultationDateFilter') { state.pageNumbers.consultations = 1; renderConsultations(); }
    if (event.target.id === 'appointmentStatusFilter') { state.pageNumbers.appointments = 1; renderAppointments(); }
  });
  el('globalSearch').addEventListener('keydown', (event) => { if (event.key === 'Enter') { event.preventDefault(); handleGlobalSearch(); } });
  el('modalBackdrop').addEventListener('click', (event) => { if (event.target === el('modalBackdrop')) closeModal(); });
  document.addEventListener('keydown', (event) => {
    if ((event.key === 'Enter' || event.key === ' ') && event.target.matches('[data-open-record][role="button"]')) {
      event.preventDefault();
      openRecord(event.target.dataset.openRecord);
    }
    if (event.key === 'Escape' && !el('modalBackdrop').hidden) closeModal();
    if (event.key === 'Escape') closeMobileMenu();
    if (event.key === 'Tab' && !el('modalBackdrop').hidden) {
      const focusable = $$('button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex="0"]', el('modalDialog'));
      if (!focusable.length) return;
      const first = focusable[0]; const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    }
    if ((event.key === 'ArrowRight' || event.key === 'ArrowLeft') && event.target.matches('[role="tab"]')) {
      const tablist = event.target.closest('[role="tablist"]');
      const tabs = $$('[role="tab"]', tablist);
      const current = tabs.indexOf(event.target);
      const next = tabs[(current + (event.key === 'ArrowRight' ? 1 : tabs.length - 1)) % tabs.length];
      next.focus(); next.click();
    }
  });
  el('currentDate').textContent = new Date().toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
  loadData();
  renderRole();
  refresh();
  navigate('dashboard');
  openLogin();
})();

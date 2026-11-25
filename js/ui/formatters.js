(function (root) {
  'use strict';

  var STATUS_LABELS = {
    pending: 'Pending',
    approved: 'Approved',
    rejected: 'Rejected',
    cancelled: 'Cancelled',
    confirmed: 'Confirmed (Legacy)',
    unknown: 'Unknown'
  };

  function errorText(error) {
    if (error && error.message) return error.message;
    if (typeof error === 'string') return error;
    try {
      return JSON.stringify(error);
    } catch (serializationError) {
      return String(error);
    }
  }

  function formatLocalInput(date) {
    function pad(value) { return String(value).padStart(2, '0'); }
    return date.getFullYear() + '-' + pad(date.getMonth() + 1) + '-' +
      pad(date.getDate()) + 'T' + pad(date.getHours()) + ':' + pad(date.getMinutes());
  }

  function formatDate(value) {
    var date = new Date(value);
    return Number.isNaN(date.getTime()) ? 'Invalid time' : date.toLocaleString('en-US');
  }

  function formatDateRange(startUtc, endUtc) {
    return formatDate(startUtc) + ' to ' + formatDate(endUtc);
  }

  function getStatusLabel(status) {
    var key = String(status || '').trim().toLowerCase();
    return STATUS_LABELS[key] || STATUS_LABELS.unknown;
  }

  function getStatusClass(status) {
    var key = String(status || '').trim().toLowerCase();
    return STATUS_LABELS[key] ? 'booking-status-' + key : 'booking-status-unknown';
  }

  function isDeviceActive(device) {
    if (!device) return false;
    if (!device.activeTo) return true;
    var activeTo = new Date(device.activeTo).getTime();
    return Number.isFinite(activeTo) && activeTo > Date.now();
  }

  function resolveDeviceName(details, devices) {
    if (!details || (!details.deviceId && !details.deviceName)) {
      return 'Unassigned';
    }
    var matched = (devices || []).find(function (item) {
      return item.id === details.deviceId;
    });
    return matched ? (matched.name || matched.id) : (details.deviceName || details.deviceId || 'Unassigned');
  }

  function createStatusBadge(status) {
    var badge = document.createElement('span');
    badge.className = 'booking-status ' + getStatusClass(status);
    badge.textContent = getStatusLabel(status);
    return badge;
  }

  function createEmptyBlock(message, extraClass) {
    var empty = document.createElement('p');
    empty.className = extraClass ? 'empty ' + extraClass : 'empty';
    empty.textContent = message;
    return empty;
  }

  function createTableEmptyRow(colSpan, message) {
    var row = document.createElement('tr');
    var cell = document.createElement('td');
    cell.colSpan = colSpan;
    cell.appendChild(createEmptyBlock(message, 'table-empty'));
    row.appendChild(cell);
    return row;
  }

  root.FleetAddIn = root.FleetAddIn || {};
  root.FleetAddIn.Formatters = {
    createEmptyBlock: createEmptyBlock,
    createStatusBadge: createStatusBadge,
    createTableEmptyRow: createTableEmptyRow,
    errorText: errorText,
    formatDate: formatDate,
    formatDateRange: formatDateRange,
    formatLocalInput: formatLocalInput,
    getStatusClass: getStatusClass,
    getStatusLabel: getStatusLabel,
    isDeviceActive: isDeviceActive,
    resolveDeviceName: resolveDeviceName
  };
}(typeof globalThis !== 'undefined' ? globalThis : this));
